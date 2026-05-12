/**
 * modules/quiz/quiz-evaluator.ts
 *
 * Thin wrapper used by the quiz UI to grade a single multiple-choice answer.
 * Kept separate from quiz.service so the frontend can pre-check feedback
 * before submitting the whole attempt.
 */

export interface EvaluateAnswerParams {
  choiceIndex: number
  correctIndex: number
}

export interface EvaluateAnswerResult {
  isCorrect: boolean
}

export function evaluateMultipleChoice(params: EvaluateAnswerParams): EvaluateAnswerResult {
  return { isCorrect: params.choiceIndex === params.correctIndex }
}
