import crypto from 'crypto'
import type { ChunkConfig, ChunkResult, PageText } from './chunking.types'

const DEFAULT_WORDS_PER_CHUNK = 338  // ~450 tokens × (¾ words/token)
const DEFAULT_OVERLAP_WORDS   = 75   // ~100 tokens overlap

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 64)
}

function estimateTokens(wordCount: number): number {
  return Math.round(wordCount * 4 / 3)
}

/**
 * Split a single text string into overlapping word-level chunks.
 */
function chunkSingleText(text: string, config: Required<ChunkConfig>): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const chunks: string[] = []
  let start = 0

  while (start < words.length) {
    const slice = words.slice(start, start + config.wordsPerChunk)
    chunks.push(slice.join(' '))
    if (start + config.wordsPerChunk >= words.length) break
    start += config.wordsPerChunk - config.overlapWords
  }

  return chunks
}

/**
 * Chunk an array of pages into ChunkResult[].
 *
 * Each page is chunked independently so that every chunk
 * maps to exactly one page (pageNumber is preserved).
 * chunkIndex is globally sequential across all pages.
 */
export function chunkPages(
  pages: PageText[],
  config?: ChunkConfig,
): ChunkResult[] {
  const cfg: Required<ChunkConfig> = {
    wordsPerChunk: config?.wordsPerChunk ?? DEFAULT_WORDS_PER_CHUNK,
    overlapWords:  config?.overlapWords  ?? DEFAULT_OVERLAP_WORDS,
  }

  const results: ChunkResult[] = []
  let globalIndex = 0

  for (const page of pages) {
    if (!page.text.trim()) continue

    const textChunks = chunkSingleText(page.text, cfg)

    for (const chunkText of textChunks) {
      const wordCount = chunkText.split(/\s+/).length
      results.push({
        chunkIndex: globalIndex++,
        chunkText,
        chunkHash:   sha256(chunkText),
        tokenCount:  estimateTokens(wordCount),
        pageNumber:  page.pageNumber,
      })
    }
  }

  return results
}
