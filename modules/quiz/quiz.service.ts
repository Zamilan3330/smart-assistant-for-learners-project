/**
 * modules/quiz/quiz.service.ts
 *
 * LLM-powered quiz generation on top of the user's own learning material.
 *
 *   1. Pick a KA/KU (explicit or weakest-area heuristic)
 *   2. Retrieve top chunks from Weaviate for that KA/KU
 *   3. Ask Claude to build multiple-choice questions grounded in those chunks
 *   4. Grade the user's answers and record mastery evidence
 */

import Anthropic from '@anthropic-ai/sdk'
import { randomUUID } from 'crypto'
import { prisma } from '../../lib/db/prisma'
import { searchChunks } from '../retrieval/retrieval.service'
import { recordQuizEvidence } from '../mastery/mastery.service'
import type {
  GenerateQuizParams,
  GenerateQuizResult,
  QuizQuestion,
  SubmitQuizParams,
  SubmitQuizResult,
} from './quiz.types'

let _client: Anthropic | null = null
function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.CLAUDE_API_KEY
    if (!apiKey) throw new Error('CLAUDE_API_KEY is not set')
    _client = new Anthropic({ apiKey })
  }
  return _client
}

const DEFAULT_COUNT = 5

// ── helpers ──────────────────────────────────────────────────────────────
async function pickWeakestKu(userId: bigint): Promise<{ kaCode: string; kuCode: string } | null> {
  const rows = await prisma.userKuMastery.findMany({
    where: { userId },
    include: { knowledgeUnit: { include: { knowledgeArea: true } } },
    orderBy: [{ masteryScore: 'asc' }, { evidenceCount: 'asc' }],
    take: 1,
  })
  if (rows.length === 0) return null
  const r = rows[0]
  return { kaCode: r.knowledgeUnit.knowledgeArea.kaCode, kuCode: r.knowledgeUnit.kuCode }
}

async function resolveTarget(
  params: GenerateQuizParams,
): Promise<{ kaCode: string; kuCode: string }> {
  if (params.kuCode) {
    const ku = await prisma.knowledgeUnit.findUnique({
      where: { kuCode: params.kuCode },
      include: { knowledgeArea: true },
    })
    if (ku) return { kaCode: ku.knowledgeArea.kaCode, kuCode: ku.kuCode }
  }
  if (params.kaCode) return { kaCode: params.kaCode, kuCode: '' }
  const weakest = await pickWeakestKu(params.userId)
  if (weakest) return weakest
  return { kaCode: '', kuCode: '' }
}

// ── generation ───────────────────────────────────────────────────────────
export async function generateQuiz(
  params: GenerateQuizParams,
): Promise<GenerateQuizResult> {
  const count = params.count ?? DEFAULT_COUNT
  let { kaCode, kuCode } = await resolveTarget(params)

  const topicHint = kuCode || kaCode || 'general IT knowledge'
  const chunks = await searchChunks({
    question: `Study material for ${topicHint}`,
    userId: params.userId,
    kaCode: kaCode || undefined,
    documentIds: params.documentIds,
    limit: 8,
  })

  if (chunks.length === 0) {
    return { kaCode, kuCode, questions: [] }
  }

  // Fallback: if target resolution produced no codes (e.g. brand-new user with
  // zero UserKuMastery rows), take them from the top retrieved chunk so mastery
  // evidence can still be recorded on submit.
  if (!kuCode) {
    const firstWithKu = chunks.find((c) => c.knowledgeUnitCode)
    if (firstWithKu) kuCode = firstWithKu.knowledgeUnitCode
  }
  if (!kaCode) {
    const firstWithKa = chunks.find((c) => c.knowledgeAreaCode)
    if (firstWithKa) kaCode = firstWithKa.knowledgeAreaCode
  }

  const context = chunks
    .map((c, i) => `[${i + 1}] "${c.documentTitle}" (хуудас ${c.pageNumber}):\n${c.text}`)
    .join('\n\n---\n\n')

  const systemPrompt = `Та суралцагчийн мэдлэгийг шалгах сорилын асуулт үүсгэгч AI.
Доорх эх сурвалж дээр тулгуурлан ${count} сонголттой асуулт үүсгэнэ үү.
Дүрэм:
- Зөвхөн эх сурвалжид байгаа мэдээллээр асуулт бүтээнэ.
- Асуулт бүр 4 сонголттой, яг нэг зөв хариулттай байна.
- Зөв биш сонголтууд нь итгэл төрүүлэхүйц боловч буруу байх ёстой.
- ЧУХАЛ: Зөв хариултын байрлалыг (correctIndex) асуулт бүрд өөрчилж, 0, 1, 2, 3 гэсэн бүх сонголтоор жигд тарааж тавина уу. Зөв хариулт БҮГД нэг байрлалд (жишээ нь 0) байх ёсгүй!
- Хариултаа заавал дараах JSON форматаар буцаана:

{
  "questions": [
    {
      "question": "...",
      "choices": ["...", "...", "...", "..."],
      "correctIndex": 2,
      "explanation": "Яагаад энэ хариулт зөв болохыг эх сурвалжаас иш татаж тайлбарлана"
    }
  ]
}

Эх сурвалжууд:
${context}`

  const response = await getClient().messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `${count} асуулттай сорил үүсгэнэ үү. Зөвхөн JSON буцаана уу.`,
      },
    ],
  })

  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')
  const raw = textBlock?.text ?? ''
  const parsed = parseQuizJson(raw)

  const sourceChunkIds = chunks.map((c) => c.chunkId)
  const questions: QuizQuestion[] = parsed.map((q) => {
    // Shuffle choices so the correct answer isn't always at the same position,
    // even if the LLM ignores the "distribute evenly" instruction.
    const shuffled = shuffleChoices(q.choices, q.correctIndex)
    return {
      id: randomUUID(),
      question: q.question,
      choices: shuffled.choices,
      correctIndex: shuffled.correctIndex,
      explanation: q.explanation,
      kuCode,
      sourceChunkIds,
    }
  })

  return { kaCode, kuCode, questions }
}

/**
 * Fisher-Yates shuffle of choices, tracking where the correct answer lands.
 */
function shuffleChoices(
  choices: string[],
  correctIndex: number,
): { choices: string[]; correctIndex: number } {
  const arr = choices.map((text, i) => ({ text, wasCorrect: i === correctIndex }))
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return {
    choices: arr.map((a) => a.text),
    correctIndex: arr.findIndex((a) => a.wasCorrect),
  }
}

function parseQuizJson(raw: string): Array<{
  question: string
  choices: string[]
  correctIndex: number
  explanation: string
}> {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1) return []
  try {
    const obj = JSON.parse(raw.slice(start, end + 1))
    if (!Array.isArray(obj.questions)) return []
    return obj.questions
      .filter(
        (q: unknown): q is { question: string; choices: string[]; correctIndex: number; explanation: string } => {
          if (!q || typeof q !== 'object') return false
          const r = q as Record<string, unknown>
          return (
            typeof r.question === 'string' &&
            Array.isArray(r.choices) &&
            r.choices.length === 4 &&
            r.choices.every((c) => typeof c === 'string') &&
            typeof r.correctIndex === 'number' &&
            r.correctIndex >= 0 &&
            r.correctIndex < 4 &&
            typeof r.explanation === 'string'
          )
        },
      )
  } catch (err) {
    console.error('[quiz] JSON parse failed:', err)
    return []
  }
}

// ── submission ───────────────────────────────────────────────────────────
export async function submitQuiz(params: SubmitQuizParams): Promise<SubmitQuizResult> {
  const total = params.answers.length
  let correct = 0

  for (const a of params.answers) {
    if (a.choiceIndex === a.correctIndex) correct += 1
  }
  const score = total === 0 ? 0 : correct / total

  const ku = params.kuCode
    ? await prisma.knowledgeUnit.findUnique({
        where: { kuCode: params.kuCode },
        select: { id: true, knowledgeAreaId: true },
      })
    : null
  const ka = !ku && params.kaCode
    ? await prisma.knowledgeArea.findUnique({
        where: { kaCode: params.kaCode },
        select: { id: true },
      })
    : null

  const attempt = await prisma.quizAttempt.create({
    data: {
      userId: params.userId,
      sessionId: params.sessionId,
      knowledgeAreaId: ku?.knowledgeAreaId ?? ka?.id ?? null,
      knowledgeUnitId: ku?.id ?? null,
      score,
      totalQuestions: total,
      correctAnswers: correct,
    },
  })

  // Resolve effective kuCode: use explicit kuCode, or fall back to first KU of the given KA
  let effectiveKuCode = params.kuCode
  if (!effectiveKuCode && params.kaCode) {
    const ku = await prisma.knowledgeUnit.findFirst({
      where: { knowledgeArea: { kaCode: params.kaCode } },
      orderBy: { kuCode: 'asc' },
      select: { kuCode: true },
    })
    effectiveKuCode = ku?.kuCode ?? ''
  }

  // Record per-answer mastery evidence so correct + wrong each shift the score.
  if (effectiveKuCode) {
    for (const a of params.answers) {
      try {
        await recordQuizEvidence({
          userId: params.userId,
          kuCode: effectiveKuCode,
          isCorrect: a.choiceIndex === a.correctIndex,
          sessionId: params.sessionId,
        })
      } catch (err) {
        console.error('[quiz] mastery update failed:', err)
      }
    }
  }

  return {
    totalQuestions: total,
    correctAnswers: correct,
    score,
    attemptId: attempt.id.toString(),
  }
}
