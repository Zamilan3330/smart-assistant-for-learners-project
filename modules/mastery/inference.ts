/**
 * modules/mastery/inference.ts
 *
 * Rule-based evidence inference from chat interactions.
 * Diploma thesis §1.5.6 classifies chat as "low-weight evidence": present but
 * not as reliable as flashcard/quiz. We only attribute evidence when we can
 * be confident the interaction was grounded.
 */

import type { EvidenceType } from './mastery.types'

export interface ChatInferenceInput {
  answer: string
  hasCitations: boolean
}

const HEDGE_PATTERNS = [
  /мэдэхгүй/i,
  /тодорхойгүй/i,
  /олдсонгүй/i,
  /хангалттай\s+мэдээлэл\s+алга/i,
  /баримт\s+бичгүүд(ээс)?\s+олдсонгүй/i,
]

/**
 * Infer chat-evidence type from an answered question.
 * Returns null when the interaction cannot be attributed as evidence.
 */
export function inferChatEvidence(
  input: ChatInferenceInput,
): Extract<EvidenceType, 'chat_correct' | 'chat_incorrect'> | null {
  if (!input.hasCitations) return null

  if (HEDGE_PATTERNS.some((p) => p.test(input.answer))) {
    return 'chat_incorrect'
  }
  return 'chat_correct'
}
