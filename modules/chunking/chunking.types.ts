export interface ChunkResult {
  chunkIndex: number
  chunkText: string
  chunkHash: string
  tokenCount: number
  /** 1-based page number this chunk belongs to */
  pageNumber: number
}

export interface ExcerptResult {
  /** Short excerpt for citation display */
  excerpt: string
  /** Start character offset in the full chunk text */
  startOffset: number
  /** End character offset in the full chunk text */
  endOffset: number
}

export interface PageText {
  pageNumber: number
  text: string
}

export interface ChunkConfig {
  /** Target words per chunk (default: 338 ≈ 450 tokens) */
  wordsPerChunk?: number
  /** Overlap words between chunks (default: 75 ≈ 100 tokens) */
  overlapWords?: number
}

export interface ExcerptConfig {
  /** Max characters for the excerpt (default: 200) */
  maxLength?: number
}
