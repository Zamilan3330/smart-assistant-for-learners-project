# LLM Implementation Guide

**Smart Assistant for Learners (RAG + Taxonomy + Mastery System)**
Version: 1.0
Audience: AI / Backend Implementation Agent

# 1. PURPOSE

This document defines **everything the AI agent needs to implement the system end-to-end**.

The system is a:

> **Curriculum-aware, citation-grounded, personalized RAG learning assistant**

The AI must:

- ingest documents
- understand curriculum structure (KA/KU)
- answer questions using user sources
- provide citations
- track user mastery

# 2. SYSTEM CORE PRINCIPLES

## 2.1 Source-grounded answers

LLM must:

- prioritize user uploaded sources
- avoid hallucination
- explicitly say when information is missing

## 2.2 Retrieval-first architecture

```text
LLM ≠ knowledge source
LLM = reasoning + explanation engine
```

Knowledge comes from:

- document_chunks (Weaviate)

## 2.3 Curriculum awareness

Every question and chunk must be mapped to:

```text
Knowledge Area (KA)
Knowledge Unit (KU)
```

## 2.4 Personalization

System tracks:

```text
user → KU mastery → KA mastery
```

# 3. SYSTEM COMPONENTS

## 3.1 Data Sources

- PDF documents
- plain text
- (future: audio → STT)

## 3.2 Storage

### PostgreSQL (Prisma)

Source of truth:

- documents
- chunks
- chat history
- mastery
- taxonomy

### Weaviate

Vector search:

- embeddings
- retrieval metadata

## 3.3 AI Stack

### Embedding

```text
BAAI/bge-m3 (local CPU)
```

### LLM

```text
Anthropic Claude (claude-haiku-4-5)
```

### Orchestration

```text
Custom RAG service (modules/chat/chat.service.ts)
```

# 4. DATA MODEL (IMPORTANT)

## 4.1 Document

```json
{
  "id": "doc_id",
  "user_id": "user_id",
  "title": "Operating Systems",
  "source_type": "pdf",
  "file_path": "/uploads/os.pdf"
}
```

## 4.2 Chunk

```json
{
  "id": "chunk_id",
  "document_id": "doc_id",
  "page_number": 12,
  "chunk_index": 3,
  "text": "Process scheduling determines...",
  "ka_code": "KA-OS",
  "ku_code": "KU-SCHEDULING"
}
```

## 4.3 Chat Message

```json
{
  "id": "msg_id",
  "user_id": "user_id",
  "question": "...",
  "answer": "...",
  "ka_code": "...",
  "ku_code": "..."
}
```

## 4.4 Citation

```json
{
  "message_id": "msg_id",
  "document_id": "doc_id",
  "chunk_id": "chunk_id",
  "excerpt": "...",
  "page_number": 12
}
```

## 4.5 Mastery

```json
{
  "user_id": "user_id",
  "knowledge_unit_id": "...",
  "score": 0.65
}
```

# 5. DOCUMENT INGESTION PIPELINE

## Step 1: Upload

```text
User uploads PDF
```

Save:

- file → filesystem
- metadata → DB

## Step 2: Parse PDF

Extract:

```text
page → text
```

Store in:

- document_pages

## Step 3: Chunking

Rules:

```text
chunk size: ~450 tokens
overlap: 100 tokens
```

Output:

- document_chunks

## Step 4: Embedding (IMPORTANT)

### Requirements

- streaming processing
- batch embedding

### Process

```text
for each page:
    split into chunks
    batch embed chunks (size=4)
    store vectors
```

## Step 5: Index to Weaviate

Store:

```json
{
  "chunkId": "...",
  "documentId": "...",
  "userId": "...",
  "text": "...",
  "pageNumber": 12,
  "ka_code": "...",
  "ku_code": "..."
}
```

# 6. QUESTION PROCESSING PIPELINE

## Step 1: User asks question

```text
"What is normalization?"
```

## Step 2: Classification (KA/KU)

LLM must output:

```json
{
  "ka_code": "KA-DATABASE",
  "ku_code": "KU-NORMALIZATION"
}
```

## Step 3: Query Embedding

```text
embed(question)
```

## Step 4: Retrieval

Weaviate search:

```text
top_k = 8
filter:
  user_id
  (optional: ka_code)
```

## Step 5: Context Building

Select:

```text
top 4 chunks
```

## Step 6: Answer Generation

### Prompt rules

LLM must:

- use provided context
- cite sources
- not invent facts
- explain clearly

### Prompt template

```text
You are an AI tutor.

Use ONLY the provided context.

If answer not found, say "Not found in provided materials".

Context:
{chunks}

Question:
{question}

Answer:
```

## Step 7: Citation Generation

For each used chunk:

```json
{
  "source": "Operating Systems",
  "excerpt": "...",
  "page": 12
}
```

## Step 8: Save Chat

Insert:

- chat_messages
- message_citations

## Step 9: Mastery Update

Update:

```text
KU score += small delta
KA aggregated
```

# 7. MASTERy SYSTEM

## Evidence Sources

| Type      | Weight |
| --------- | ------ |
| Chat      | Low    |
| Flashcard | Medium |
| Quiz      | High   |

## Update Logic

Example:

```text
if correct explanation:
    +0.03

if wrong:
    -0.02
```

## Aggregation

```text
KA score = avg(KU scores)
```

# 8. CUSTOM RAG FLOW

```text
START
  ↓
classify_question
  ↓
retrieve_chunks
  ↓
generate_answer
  ↓
build_citations
  ↓
update_mastery
  ↓
END
```

# 9. API CONTRACTS

## POST /chat

Request:

```json
{
  "question": "What is normalization?"
}
```

Response:

```json
{
  "answer": "...",
  "citations": [
    {
      "source": "...",
      "excerpt": "...",
      "page": 12
    }
  ]
}
```

# 10. ENV CONFIG

```env
CLAUDE_API_KEY=
DATABASE_URL=
WEAVIATE_URL=
```

# 11. NON-FUNCTIONAL REQUIREMENTS

## Performance

- embedding async
- retrieval < 500ms
- answer < 3s

## Reliability

- no hallucination
- source-grounded answers
- reproducible results

## Scalability

Future support:

- queue (BullMQ)
- reranker
- multi-user

# 12. FUTURE FEATURES

## Audio ingestion

```text
audio → STT → text → chunk → embed
```

## Reranking

```text
top 20 → reranker → top 5
```

## Quiz system

- generate questions
- evaluate answers
- update mastery

# 13. IMPLEMENTATION ORDER

1. Prisma schema
2. taxonomy seed
3. document upload
4. PDF parsing
5. chunking
6. embedding
7. Weaviate indexing
8. classification
9. retrieval
10. answer generation
11. citations
12. mastery
13. dashboard

# 14. FINAL GOAL

The system must achieve:

```text
Upload document
→ Ask question
→ Get correct answer
→ See citation
→ Track learning progress
```

# 15. SUMMARY

This system combines:

- RAG
- taxonomy
- personalization
- AI tutoring

to build a:

> **Smart Learning Assistant powered by AI**
