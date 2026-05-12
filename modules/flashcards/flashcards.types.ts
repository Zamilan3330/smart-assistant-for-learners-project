export type FlashcardRating = 'again' | 'hard' | 'good' | 'easy'

export interface Flashcard {
  id: string
  front: string
  back: string
  hint?: string
  kuCode: string
  sourceChunkIds: number[]
}

export interface GenerateFlashcardsParams {
  userId: bigint
  kaCode?: string
  kuCode?: string
  documentIds?: bigint[]
  count?: number
}

export interface GenerateFlashcardsResult {
  kaCode: string
  kuCode: string
  cards: Flashcard[]
}

export interface ReviewFlashcardParams {
  userId: bigint
  kaCode: string
  kuCode: string
  front: string
  back: string
  rating: FlashcardRating
  sessionId?: bigint
}

export interface ReviewFlashcardResult {
  attemptId: string
  isCorrect: boolean
  nextIntervalDays: number
  dueDate: string
  easeFactor: number
  repetitions: number
}
