import type { ExcerptConfig, ExcerptResult } from './chunking.types'

const DEFAULT_MAX_LENGTH = 200

/**
 * Build a citation excerpt from a chunk of text.
 *
 * Finds the most relevant portion of the chunk text that
 * matches or is closest to the query, and returns a trimmed
 * excerpt suitable for citation display.
 *
 * If no query is provided, returns the first `maxLength` characters.
 */
export function buildExcerpt(
  chunkText: string,
  query?: string,
  config?: ExcerptConfig,
): ExcerptResult {
  const maxLen = config?.maxLength ?? DEFAULT_MAX_LENGTH

  if (!query?.trim()) {
    return extractFromOffset(chunkText, 0, maxLen)
  }

  // Find the best matching position in the chunk
  const lowerChunk = chunkText.toLowerCase()
  const queryWords = query.toLowerCase().split(/\s+/).filter(Boolean)

  // Try to find the position with the most query word matches nearby
  let bestOffset = 0
  let bestScore  = -1

  // Slide a window across the chunk
  const windowSize = maxLen
  const step = Math.max(1, Math.floor(windowSize / 4))

  for (let i = 0; i < lowerChunk.length; i += step) {
    const window = lowerChunk.slice(i, i + windowSize)
    let score = 0
    for (const word of queryWords) {
      if (word.length >= 2 && window.includes(word)) {
        score += word.length // longer matches = higher score
      }
    }
    if (score > bestScore) {
      bestScore  = score
      bestOffset = i
    }
  }

  return extractFromOffset(chunkText, bestOffset, maxLen)
}

/**
 * Extract an excerpt starting near the given offset,
 * snapping to word boundaries with ellipsis if needed.
 */
function extractFromOffset(
  text: string,
  offset: number,
  maxLen: number,
): ExcerptResult {
  // Snap start to a word boundary (go back to nearest space)
  let start = offset
  if (start > 0) {
    const spaceIdx = text.lastIndexOf(' ', start)
    if (spaceIdx > start - 30) start = spaceIdx + 1
  }

  let end = Math.min(text.length, start + maxLen)

  // Snap end to a word boundary
  if (end < text.length) {
    const spaceIdx = text.indexOf(' ', end)
    if (spaceIdx !== -1 && spaceIdx < end + 20) {
      end = spaceIdx
    }
  }

  let excerpt = text.slice(start, end).trim()

  // Add ellipsis
  if (start > 0) excerpt = '...' + excerpt
  if (end < text.length) excerpt = excerpt + '...'

  return {
    excerpt,
    startOffset: start,
    endOffset:   end,
  }
}

/**
 * Build excerpts for multiple chunks, returning the best
 * excerpt for each chunk relative to the query.
 */
export function buildExcerpts(
  chunks: { chunkText: string }[],
  query?: string,
  config?: ExcerptConfig,
): ExcerptResult[] {
  return chunks.map((c) => buildExcerpt(c.chunkText, query, config))
}
