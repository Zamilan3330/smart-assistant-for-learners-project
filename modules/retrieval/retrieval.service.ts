/**
 * modules/retrieval/retrieval.service.ts
 *
 * indexChunks()          — batch embed + insert chunks into Weaviate
 * deleteDocumentChunks() — remove all chunks for a document from Weaviate
 */

import { embedText, embedBatch } from '../../lib/ai/embeddings'
import { Filters } from 'weaviate-client'
import {
  getWeaviateClient,
  ensureChunkCollection,
  COLLECTION_NAME,
} from '../../lib/ai/weaviate'
import type { IndexChunksParams, SearchParams, SearchResult } from './retrieval.types'

/**
 * Embed an array of chunks and insert them into Weaviate.
 */
export async function indexChunks({
  chunks,
  batchSize = 4,
}: IndexChunksParams): Promise<void> {
  if (chunks.length === 0) return

  await ensureChunkCollection()

  // Embed all chunk texts
  const texts = chunks.map((c) => c.text)
  const vectors = await embedBatch(texts, batchSize)

  // Batch insert into Weaviate
  const wv = await getWeaviateClient()
  const collection = wv.collections.get(COLLECTION_NAME)

  const objects = chunks.map((chunk, i) => ({
    properties: {
      chunkId: Number(chunk.chunkId),
      documentId: Number(chunk.documentId),
      userId: Number(chunk.userId),
      documentTitle: chunk.documentTitle,
      sourceType: chunk.sourceType,
      pageNumber: chunk.pageNumber,
      chunkIndex: chunk.chunkIndex,
      text: chunk.text,
      knowledgeAreaCode: chunk.knowledgeAreaCode ?? '',
      knowledgeUnitCode: chunk.knowledgeUnitCode ?? '',
    },
    vectors: vectors[i],
  }))

  const result = await collection.data.insertMany(objects)

  if (result.hasErrors) {
    const errors = Object.values(result.errors)
    console.error(`[retrieval] Weaviate insert errors:`, errors.slice(0, 3))
    throw new Error(
      `Failed to index ${errors.length}/${chunks.length} chunks to Weaviate`,
    )
  }
}

/**
 * Search chunks by semantic similarity with optional KA soft-narrowing.
 *
 * Strategy:
 *   1. If kaCode provided → try filtered search first (keeps taxonomy signal)
 *   2. If filtered results < MIN_FILTERED → fall back to unfiltered search
 *   3. Return top `limit` results
 */
export async function searchChunks(params: SearchParams): Promise<SearchResult[]> {
  const { question, userId, kaCode, documentIds, limit = 8 } = params
  const MIN_FILTERED = 2  // if KA-filtered returns fewer than this, fall back

  await ensureChunkCollection()
  const wv = await getWeaviateClient()
  const collection = wv.collections.get(COLLECTION_NAME)

  const queryVector = await embedText(question)

  // Build base filters
  const buildFilters = (withKA: boolean) => {
    const userFilter = collection.filter.byProperty('userId').equal(Number(userId))

    const extras: ReturnType<typeof collection.filter.byProperty>[] = []

    if (documentIds && documentIds.length > 0) {
      extras.push(collection.filter.byProperty('documentId').containsAny(documentIds.map(Number)))
    }

    if (withKA && kaCode) {
      extras.push(collection.filter.byProperty('knowledgeAreaCode').equal(kaCode))
    }

    if (extras.length === 0) return userFilter
    return Filters.and(userFilter, ...extras)
  }

  const toResults = (objects: Awaited<ReturnType<typeof collection.query.nearVector>>['objects']): SearchResult[] =>
    objects.map((o) => ({
      chunkId:           Number(o.properties.chunkId),
      documentId:        Number(o.properties.documentId),
      documentTitle:     String(o.properties.documentTitle),
      pageNumber:        Number(o.properties.pageNumber),
      text:              String(o.properties.text),
      knowledgeAreaCode: String(o.properties.knowledgeAreaCode ?? ''),
      knowledgeUnitCode: String(o.properties.knowledgeUnitCode ?? ''),
      score:             o.metadata?.score ?? 0,
    }))

  // Step 1: try KA-filtered search
  if (kaCode) {
    const filtered = await collection.query.nearVector(queryVector, {
      limit,
      returnMetadata: ['score'],
      filters: buildFilters(true),
      targetVector: 'default',
    })

    if (filtered.objects.length >= MIN_FILTERED) {
      return toResults(filtered.objects)
    }

    console.log(`[retrieval] KA filter (${kaCode}) returned ${filtered.objects.length} results — falling back to unfiltered`)
  }

  // Step 2: unfiltered fallback
  const unfiltered = await collection.query.nearVector(queryVector, {
    limit,
    returnMetadata: ['score'],
    filters: buildFilters(false),
    targetVector: 'default',
  })

  return toResults(unfiltered.objects)
}

/**
 * Delete all Weaviate objects belonging to a given document.
 */
export async function deleteDocumentChunks(
  documentId: bigint,
): Promise<void> {
  await ensureChunkCollection()
  const wv = await getWeaviateClient()
  const collection = wv.collections.get(COLLECTION_NAME)

  await collection.data.deleteMany(
    collection.filter.byProperty('documentId').equal(Number(documentId)),
  )
}
