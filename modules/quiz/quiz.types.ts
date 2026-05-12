export interface QuizQuestion {
  id: string
  question: string
  choices: string[]
  correctIndex: number
  explanation: string
  kuCode: string
  sourceChunkIds: number[]
}

export interface GenerateQuizParams {
  userId: bigint
  kaCode?: string
  kuCode?: string
  documentIds?: bigint[]
  count?: number
}

export interface GenerateQuizResult {
  kaCode: string
  kuCode: string
  questions: QuizQuestion[]
}

export interface SubmitQuizParams {
  userId: bigint
  kaCode: string
  kuCode: string
  answers: { questionId: string; choiceIndex: number; correctIndex: number }[]
  sessionId?: bigint
}

export interface SubmitQuizResult {
  totalQuestions: number
  correctAnswers: number
  score: number
  attemptId: string
}
