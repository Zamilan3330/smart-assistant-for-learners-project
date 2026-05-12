export interface Citation {
  source: string
  excerpt: string
  page: number
  documentId: bigint
  chunkId: bigint
}

export interface ChatParams {
  question: string
  userId: bigint
  sessionId: bigint
  documentIds?: bigint[]
}

export interface ChatResult {
  answer: string
  citations: Citation[]
  kaCode: string
  kuCode: string
}
