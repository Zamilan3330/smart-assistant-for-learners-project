import Anthropic from '@anthropic-ai/sdk'
import { createHash, randomUUID } from 'crypto'
import { prisma } from '../../lib/db/prisma'
import { searchChunks } from '../retrieval/retrieval.service'
import { recordFlashcardEvidence } from '../mastery/mastery.service'
import type {
  Flashcard,
  FlashcardRating,
  GenerateFlashcardsParams,
  GenerateFlashcardsResult,
  ReviewFlashcardParams,
  ReviewFlashcardResult,
} from './flashcards.types'

let _client: Anthropic | null = null
function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.CLAUDE_API_KEY
    if (!apiKey) throw new Error('CLAUDE_API_KEY is not set')
    _client = new Anthropic({ apiKey })
  }
  return _client
}

const DEFAULT_COUNT = 8

// ── SM-2 ─────────────────────────────────────────────────────────────────

const Q_MAP: Record<FlashcardRating, number> = {
  again: 1,
  hard:  3,
  good:  4,
  easy:  5,
}

interface Sm2State {
  repetitions:  number
  easeFactor:   number
  intervalDays: number
}

const SM2_DEFAULTS: Sm2State = { repetitions: 0, easeFactor: 2.5, intervalDays: 1 }

function applySm2(state: Sm2State, rating: FlashcardRating): Sm2State {
  const q = Q_MAP[rating]
  const easeFactor = Math.max(1.3, state.easeFactor + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))

  if (q < 3) {
    return { repetitions: 0, easeFactor, intervalDays: 1 }
  }
  const repetitions = state.repetitions + 1
  const intervalDays =
    repetitions === 1 ? 1 :
    repetitions === 2 ? 6 :
    Math.round(state.intervalDays * easeFactor)

  return { repetitions, easeFactor, intervalDays }
}

function normalizeCardFront(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[?？!！.。,]/g, '')
    // Mongolian script variants of common IT terms → canonical Latin
    .replace(/трайд|триад|трiad/gi, 'triad')
    .replace(/аутентик|authentik/gi, 'authentic')
}

function cardHash(front: string, kuCode?: string): string {
  const normalized = normalizeCardFront(front)
  const key = `${kuCode ?? 'general'}:${normalized}`
  return createHash('sha256').update(key).digest('hex').slice(0, 64)
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

// ── target resolution ────────────────────────────────────────────────────

async function resolveTarget(params: GenerateFlashcardsParams) {
  if (params.kuCode) {
    const ku = await prisma.knowledgeUnit.findUnique({
      where: { kuCode: params.kuCode },
      include: { knowledgeArea: true },
    })
    if (ku) return { kaCode: ku.knowledgeArea.kaCode, kuCode: ku.kuCode }
  }
  if (params.kaCode) return { kaCode: params.kaCode, kuCode: '' }

  const weakest = await prisma.userKuMastery.findMany({
    where: { userId: params.userId },
    include: { knowledgeUnit: { include: { knowledgeArea: true } } },
    orderBy: [{ masteryScore: 'asc' }, { evidenceCount: 'asc' }],
    take: 1,
  })
  if (weakest.length > 0) {
    return {
      kaCode: weakest[0].knowledgeUnit.knowledgeArea.kaCode,
      kuCode: weakest[0].knowledgeUnit.kuCode,
    }
  }
  return { kaCode: '', kuCode: '' }
}

// ── generate ─────────────────────────────────────────────────────────────

export async function generateFlashcards(
  params: GenerateFlashcardsParams,
): Promise<GenerateFlashcardsResult> {
  const count = params.count ?? DEFAULT_COUNT
  let { kaCode, kuCode } = await resolveTarget(params)

  // 1. Fetch due cards (SM-2: show overdue cards before generating new ones)
  const now = new Date()
  const srsWhere: Parameters<typeof prisma.flashcardSrsState.findMany>[0]['where'] = {
    userId: params.userId,
    dueDate: { lte: now },
  }
  if (kuCode) srsWhere.kuCode = kuCode
  else if (kaCode) srsWhere.kaCode = kaCode

  const dueStates = await prisma.flashcardSrsState.findMany({
    where: srsWhere,
    orderBy: { dueDate: 'asc' },
    take: count,
  })

  const dueCards: Flashcard[] = dueStates.map((s) => ({
    id: randomUUID(),
    front: s.front,
    back: s.back,
    hint: s.hint ?? undefined,
    kuCode: s.kuCode ?? kuCode,
    sourceChunkIds: [],
  }))

  if (dueCards.length >= count) {
    return { kaCode, kuCode, cards: dueCards }
  }

  // 2. Generate new LLM cards for remaining slots
  const newCount = count - dueCards.length
  const topicHint = kuCode || kaCode || 'general IT knowledge'
  const chunks = await searchChunks({
    question: `Key concepts for ${topicHint}`,
    userId: params.userId,
    kaCode: kaCode || undefined,
    documentIds: params.documentIds,
    limit: 8,
  })

  if (chunks.length === 0) return { kaCode, kuCode, cards: dueCards }

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

  const systemPrompt = `Та суралцагчдад зориулсан Flashcard (флашкарт) үүсгэгч AI.
Доорх эх сурвалжуудад тулгуурлан ${newCount} ширхэг флашкарт үүсгэнэ үү.
Дүрэм:
- Нүүр тал (front) нь богино асуулт эсвэл нэр томьёо байна.
- Ар тал (back) нь товч, тодорхой тайлбар байна (1-3 өгүүлбэр).
- Зөвхөн эх сурвалжид байгаа мэдээллийг ашиглана.
- Хариултаа заавал дараах JSON форматаар буцаана:

{
  "cards": [
    { "front": "...", "back": "...", "hint": "(optional short hint)" }
  ]
}

Эх сурвалжууд:
${context}`

  const response = await getClient().messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [
      { role: 'user', content: `${newCount} флашкарт үүсгэнэ үү. Зөвхөн JSON буцаана уу.` },
    ],
  })

  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')
  const parsed = parseCardJson(textBlock?.text ?? '')

  const sourceChunkIds = chunks.map((c) => c.chunkId)
  const newCards: Flashcard[] = parsed.map((c) => ({
    id: randomUUID(),
    front: c.front,
    back: c.back,
    hint: c.hint,
    kuCode,
    sourceChunkIds,
  }))

  return { kaCode, kuCode, cards: [...dueCards, ...newCards] }
}

function parseCardJson(raw: string): Array<{ front: string; back: string; hint?: string }> {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1) return []
  try {
    const obj = JSON.parse(raw.slice(start, end + 1))
    if (!Array.isArray(obj.cards)) return []
    return obj.cards.filter(
      (c: unknown): c is { front: string; back: string; hint?: string } => {
        if (!c || typeof c !== 'object') return false
        const r = c as Record<string, unknown>
        return typeof r.front === 'string' && typeof r.back === 'string'
      },
    )
  } catch (err) {
    console.error('[flashcards] JSON parse failed:', err)
    return []
  }
}

// ── review ───────────────────────────────────────────────────────────────

export async function reviewFlashcard(
  params: ReviewFlashcardParams,
): Promise<ReviewFlashcardResult> {
  const hash = cardHash(params.front, params.kuCode || params.kaCode)
  const isCorrect = params.rating !== 'again'

  // Load existing SM-2 state or use defaults
  const existing = await prisma.flashcardSrsState.findUnique({
    where: { userId_cardHash: { userId: params.userId, cardHash: hash } },
  })

  const currentState: Sm2State = existing
    ? {
        repetitions:  existing.repetitions,
        easeFactor:   Number(existing.easeFactor),
        intervalDays: existing.intervalDays,
      }
    : { ...SM2_DEFAULTS }

  const next = applySm2(currentState, params.rating)
  const dueDate = addDays(new Date(), next.intervalDays)

  await prisma.flashcardSrsState.upsert({
    where: { userId_cardHash: { userId: params.userId, cardHash: hash } },
    create: {
      userId:       params.userId,
      cardHash:     hash,
      front:        params.front,
      back:         params.back,
      kuCode:       params.kuCode || null,
      kaCode:       params.kaCode || null,
      repetitions:  next.repetitions,
      easeFactor:   next.easeFactor,
      intervalDays: next.intervalDays,
      dueDate,
    },
    update: {
      back:         params.back,
      repetitions:  next.repetitions,
      easeFactor:   next.easeFactor,
      intervalDays: next.intervalDays,
      dueDate,
    },
  })

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

  const attempt = await prisma.flashcardAttempt.create({
    data: {
      userId:         params.userId,
      sessionId:      params.sessionId,
      knowledgeAreaId: ku?.knowledgeAreaId ?? ka?.id ?? null,
      knowledgeUnitId: ku?.id ?? null,
      promptText:     params.front,
      expectedAnswer: params.back,
      userAnswer:     null,
      isCorrect,
      score:          isCorrect ? 1 : 0,
    },
  })

  let effectiveKuCode = params.kuCode
  if (!effectiveKuCode && params.kaCode) {
    const firstKu = await prisma.knowledgeUnit.findFirst({
      where: { knowledgeArea: { kaCode: params.kaCode } },
      orderBy: { kuCode: 'asc' },
      select: { kuCode: true },
    })
    effectiveKuCode = firstKu?.kuCode ?? ''
  }

  if (effectiveKuCode) {
    try {
      await recordFlashcardEvidence({
        userId:    params.userId,
        kuCode:    effectiveKuCode,
        isCorrect,
        sessionId: params.sessionId,
      })
    } catch (err) {
      console.error('[flashcards] mastery update failed:', err)
    }
  }

  return {
    attemptId:        attempt.id.toString(),
    isCorrect,
    nextIntervalDays: next.intervalDays,
    dueDate:          dueDate.toISOString(),
    easeFactor:       next.easeFactor,
    repetitions:      next.repetitions,
  }
}
