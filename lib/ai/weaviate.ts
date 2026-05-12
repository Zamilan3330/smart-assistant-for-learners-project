/**
 * lib/ai/weaviate.ts
 *
 * Weaviate client singleton + DocumentChunk collection setup.
 * Uses weaviate-client v3 with connectToLocal().
 * Vectorizer: none (we supply vectors externally via embeddings.ts).
 */

import weaviate, {
  type WeaviateClient,
  vectorDistances,
  dataType,
  tokenization,
} from 'weaviate-client'

const COLLECTION_NAME = 'DocumentChunk'

let client: WeaviateClient | null = null

/**
 * Get or create the Weaviate client singleton.
 */
export async function getWeaviateClient(): Promise<WeaviateClient> {
  if (!client) {
    const url = process.env.WEAVIATE_URL || 'http://localhost:8080'
    const parsed = new URL(url)

    client = await weaviate.connectToLocal({
      host: parsed.hostname,
      port: Number(parsed.port) || 8080,
    })
  }
  return client
}

/**
 * Ensure the DocumentChunk collection exists with the correct schema.
 * Safe to call multiple times — skips creation if collection already exists.
 */
export async function ensureChunkCollection(): Promise<void> {
  const wv = await getWeaviateClient()
  const exists = await wv.collections.exists(COLLECTION_NAME)

  if (exists) return

  await wv.collections.create({
    name: COLLECTION_NAME,
    vectorizers: weaviate.configure.vectorizer.none({
      vectorIndexConfig: weaviate.configure.vectorIndex.hnsw({
        distanceMetric: vectorDistances.COSINE,
      }),
    }),
    properties: [
      { name: 'chunkId', dataType: dataType.INT },
      { name: 'documentId', dataType: dataType.INT },
      { name: 'userId', dataType: dataType.INT },
      { name: 'documentTitle', dataType: dataType.TEXT, tokenization: tokenization.WORD },
      { name: 'sourceType', dataType: dataType.TEXT, tokenization: tokenization.FIELD },
      { name: 'pageNumber', dataType: dataType.INT },
      { name: 'chunkIndex', dataType: dataType.INT },
      { name: 'text', dataType: dataType.TEXT, tokenization: tokenization.WORD },
      { name: 'knowledgeAreaCode', dataType: dataType.TEXT, tokenization: tokenization.FIELD },
      { name: 'knowledgeUnitCode', dataType: dataType.TEXT, tokenization: tokenization.FIELD },
    ],
  })
}

export { COLLECTION_NAME }
