/**
 * modules/chat/chat.service.ts
 *
 * RAG pipeline:
 *   1. Classify question → KA/KU
 *   2. Semantic search with soft KA narrowing
 *   3. Generate answer with Claude (grounded in retrieved chunks)
 *   4. Build citations
 */

import Anthropic from "@anthropic-ai/sdk";
import { classifyChunk } from "../taxonomy/taxonomy-classifier";
import { recordChatEvidence } from "../mastery/mastery.service";
import { searchChunks } from "../retrieval/retrieval.service";
import type { ChatParams, ChatResult, Citation } from "./chat.types";

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey) throw new Error("CLAUDE_API_KEY is not set");
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

const TOP_K = 4; // chunks passed to LLM after retrieval

export async function answerQuestion(params: ChatParams): Promise<ChatResult> {
  const { question, userId, documentIds } = params;

  // ── Step 1: Classify question ────────────────────────────────────────────
  const { kaCode, kuCode } = await classifyChunk(question);
  console.log(
    `[chat] question classified → KA: ${kaCode || "none"}, KU: ${kuCode || "none"}`,
  );

  // ── Step 2: Retrieve relevant chunks (soft KA narrowing) ─────────────────
  const chunks = await searchChunks({
    question,
    userId,
    kaCode: kaCode || undefined,
    documentIds,
    limit: 8,
  });

  // Pick top K by score
  const topChunks = chunks.slice(0, TOP_K);

  if (topChunks.length === 0) {
    return {
      answer: "Таны асуулттай холбоотой мэдээлэл баримт бичгүүдээс олдсонгүй.",
      citations: [],
      kaCode,
      kuCode,
    };
  }

  // ── Step 3: Build context for prompt ────────────────────────────────────
  const context = topChunks
    .map(
      (c, i) =>
        `[${i + 1}] "${c.documentTitle}" (хуудас ${c.pageNumber}):\n${c.text}`,
    )
    .join("\n\n---\n\n");

  const systemPrompt = `Та суралцагчдад туслах AI зааварлагчийн үүрэгтэй.
Доорх эх сурвалжуудад тулгуурлан хэрэглэгчийн асуултад хариулна уу.
Хариултдаа заавал [1], [2] гэх мэт эх сурвалжийн дугааруудыг иш татаж хэрэглэнэ үү.
Эх сурвалжид байхгүй мэдээллийг нэмж оруулахгүй байна.

Эх сурвалжууд:
${context}`;

  // ── Step 4: Generate answer ──────────────────────────────────────────────
  const response = await getClient().messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: question }],
  });

  const textBlock = response.content.find(
    (b): b is Anthropic.TextBlock => b.type === "text",
  );
  const answer = textBlock?.text ?? "Хариулт үүсгэхэд алдаа гарлаа.";

  // ── Step 5: Build citations ──────────────────────────────────────────────
  const citations: Citation[] = topChunks.map((c) => ({
    source: c.documentTitle,
    excerpt: c.text.slice(0, 200).replace(/\n/g, " "),
    page: c.pageNumber,
    documentId: BigInt(c.documentId),
    chunkId: BigInt(c.chunkId),
  }));

  // ── Step 6: Record chat evidence for mastery tracking ───────────────────
  try {
    await recordChatEvidence({
      userId,
      kuCode,
      answer,
      hasCitations: citations.length > 0,
      sessionId: params.sessionId,
    });
  } catch (err) {
    console.error("[chat] mastery update failed:", err);
  }

  return { answer, citations, kaCode, kuCode };
}
