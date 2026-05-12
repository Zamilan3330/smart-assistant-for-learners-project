/**
 * lib/ai/embeddings.ts
 *
 * BAAI/bge-m3 local CPU embedding using @xenova/transformers.
 * Singleton model loading — first call downloads ~600 MB, subsequent calls use cache.
 * Output: 1024-dimensional dense vectors, multilingual (MN + EN).
 */

import { pipeline } from "@huggingface/transformers";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let extractor: any = null;

async function getExtractor() {
  if (!extractor) {
    extractor = await pipeline("feature-extraction", "Xenova/bge-m3", {
      quantized: false,
    });
  }
  return extractor;
}

/**
 * Embed a single text string → 1024-dim float array.
 */
export async function embedText(text: string): Promise<number[]> {
  const ext = await getExtractor();
  const output = await ext(text, { pooling: "cls", normalize: true });
  return Array.from(output.data as Float32Array).slice(0, 1024);
}

/**
 * Embed multiple texts in batches.
 * Returns one 1024-dim vector per input text, in the same order.
 */
export async function embedBatch(
  texts: string[],
  batchSize = 4,
): Promise<number[][]> {
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(embedText));
    results.push(...batchResults);
  }

  return results;
}
