/**
 * modules/retrieval/retrieval.types.ts
 *
 * Type definitions for the retrieval / indexing layer.
 */

export interface ChunkToIndex {
  chunkId: bigint
  documentId: bigint
  userId: bigint
  documentTitle: string
  sourceType: string
  pageNumber: number
  chunkIndex: number
  text: string
  knowledgeAreaCode?: string
  knowledgeUnitCode?: string
}

export interface IndexChunksParams {
  chunks: ChunkToIndex[]
  batchSize?: number
}

export interface SearchParams {
  question: string
  userId: bigint
  kaCode?: string        // from question classification — used for soft narrowing
  documentIds?: bigint[] // optional: restrict to specific documents
  limit?: number
}

export interface SearchResult {
  chunkId: number
  documentId: number
  documentTitle: string
  pageNumber: number
  text: string
  knowledgeAreaCode: string
  knowledgeUnitCode: string
  score: number          // cosine similarity (0–1)
}
