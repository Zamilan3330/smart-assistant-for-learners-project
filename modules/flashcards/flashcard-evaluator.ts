/**
 * modules/flashcards/flashcard-evaluator.ts
 *
 * Maps the user's self-rating on a flashcard to a mastery evidence outcome.
 * "again" counts as incorrect (re-show soon); everything else counts as
 * correct but with different next-interval durations.
 */

import type { FlashcardRating } from './flashcards.types'

export interface EvaluatedRating {
  isCorrect: boolean
  confidence: number
}

const CONFIDENCE: Record<FlashcardRating, number> = {
  again: 0.2,
  hard: 0.5,
  good: 0.8,
  easy: 1.0,
}

export function evaluateRating(rating: FlashcardRating): EvaluatedRating {
  return {
    isCorrect: rating !== 'again',
    confidence: CONFIDENCE[rating],
  }
}
