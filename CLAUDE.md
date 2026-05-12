# CLAUDE.md

This file documents the actual implementation status and architecture of this repository.

---

## Project Overview

**Smart Assistant for Learners** is a curriculum-aware learning system that combines:

- Document upload (PDF/TXT)
- Retrieval-Augmented Generation (RAG) chat with citations
- IT taxonomy classification (KA/KU)
- Mastery tracking updated from chat/flashcard/quiz evidence

The runtime architecture is currently **Next.js API routes + shared TypeScript modules + PostgreSQL + Weaviate**.

---

## Commands

### Development

```bash
# Start frontend + worker command in parallel
npm run dev

# Next.js app only
npm run dev:web

# worker/index.ts only (currently placeholder)
npm run dev:worker
```

### Database

```bash
npm run prisma:generate
npm run prisma:migrate
npm run seed:taxonomy
```

### Frontend (from apps/web)

```bash
npm run build
npm run lint
```

### Worker (actual implemented worker entry)

```bash
npx tsx worker/parse-pdf.ts <documentId>
```

---

## Architecture

### Runtime Layout

```
apps/web/src/app/api/   → HTTP API surface (auth, chat, documents, mastery, quiz, flashcards)
modules/                → Core business logic (chat, retrieval, taxonomy, mastery, quiz, flashcards)
lib/                    → Infra helpers (Prisma, Weaviate, embeddings)
worker/                 → Standalone parse script (parse-pdf.ts)
prisma/schema.prisma    → DB schema
taxonomy/it.yaml        → IT KA/KU taxonomy source
```

### Core Stack

| Layer          | Current implementation                          |
| -------------- | ----------------------------------------------- |
| Frontend + API | Next.js 16 (App Router, route handlers)         |
| Language       | TypeScript                                      |
| LLM            | Anthropic Claude (`claude-haiku-4-5`)           |
| Embeddings     | `Xenova/bge-m3` via `@huggingface/transformers` |
| Vector DB      | Weaviate (`DocumentChunk` collection)           |
| Relational DB  | PostgreSQL + Prisma                             |
| Auth           | JWT cookie (`auth_token`)                       |

### Important Note About Placeholders

The following files exist but are currently empty placeholders:

- `lib/ai/llm.ts`
- `lib/ai/langgraph.ts`
- `lib/config/env.ts`
- `modules/documents/documents.service.ts`
- `worker/index.ts`

So, active RAG orchestration is in `modules/chat/chat.service.ts`, not in LangGraph.

---

## Implemented API Endpoints

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Chat

- `POST /api/chat`
  - Request: `multipart/form-data` (`question`, optional `sessionId`, repeated `documentIds`)
  - Behavior: create session if needed, store user message, run RAG, store assistant message + citations

### Sessions

- `GET /api/sessions`
- `GET /api/sessions/[id]`
- `DELETE /api/sessions/[id]`

### Documents

- `GET /api/documents`
- `POST /api/documents/upload`
- `POST /api/documents/reclassify`
- `GET /api/documents/[id]`
- `DELETE /api/documents/[id]`
- `GET /api/documents/[id]/file`

### Mastery

- `GET /api/mastery`

### Flashcards

- `POST /api/flashcards/generate`
- `POST /api/flashcards/review`

### Quiz

- `POST /api/quiz/generate`
- `POST /api/quiz/submit`

---

## 1) RAG Pipeline (Implemented)

Primary flow for `POST /api/chat`:

1. Validate user from JWT cookie.
2. Store incoming user message in `chat_messages`.
3. Classify question into KA/KU using Claude (`modules/taxonomy/taxonomy-classifier.ts`).
4. Retrieve chunks from Weaviate (`modules/retrieval/retrieval.service.ts`):
   - embed query with `Xenova/bge-m3`
   - KA-filtered search first
   - fallback to unfiltered semantic search if too few filtered hits
5. Keep top 4 chunks for generation context.
6. Generate final answer with Claude (`claude-haiku-4-5`) grounded on retrieved chunks.
7. Build and persist citations (`message_citations`).
8. Record chat-based mastery evidence when conditions are met.

Fallback behavior:

- If no chunks retrieved, system returns a safe “not found in materials” response.
- If mastery update fails, chat still returns answer (failure is logged, not fatal).

---

## 2) Document Ingestion Pipeline (Implemented)

### Main production path: `POST /api/documents/upload`

1. Validate user and file type (PDF/TXT).
2. Save file to disk under `uploads/`.
3. Create `documents` row with status `parsing`.
4. Extract page text:
   - PDF: `unpdf.extractText`
   - TXT: single page
5. Store page rows in `document_pages`.
6. Chunk text via `modules/chunking/chunk-text.ts`:
   - default ~338 words/chunk
   - overlap 75 words
7. Store chunk rows in `document_chunks`.
8. Classify each chunk into KA/KU (`classifyChunks`).
9. Update `taxonomyMetadata` in DB.
10. Embed + index chunks into Weaviate `DocumentChunk` collection.
11. Set document status to `indexed`.

### Secondary path: `worker/parse-pdf.ts`

- CLI parser exists and performs parse/chunk/index for an existing document.
- This script currently does **not** run taxonomy classification by default.

---

## 3) Mastery System Design (Implemented)

Mastery is evidence-driven and stored in:

- `mastery_evidence` (event log)
- `user_ku_mastery` (per-KU score)
- `user_mastery` (per-KA aggregate)

Update logic (`modules/mastery/update-mastery.ts`):

1. Resolve KU by `kuCode`.
2. Insert evidence record.
3. Update KU mastery: `newScore = clamp(old + delta, 0, 1)`.
4. Recompute KA mastery as average of KU scores for that KA.

Evidence weights (`modules/mastery/mastery.types.ts`):

- `chat_correct`: +0.03
- `chat_incorrect`: -0.02
- `flashcard_correct`: +0.05
- `flashcard_incorrect`: -0.02
- `quiz_correct`: +0.08
- `quiz_incorrect`: -0.03

Evidence producers currently wired:

- Chat: `recordChatEvidence`
- Flashcard review: `recordFlashcardEvidence`
- Quiz submit: `recordQuizEvidence` (per-answer)

---

## 4) Quiz and Flashcards (Implemented)

- Both modules retrieve user-specific chunks from Weaviate.
- Both generate content with Claude (`claude-haiku-4-5`).
- Both persist attempt history:
  - `quiz_attempts`
  - `flashcard_attempts`
- Both feed mastery update pipeline.

---

## Data Model Snapshot

Implemented core entities in `prisma/schema.prisma` include:

- Taxonomy: `Domain`, `KnowledgeArea`, `KnowledgeUnit`, `Topic`, `LearningOutcome`, `BokSource`
- User/auth: `User`
- Documents: `Document`, `DocumentPage`, `DocumentChunk`
- Chat: `ChatSession`, `ChatMessage`, `MessageCitation`
- Mastery: `MasteryEvidence`, `UserKuMastery`, `UserMastery`
- Assessment: `QuizAttempt`, `FlashcardAttempt`

---

## Environment Variables (Current)

```env
DATABASE_URL=postgresql://...
CLAUDE_API_KEY=...
WEAVIATE_URL=http://localhost:8080
JWT_SECRET=change-me
NODE_ENV=development
```

Notes:

- `WEAVIATE_API_KEY` is not currently used by `lib/ai/weaviate.ts`.
- If `JWT_SECRET` is missing, code falls back to a dev default secret.

---

## Current Status Summary

- Core MVP features are implemented: auth, upload+index, RAG chat, citations, mastery dashboard, quiz, flashcards.
- Some infra files remain placeholders (`llm.ts`, `langgraph.ts`, `env.ts`, etc.).
- Worker entrypoint in npm script references `worker/index.ts` (placeholder), while functional parser is `worker/parse-pdf.ts`.
