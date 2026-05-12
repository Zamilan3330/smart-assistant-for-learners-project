# Weaviate — Vector DB бүтэц

## Collection (PostgreSQL-ийн table-тэй адил)

```text
DocumentChunk  ← цорын ганц collection
  └── Object (мөр бүр)
        ├── properties (metadata — шүүлтүүр, буцаах утга)
        │     ├── chunkId            int      ← PostgreSQL document_chunks.id-тэй тэнцүү
        │     ├── documentId         int
        │     ├── userId             int
        │     ├── documentTitle      text
        │     ├── sourceType         text     (pdf | plain_text)
        │     ├── pageNumber         int
        │     ├── chunkIndex         int
        │     ├── text               text     ← chunk-ийн бүрэн текст
        │     ├── knowledgeAreaCode  text     (IT-KA-01 ... IT-KA-12)
        │     └── knowledgeUnitCode  text     (IT-KA-01-KU-01 ...)
        │
        └── vector  float[1024]  ← bge-m3 embedding, HNSW Cosine index
```

## PostgreSQL-тэй харьцуулбал

```text
PostgreSQL document_chunks
  └── бүх metadata + текст + taxonomy
        └── id (PK)

Weaviate DocumentChunk
  └── properties (хайлтад хэрэгтэй metadata)
  └── vector    (семантик хайлтын үндэс)
        └── chunkId = PostgreSQL id  ← холбогч гүүр
```

## Хайлт хэрхэн ажилладаг

```text
Асуулт
  → bge-m3 → query vector [1024-dim]
  → Weaviate nearVector()
        → HNSW индексээр cosine distance тооцоолно
        → filter: userId, documentIds, knowledgeAreaCode (optional)
        → top 8 object буцаана
  → top 4 сонгоно (by score)
  → chunkId-ээр PostgreSQL-д join хийхгүй
    (text, pageNumber, documentTitle шууд properties-аас авна)
```