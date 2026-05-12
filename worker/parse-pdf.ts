/**
 * worker/parse-pdf.ts
 *
 * Document parsing worker — reads a file from disk (PDF or plain text),
 * extracts text per page, chunks each page, and stores results in
 * document_pages + document_chunks tables.
 *
 * Pipeline:
 *   1. Read file from disk (storage_path)
 *   2. Extract text per page (unpdf for PDF, utf-8 for plain text)
 *   3. Chunk pages → modules/chunking/chunk-text.ts
 *   4. Store pages + chunks in DB
 *   5. Update document status
 *
 * Usage:
 *   npx tsx worker/parse-pdf.ts <documentId>
 */

import fs from "fs/promises";
import { extractText } from "unpdf";
import { prisma } from "../lib/db/prisma";
import { chunkPages } from "../modules/chunking/chunk-text";
import type { PageText } from "../modules/chunking/chunking.types";
import { indexChunks } from "../modules/retrieval/retrieval.service";
import type { ChunkToIndex } from "../modules/retrieval/retrieval.types";

// ---------------------------------------------------------------------------
// Main parse function
// ---------------------------------------------------------------------------

export async function parseDocument(documentId: bigint): Promise<{
  pageCount: number;
  chunkCount: number;
}> {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
  });

  if (!doc) throw new Error(`Document ${documentId} not found`);
  if (!doc.storagePath)
    throw new Error(`Document ${documentId} has no storage path`);

  // Update status → parsing
  await prisma.document.update({
    where: { id: doc.id },
    data: { status: "parsing", errorMessage: null },
  });

  try {
    const buffer = await fs.readFile(doc.storagePath);

    // ------------------------------------------------------------------
    // Step 1: Extract text per page
    // ------------------------------------------------------------------
    const pageTexts: PageText[] = [];

    if (doc.sourceType === "pdf") {
      const { totalPages, text } = await extractText(new Uint8Array(buffer));
      const texts = (text as string[]).map((t) => t.trim()).filter(Boolean);

      for (let i = 0; i < texts.length; i++) {
        pageTexts.push({ pageNumber: i + 1, text: texts[i] });
      }

      // Use totalPages for the count even if some pages had no text
      void totalPages;
    } else {
      // Plain text — single page
      pageTexts.push({ pageNumber: 1, text: buffer.toString("utf-8") });
    }

    // ------------------------------------------------------------------
    // Step 2: Save pages to DB
    // ------------------------------------------------------------------
    const pageIdMap = new Map<number, bigint>(); // pageNumber → DB id

    for (const pt of pageTexts) {
      const page = await prisma.documentPage.create({
        data: {
          documentId: doc.id,
          pageNumber: pt.pageNumber,
          extractedText: pt.text,
        },
      });
      pageIdMap.set(pt.pageNumber, page.id);
    }

    // ------------------------------------------------------------------
    // Step 3: Chunk pages (modules/chunking/chunk-text.ts)
    // ------------------------------------------------------------------
    const chunks = chunkPages(pageTexts);

    // ------------------------------------------------------------------
    // Step 4: Save chunks to DB
    // ------------------------------------------------------------------
    for (const chunk of chunks) {
      await prisma.documentChunk.create({
        data: {
          documentId: doc.id,
          pageId: pageIdMap.get(chunk.pageNumber) ?? null,
          pageNumber: chunk.pageNumber,
          chunkIndex: chunk.chunkIndex,
          chunkText: chunk.chunkText,
          chunkHash: chunk.chunkHash,
          tokenCount: chunk.tokenCount,
          taxonomyMetadata: {},
        },
      });
    }

    // ------------------------------------------------------------------
    // Step 5: Embed + index chunks to Weaviate
    // ------------------------------------------------------------------
    const savedChunks = await prisma.documentChunk.findMany({
      where: { documentId: doc.id },
    });

    const chunksToIndex: ChunkToIndex[] = savedChunks.map((sc) => ({
      chunkId: sc.id,
      documentId: doc.id,
      userId: doc.userId,
      documentTitle: doc.title,
      sourceType: doc.sourceType,
      pageNumber: sc.pageNumber ?? 0,
      chunkIndex: sc.chunkIndex,
      text: sc.chunkText,
    }));

    await indexChunks({ chunks: chunksToIndex });

    // ------------------------------------------------------------------
    // Step 6: Update status → indexed
    // ------------------------------------------------------------------
    await prisma.document.update({
      where: { id: doc.id },
      data: { status: "indexed", errorMessage: null },
    });

    return { pageCount: pageTexts.length, chunkCount: chunks.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Parse failed";
    await prisma.document.update({
      where: { id: doc.id },
      data: { status: "error", errorMessage: message },
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// CLI: npx tsx worker/parse-pdf.ts <documentId>
// ---------------------------------------------------------------------------

const docIdArg = process.argv[2];

if (docIdArg) {
  parseDocument(BigInt(docIdArg))
    .then(({ pageCount, chunkCount }) => {
      console.log(`Done: ${pageCount} pages, ${chunkCount} chunks`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Parse failed:", err.message);
      process.exit(1);
    });
}
