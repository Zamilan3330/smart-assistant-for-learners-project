/**
 * modules/mastery/mastery.service.ts
 *
 * Public API for the mastery subsystem.
 * Used by:
 *   - chat pipeline (recordChatEvidence)
 *   - flashcard module (recordFlashcardEvidence) — Phase 2
 *   - quiz module     (recordQuizEvidence)       — Phase 2
 *   - dashboard       (getUserMastery)
 */

import { prisma } from '../../lib/db/prisma'
import { inferChatEvidence } from './inference'
import { recordEvidence } from './update-mastery'
import type { EvidenceResult } from './mastery.types'

export interface RecordChatEvidenceParams {
  userId: bigint
  kuCode: string
  answer: string
  hasCitations: boolean
  sessionId?: bigint
  messageId?: bigint
}

export async function recordChatEvidence(
  params: RecordChatEvidenceParams,
): Promise<EvidenceResult | null> {
  if (!params.kuCode) return null

  const evidenceType = inferChatEvidence({
    answer: params.answer,
    hasCitations: params.hasCitations,
  })
  if (!evidenceType) return null

  return recordEvidence({
    userId: params.userId,
    kuCode: params.kuCode,
    evidenceType,
    sessionId: params.sessionId,
    messageId: params.messageId,
    evidenceText: params.answer.slice(0, 500),
  })
}

export async function recordFlashcardEvidence(params: {
  userId: bigint
  kuCode: string
  isCorrect: boolean
  sessionId?: bigint
}): Promise<EvidenceResult | null> {
  return recordEvidence({
    userId: params.userId,
    kuCode: params.kuCode,
    evidenceType: params.isCorrect ? 'flashcard_correct' : 'flashcard_incorrect',
    sessionId: params.sessionId,
  })
}

export async function recordQuizEvidence(params: {
  userId: bigint
  kuCode: string
  isCorrect: boolean
  sessionId?: bigint
}): Promise<EvidenceResult | null> {
  return recordEvidence({
    userId: params.userId,
    kuCode: params.kuCode,
    evidenceType: params.isCorrect ? 'quiz_correct' : 'quiz_incorrect',
    sessionId: params.sessionId,
  })
}

/**
 * Fetches the user's mastery state for dashboard rendering.
 * Returns both KA aggregates and per-KU scores.
 */
export async function getUserMastery(userId: bigint) {
  const [kaMastery, kuMastery] = await Promise.all([
    prisma.userMastery.findMany({
      where: { userId },
      include: { knowledgeArea: { select: { kaCode: true, name: true } } },
      orderBy: { masteryScore: 'desc' },
    }),
    prisma.userKuMastery.findMany({
      where: { userId },
      include: {
        knowledgeUnit: {
          select: { kuCode: true, name: true, knowledgeAreaId: true },
        },
      },
      orderBy: { masteryScore: 'desc' },
    }),
  ])

  return { kaMastery, kuMastery }
}
