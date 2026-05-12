# Smart Assistant for Learners

## Project Goal

PDF/TXT сургалтын материал дээр суурилсан RAG AI tutor.

## Main Features

- PDF/TXT upload
- Document parsing and chunking
- BGE-M3 embedding
- Weaviate vector search
- Claude-based answer generation
- Source citations
- KA/KU taxonomy classification
- Mastery tracking
- Quiz and flashcard modules

## Tech Stack

Next.js, TypeScript, PostgreSQL, Prisma, Weaviate, BGE-M3, Claude API

## How to Run

1. npm install
2. configure .env
3. npx prisma migrate dev
4. npm run seed:taxonomy
5. npm run dev
