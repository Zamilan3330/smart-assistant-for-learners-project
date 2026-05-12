/**
 * modules/mastery/mastery.types.ts
 *
 * Mastery evidence types and weights.
 * Based on diploma thesis §1.6.3 — evidence-based rule update.
 */

export type EvidenceType =
  | 'chat_correct'
  | 'chat_incorrect'
  | 'flashcard_correct'
  | 'flashcard_incorrect'
  | 'quiz_correct'
  | 'quiz_incorrect'

/**
 * Score deltas per evidence type.
 * Values picked from diploma table (main.tex lines 1329–1332):
 *   Chat correct          → +0.03
 *   Chat incorrect        → −0.02
 *   Flashcard correct     → +0.03 .. +0.06  (midpoint 0.05)
 *   Quiz correct          → +0.05 .. +0.12  (midpoint 0.08)
 * Flashcard/quiz incorrect follow the same negative-evidence principle.
 */
export const EVIDENCE_WEIGHTS: Record<EvidenceType, number> = {
  chat_correct: 0.03,
  chat_incorrect: -0.02,
  flashcard_correct: 0.05,
  flashcard_incorrect: -0.02,
  quiz_correct: 0.08,
  quiz_incorrect: -0.03,
}

export interface RecordEvidenceParams {
  userId: bigint
  kuCode: string
  evidenceType: EvidenceType
  sessionId?: bigint
  messageId?: bigint
  evidenceText?: string
  metadata?: Record<string, unknown>
}

export interface EvidenceResult {
  kuCode: string
  evidenceType: EvidenceType
  oldScore: number
  newScore: number
  delta: number
  evidenceCount: number
}
