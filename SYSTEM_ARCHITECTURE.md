# Smart Assistant for Learners

**Architecture & System Design Document (MVP)**
Version: 1.0
Purpose: Diploma System Architecture Specification

---

# 1. System Overview

## 1.1 Goal

The goal of this system is to build a **curriculum-aware AI learning assistant** that helps students understand learning materials using:

- Retrieval Augmented Generation (RAG)
- Knowledge taxonomy (BOK / Knowledge Areas / Knowledge Units)
- Source-grounded answers with citations
- Personalized mastery tracking

The system allows learners to upload learning materials (PDF / text) and interact with an AI tutor that answers questions **using the uploaded sources**.

---

# 2. Core Concept

The system is **not a generic chatbot**.

It is a **curriculum-aware RAG learning assistant** that:

1. Uses **user documents as knowledge source**
2. Classifies questions into **Knowledge Area (KA) and Knowledge Unit (KU)**
3. Retrieves relevant content using **vector search**
4. Generates answers with **citations**
5. Tracks **user learning mastery**

---

# 3. High Level Architecture

```
User
 │
 ▼
Next.js Web App
 │
 │ API
 ▼
Application Layer
 │
 ├─ Chat Service
 ├─ Retrieval Service
 ├─ Taxonomy Classifier
 ├─ Mastery Engine
 │
 ▼
Worker (Document Processing)
 │
 ├─ PDF Parsing
 ├─ Chunking
 ├─ Embedding
 └─ Weaviate Indexing
 │
 ▼
Storage Layer
 │
 ├─ PostgreSQL (Prisma ORM)
 ├─ Weaviate (Vector DB)
 └─ Local File Storage
```

---

# 4. Technology Stack

## 4.1 Frontend

- Next.js
- React
- TypeScript

Purpose:

- Chat interface
- Document upload
- Citation viewer
- Mastery dashboard

Location:

```
apps/web
```

---

## 4.2 Backend

Runtime:

- Node.js
- TypeScript

Structure:

```
modules/
```

Main backend modules:

| Module     | Purpose                 |
| ---------- | ----------------------- |
| chat       | RAG orchestration       |
| documents  | document storage logic  |
| retrieval  | vector search           |
| taxonomy   | KA/KU classification    |
| mastery    | learning progress logic |
| quiz       | assessment              |
| flashcards | spaced repetition       |

---

## 4.3 Database

Relational database:

- PostgreSQL

ORM:

- Prisma

Stores:

- documents
- chunks
- chat messages
- mastery scores
- taxonomy data

---

## 4.4 Vector Database

Vector search engine:

- Weaviate

Purpose:

- semantic search
- chunk retrieval

Stores:

- embeddings
- retrieval metadata

---

## 4.5 Embedding Model

Embedding model:

```
BAAI/bge-m3
```

Execution mode:

```
local CPU inference
```

Reason:

- multilingual
- high quality retrieval
- works with Mongolian + English
- no API cost

Embedding dimension:

```
1024
```

---

## 4.6 LLM Provider

Answer generation:

```
Anthropic Claude (claude-haiku-4-5)
```

Used for:

- question answering
- taxonomy classification
- tutoring explanation

---

## 4.7 AI Orchestration

Framework:

```
Custom RAG service (modules/chat/chat.service.ts)
```

Purpose:

- multi-step reasoning pipeline
- RAG orchestration handled inside modules/chat/chat.service.ts

---

# 5. Project Structure

```
project/
├─ apps/
│  └─ web/
│     ├─ public
│     └─ src
│        ├─ app
│        ├─ components
│        ├─ features
│        ├─ lib
│        └─ types
│
├─ modules
│  ├─ chat
│  ├─ chunking
│  ├─ documents
│  ├─ flashcards
│  ├─ mastery
│  ├─ quiz
│  ├─ retrieval
│  └─ taxonomy
│
├─ worker
│  ├─ index.ts
│  ├─ parse-pdf.ts
│  ├─ chunk-document.ts
│  └─ embed-index.ts
│
├─ lib
│  ├─ ai
│  ├─ db
│  ├─ config
│  └─ utils
│
├─ prisma
│  ├─ schema.prisma
│  └─ migrations
│
├─ taxonomy
│  └─ it.yaml
│
├─ scripts
└─ docker
```

---

# 6. Functional Requirements

## Document Processing

Users must be able to:

- upload PDF documents
- upload plain text documents

System must:

- extract text
- split into pages
- chunk content
- generate embeddings
- index into vector database

---

## Chat Tutor

Users can:

- ask questions about uploaded materials

System must:

- classify question into KA/KU
- retrieve relevant chunks
- generate answer
- attach citations

---

## Citation System

Citation format:

```
source title + excerpt
```

Example:

```
Operating Systems Book
"...process scheduling determines..."
```

For PDFs:

- page number optional

---

## Mastery Tracking

System tracks user understanding.

Evidence sources:

| Source         | Weight |
| -------------- | ------ |
| Chat inference | Low    |
| Flashcards     | Medium |
| Quiz           | High   |

Mastery range:

```
0.0 – 1.0
```

---

# 7. Business Requirements

The system must:

1. Provide **accurate source grounded answers**
2. Avoid hallucinations
3. Show citations
4. Personalize learning
5. Track mastery progression
6. Support curriculum structure

---

# 8. Document Processing Pipeline

```
PDF Upload
   │
   ▼
Parse PDF
   │
   ▼
Extract pages
   │
   ▼
Chunk text
   │
   ▼
Generate embeddings
   │
   ▼
Index into Weaviate
```

---

# 9. Chunking Strategy

Chunk size:

```
~450 tokens
```

Overlap:

```
100 tokens
```

Reason:

- preserve context
- improve retrieval accuracy

---

# 10. Embedding Strategy

Embedding pipeline:

```
chunk stream
   ↓
batch embedding
   ↓
store vector
```

Batch size:

```
4
```

Streaming processing prevents memory overload.

---

# 11. Retrieval Pipeline

```
User Question
      │
      ▼
KA/KU classification
      │
      ▼
Query embedding
      │
      ▼
Vector search
      │
      ▼
Top chunks
      │
      ▼
Context assembly
      │
      ▼
LLM answer generation
      │
      ▼
Citation generation
      │
      ▼
Return response
```

---

# 12. Mastery Update Logic

Evidence impact:

Chat answer:

```
+0.02 – +0.05
```

Flashcard:

```
+0.03 – +0.06
```

Quiz:

```
+0.05 – +0.12
```

Mastery updates KA/KU scores.

---

# 13. Database Entities

Core tables:

- documents
- document_pages
- document_chunks
- chat_sessions
- chat_messages
- message_citations
- user_mastery
- user_ku_mastery
- mastery_evidence
- quiz_attempts
- flashcard_attempts

---

# 14. Storage Strategy

Documents stored in:

```
local filesystem
```

Database stores:

- metadata
- file path
- chunk references

---

# 15. Configuration Requirements

## Environment Variables

```
CLAUDE_API_KEY=
DATABASE_URL=
WEAVIATE_URL=
WEAVIATE_API_KEY=
```

---

## Prisma Setup

Initialize:

```
npx prisma init
```

Run migration:

```
npx prisma migrate dev
```

Generate client:

```
npx prisma generate
```

---

# 16. Worker Execution

Run worker:

```
npx tsx worker/index.ts
```

Worker responsibilities:

- document parsing
- chunking
- embedding
- indexing

---

# 17. Future Improvements

Planned upgrades:

### Reranker

Improve retrieval accuracy.

### Message Queue

Introduce Redis + BullMQ.

### Authentication

User accounts.

### Audio Transcription

Teacher audio:

```
Speech → Text (STT)
```

Stored as text knowledge source.

### Video Knowledge

Lecture video transcripts.

---

# 18. Development Phases

## Phase 1 (MVP)

- PDF upload
- RAG chat
- citations
- taxonomy classification
- mastery tracking

---

## Phase 2

- flashcards
- quiz system
- reranker
- queue system

---

## Phase 3

- audio transcription
- multi user system
- analytics

---

# 19. System Benefits

This system provides:

- source grounded AI tutoring
- curriculum aware learning
- personalized mastery tracking
- scalable knowledge ingestion

---

# 20. Summary

The system combines:

- **RAG architecture**
- **taxonomy based learning**
- **AI tutoring**
- **mastery tracking**

to create a **next generation intelligent learning assistant**.

The architecture supports:

- scalability
- modular growth
- production readiness

while remaining simple enough for an MVP implementation.
