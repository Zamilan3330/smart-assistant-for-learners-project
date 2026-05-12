# PgAdmin доторх бүх table-уудын тайлбар
**Project:** Smart Assistant for Learners  
**Database:** PostgreSQL  
**ORM:** Prisma  
**Purpose:** Энэ баримт нь PgAdmin дээр харагдах бүх үндсэн table-уудын зорилго, багана тус бүрийн үүрэг, table хоорондын холбоо, систем дээр хэрхэн ашиглагдах логикийг тайлбарлана.

---

# 1. Ерөнхий бүтэц

Энэ системийн database нь 4 үндсэн хэсэгтэй.

1. **Curriculum / Taxonomy layer**
   - domains
   - bok_sources
   - knowledge_areas
   - ka_source_mappings
   - knowledge_units
   - topics
   - learning_outcomes

2. **User / Personalization layer**
   - users
   - user_mastery
   - user_ku_mastery
   - mastery_evidence
   - quiz_attempts
   - flashcard_attempts

3. **Document / RAG layer**
   - documents
   - document_pages
   - document_chunks

4. **Chat / Citation layer**
   - chat_sessions
   - chat_messages
   - message_citations

Энэ 4 layer нийлээд:
- сургалтын taxonomy
- хэрэглэгчийн асуулт-хариулт
- RAG document retrieval
- citation
- mastery tracking

гэдгийг бүхэлд нь дэмжинэ.

---

# 2. Table-уудын ерөнхий уялдаа

```text
domains
  └── knowledge_areas
        └── knowledge_units
              ├── topics
              └── learning_outcomes

bok_sources
  └── ka_source_mappings ──> knowledge_areas

users
  ├── documents
  │     ├── document_pages
  │     └── document_chunks
  ├── chat_sessions
  │     └── chat_messages
  │            └── message_citations
  ├── user_mastery
  ├── user_ku_mastery
  ├── mastery_evidence
  ├── quiz_attempts
  └── flashcard_attempts
```

---

# 3. Curriculum / Taxonomy layer

Энэ хэсэг нь BOK, KA, KU, topic, learning outcome бүтэц хадгална.  
Өөрөөр хэлбэл системийн “юуг заах вэ?” гэсэн суурь мэдлэгийн мод энд байна.

---

## 3.1 `domains`

## Зорилго
Сургалтын томоохон домэйн хадгална.

Жишээ:
- IT
- Cybersecurity
- Data Science

Одоогийн MVP дээр ихэвчлэн нэг domain байна:
- `Information Technology`

## Баганууд

### `id`
- Primary key
- BIGSERIAL
- Database доторх дотоод ID

### `code`
- Domain-ийн canonical код
- Жишээ: `IT`
- Давхцахгүй

### `name`
- Domain-ийн нэр
- Жишээ: `Information Technology (Unified)`

### `description`
- Domain-ийн тайлбар

### `version`
- Taxonomy version
- Жишээ: 1

### `created_at`
- Үүсгэсэн огноо

### `updated_at`
- Сүүлд шинэчилсэн огноо

## Яаж ашиглагдах вэ?
- YAML taxonomy import хийхэд domain эхэлж insert хийнэ
- Knowledge Area table domain_id-аар үүнтэй холбогдоно

---

## 3.2 `bok_sources`

## Зорилго
BOK taxonomy ямар эх сурвалжаас бүрдсэнийг хадгална.

Жишээ:
- CS2023
- IT2017
- CSEC2017
- SEEK
- DS2021
- IS2020
- CE-BoK

## Баганууд

### `id`
- Primary key

### `source_code`
- Давхцахгүй код
- Жишээ: `CS2023`

### `source_name`
- Эх сурвалжийн нэр

### `description`
- Тайлбар

### `created_at`
- Үүсгэсэн огноо

## Яаж ашиглагдах вэ?
- Taxonomy traceability хийхэд ашиглагдана
- Ямар Knowledge Area ямар эх сурвалжийн ямар reference-ээс гарсныг map хийхэд хэрэгтэй

---

## 3.3 `knowledge_areas`

## Зорилго
Domain доторх гол сургалтын хэсгүүдийг хадгална.

Жишээ:
- Programming Fundamentals
- Data Structures & Algorithms
- Software Engineering
- Databases
- Networking
- Cybersecurity

## Баганууд

### `id`
- Primary key

### `domain_id`
- `domains.id` руу FK
- Энэ KA аль domain-д харьяалагдахыг заана

### `ka_code`
- Давхцахгүй canonical код
- Жишээ: `IT-KA-04`

### `name`
- KA нэр
- Жишээ: `Data Management & Databases`

### `description`
- Тайлбар

### `is_core`
- MVP дээр core эсэх
- TRUE бол заавал хамрах үндсэн хэсэг

### `sort_order`
- UI дээр эрэмбэлэхэд

### `created_at`, `updated_at`
- Timestamp

## Яаж ашиглагдах вэ?
- Question classification -> KA output
- Chunk taxonomy tagging
- User mastery aggregate (`user_mastery`) дээр энэ түвшинд үнэлгээ хадгална

---

## 3.4 `ka_source_mappings`

## Зорилго
Knowledge Area болон эх сурвалжийн хоорондын холбоог хадгална.

Жишээ:
- `IT-KA-03` (Software Engineering) нь `SEEK` source-ийн `REQ` хэсгээс гарсан

## Баганууд

### `id`
- Primary key

### `knowledge_area_id`
- `knowledge_areas.id` FK

### `source_id`
- `bok_sources.id` FK

### `source_reference`
- Эх сурвалж доторх тухайн reference
- Жишээ: `REQ`, `AL`, `DM`, `SEC`

### `created_at`
- Timestamp

## Яагаад хэрэгтэй вэ?
- Taxonomy explainability
- Дипломын тайлан дээр “энэ KA-г ямар curriculum source-оос нэгтгэсэн бэ?” гэж харуулахад ашиглана

---

## 3.5 `knowledge_units`

## Зорилго
Knowledge Area доторх нарийвчилсан unit-уудыг хадгална.

Жишээ:
KA = Databases  
KU:
- Data modeling and relational databases
- Querying and database operations
- NoSQL and modern data systems

## Баганууд

### `id`
- Primary key

### `knowledge_area_id`
- `knowledge_areas.id` FK

### `ku_code`
- Давхцахгүй canonical код
- Жишээ: `IT-KA-04-KU-01`

### `name`
- KU нэр

### `description`
- Тайлбар

### `is_core`
- Core unit эсэх

### `sort_order`
- Эрэмбэлэлт

### `created_at`, `updated_at`
- Timestamp

## Яаж ашиглагдах вэ?
- Question classification-ийн mandatory level
- Chunk tagging
- `user_ku_mastery` дээр personalization энэ түвшинд илүү нарийн хадгалагдана

---

## 3.6 `topics`

## Зорилго
KU доторх жижиг сэдвүүдийг хадгална.

Жишээ:
KU = Data modeling and relational databases  
Topics:
- ER modeling basics
- Relational model
- Normalization
- Transactions

## Баганууд

### `id`
- Primary key

### `knowledge_unit_id`
- `knowledge_units.id` FK

### `topic_name`
- Topic нэр

### `description`
- Topic тайлбар

### `sort_order`
- Эрэмбэлэх дараалал

### `created_at`
- Timestamp

## Яаж ашиглагдах вэ?
- Fine-grained tagging
- Recommendation хийхэд
- Future flashcard generation дээр topic level ашиглаж болно

---

## 3.7 `learning_outcomes`

## Зорилго
KU бүрийн сургалтын үр дүнг хадгална.

Жишээ:
- “SQL асуулга зохиож өгөгдлөөс мэдээлэл гаргана.”
- “Normalization-ийн зорилгыг тайлбарлаж чадна.”

## Баганууд

### `id`
- Primary key

### `knowledge_unit_id`
- `knowledge_units.id` FK

### `outcome_text`
- Learning outcome текст

### `sort_order`
- Эрэмбэлэлт

### `created_at`
- Timestamp

## Яаж ашиглагдах вэ?
- Mastery reasoning-д
- Quiz / flashcard content generation-д
- Dashboard дээр “энэ KU дээр хэрэглэгч юу сурах ёстой вэ?” гэж харуулахад

---

# 4. User / Personalization layer

Энэ хэсэг нь хэрэглэгч болон түүний суралцах явцыг хадгална.

---

## 4.1 `users`

## Зорилго
Хэрэглэгчийн үндсэн мэдээлэл хадгална.

MVP дээр auth байхгүй байсан ч demo user энд байна.

## Баганууд

### `id`
- Primary key

### `email`
- Давхцахгүй email

### `full_name`
- Хэрэглэгчийн бүтэн нэр

### `password_hash`
- Auth дараа нэмэхэд ашиглана
- MVP дээр NULL байж болно

### `created_at`, `updated_at`
- Timestamp

## Яаж ашиглагдах вэ?
- documents, chat_sessions, mastery гэх мэт бүх personalized data үүнтэй холбоотой байна

---

## 4.2 `user_mastery`

## Зорилго
User-ийн Knowledge Area түвшний mastery score хадгална.

Жишээ:
- Databases: 0.62
- Networking: 0.41
- Cybersecurity: 0.55

## Баганууд

### `id`
- Primary key

### `user_id`
- `users.id` FK

### `knowledge_area_id`
- `knowledge_areas.id` FK

### `mastery_score`
- 0.0000 – 1.0000
- User тухайн KA-г хэр сайн ойлгож байгааг илэрхийлнэ

### `confidence_score`
- Системийн өөрийнх нь энэ үнэлгээнд итгэх түвшин
- Илүү олон evidence цуглах тусам өснө

### `evidence_count`
- Хэдэн evidence ашиглаж үнэлсэн бэ

### `last_assessed_at`
- Хамгийн сүүлд энэ mastery update хийгдсэн огноо

### `created_at`, `updated_at`
- Timestamp

## Яаж ашиглагдах вэ?
- Dashboard дээр KA level chart гаргана
- Recommendation engine дээр “аль KA хамгийн сул байна?” гэж олно

---

## 4.3 `user_ku_mastery`

## Зорилго
User-ийн Knowledge Unit түвшний mastery score хадгална.

Энэ нь `user_mastery`-гээс илүү нарийвчилсан personalization хийдэг.

Жишээ:
KA = Databases  
KU scores:
- Data modeling = 0.75
- SQL operations = 0.58
- NoSQL = 0.21

## Баганууд

### `id`
- Primary key

### `user_id`
- `users.id` FK

### `knowledge_unit_id`
- `knowledge_units.id` FK

### `mastery_score`
- 0.0 – 1.0

### `confidence_score`
- 0.0 – 1.0

### `evidence_count`
- Evidence тоо

### `last_assessed_at`
- Сүүлд update хийсэн огноо

### `created_at`, `updated_at`
- Timestamp

## Яаж ашиглагдах вэ?
- Dashboard дээр нарийвчилсан progress харуулна
- Recommendation, weak topic detection-д маш чухал

---

## 4.4 `mastery_evidence`

## Зорилго
Mastery score яагаад өөрчлөгдсөнийг тайлбарлах evidence log.

Энэ table бол personalization-ийн audit trail юм.

## Баганууд

### `id`
- Primary key

### `user_id`
- `users.id` FK

### `session_id`
- `chat_sessions.id` FK
- Аль чат session-оос evidence үүссэн бэ

### `message_id`
- `chat_messages.id` FK
- Аль message-тэй холбоотой вэ

### `knowledge_area_id`
- `knowledge_areas.id` FK

### `knowledge_unit_id`
- `knowledge_units.id` FK

### `topic_id`
- `topics.id` FK, optional

### `learning_outcome_id`
- `learning_outcomes.id` FK, optional

### `evidence_type`
- Evidence-ийн төрөл
- Жишээ:
  - `chat_inferred`
  - `quiz_result`
  - `flashcard_result`

### `score_delta`
- Mastery-г хэдээр өөрчилсөн бэ
- Жишээ: `+0.03`, `-0.02`

### `confidence_delta`
- Confidence-г хэдээр өөрчилсөн бэ

### `evidence_text`
- Ямар шалтгаанаар ийм update хийснийг тайлбарласан текст

### `metadata`
- JSONB
- Extra detail
- Жишээ:
  - raw_score
  - classifier_confidence
  - attempt_count

### `created_at`
- Timestamp

## Яаж ашиглагдах вэ?
- Dashboard дээр recent evidence харуулна
- Яагаад user mastery өссөн/буурсныг тайлбарлана
- Debugging, explainability-д маш чухал

---

## 4.5 `quiz_attempts`

## Зорилго
Quiz session бүрийн нэгтгэсэн үр дүнг хадгална.

## Баганууд

### `id`
- Primary key

### `user_id`
- `users.id` FK

### `session_id`
- `chat_sessions.id` FK, optional

### `knowledge_area_id`
- `knowledge_areas.id` FK

### `knowledge_unit_id`
- `knowledge_units.id` FK

### `score`
- Нийт quiz score
- 0.0 – 1.0

### `total_questions`
- Нийт асуултын тоо

### `correct_answers`
- Зөв хариулсан тоо

### `created_at`
- Timestamp

## Яаж ашиглагдах вэ?
- High-confidence mastery signal
- Dashboard дээр quiz history гаргана
- Recommendation-д “энэ KU дээр quiz муу байна” гэж ашиглана

---

## 4.6 `flashcard_attempts`

## Зорилго
Flashcard бүрийн individual attempt хадгална.

## Баганууд

### `id`
- Primary key

### `user_id`
- `users.id` FK

### `session_id`
- `chat_sessions.id` FK

### `knowledge_area_id`
- `knowledge_areas.id` FK

### `knowledge_unit_id`
- `knowledge_units.id` FK

### `prompt_text`
- Flashcard дээрх асуулт

### `expected_answer`
- Хүлээгдэж буй зөв хариулт

### `user_answer`
- Хэрэглэгчийн өгсөн хариулт

### `is_correct`
- TRUE/FALSE

### `score`
- Тухайн attempt-ийн оноо

### `created_at`
- Timestamp

## Яаж ашиглагдах вэ?
- Medium-weight mastery evidence
- Future spaced repetition logic
- Topic-level practice tracking

---

# 5. Document / RAG layer

Энэ хэсэг нь RAG системийн эх сурвалж, page, chunk, retrieval trace-ийг хадгална.

---

## 5.1 `documents`

## Зорилго
User-ийн upload хийсэн source-уудын үндсэн metadata хадгална.

Supported source:
- pdf
- plain_text

Future:
- audio transcript
- url

## Баганууд

### `id`
- Primary key

### `user_id`
- `users.id` FK

### `title`
- Document title

### `source_type`
- `pdf`, `plain_text`

### `file_name`
- Upload file нэр

### `mime_type`
- MIME type

### `storage_path`
- Local filesystem path
- Жишээ: `/uploads/os_book.pdf`

### `raw_text`
- plain text source бол энд хадгалж болно

### `file_size`
- File хэмжээ

### `checksum`
- Duplicate шалгах, integrity шалгахад

### `status`
- Processing status
- Жишээ:
  - `uploaded`
  - `parsing`
  - `chunked`
  - `indexed`
  - `failed`

### `error_message`
- Хэрэв processing алдаа гарвал тайлбар

### `created_at`, `updated_at`
- Timestamp

## Яаж ашиглагдах вэ?
- Upload API эхлээд энэ table-д row үүсгэнэ
- Worker pipeline status update хийнэ

---

## 5.2 `document_pages`

## Зорилго
PDF document-ийн page-level extracted text хадгална.

PDF citation, page jump хийхэд энэ table хэрэгтэй.

Plain text source-д энэ table ашиглахгүй байж болно.

## Баганууд

### `id`
- Primary key

### `document_id`
- `documents.id` FK

### `page_number`
- Аль page вэ

### `extracted_text`
- Тухайн page-ийн text

### `created_at`
- Timestamp

## Яаж ашиглагдах вэ?
- PDF parse хийсний дараа page бүр insert хийнэ
- Page-level citation хийхэд ашиглана
- Chunking хийхдээ source болгон хэрэглэнэ

---

## 5.3 `document_chunks`

## Зорилго
Retrieval хийхэд ашиглагдах жижиг текстийн хэсгүүдийг хадгална.

Энэ бол RAG системийн хамгийн чухал table-уудын нэг.

## Баганууд

### `id`
- Primary key

### `document_id`
- `documents.id` FK

### `page_id`
- `document_pages.id` FK, optional
- PDF бол page-тай холбогдоно

### `page_number`
- Citation болон display-д амар болгохын тулд тусад нь хадгалж болно

### `chunk_index`
- Тухайн document доторх хэддэх chunk вэ

### `chunk_text`
- Chunk-ийн бодит текст

### `chunk_hash`
- Duplicate detection

### `start_offset`
- Page эсвэл raw text дотор эхлэх байрлал

### `end_offset`
- Төгсөх байрлал

### `token_count`
- Chunk token count

### `taxonomy_metadata`
- JSONB
- Chunk ямар KA/KU-д хамаарахыг хадгална
- Жишээ:
  - knowledge_area_code
  - knowledge_unit_code
  - section_title
  - classification_confidence

### `created_at`, `updated_at`
- Timestamp

## Яаж ашиглагдах вэ?
- Weaviate руу index хийхийн өмнөх canonical source
- Citation trace хийхэд
- Retrieval result-г Postgres дээрх source of truth-тэй холбохдоо ашиглана

---

# 6. Chat / Citation layer

Энэ хэсэг нь user асуулт, AI answer, citation-ийг хадгална.

---

## 6.1 `chat_sessions`

## Зорилго
Нэг хэрэглэгчийн нэг чат conversation session-ийг хадгална.

Жишээ:
- “Database Revision”
- “Networking Exam Prep”

## Баганууд

### `id`
- Primary key

### `user_id`
- `users.id` FK

### `title`
- Session title

### `mode`
- Session mode
- Жишээ:
  - `tutoring`
  - `document_qa`

### `created_at`, `updated_at`
- Timestamp

## Яаж ашиглагдах вэ?
- Нэг session дотор олон message байна
- Dashboard дээр history харуулахад

---

## 6.2 `chat_messages`

## Зорилго
Session доторх message бүрийг хадгална.

## Баганууд

### `id`
- Primary key

### `session_id`
- `chat_sessions.id` FK

### `role`
- `user`, `assistant`, `system`

### `content`
- Message body текст

### `message_type`
- `chat`, `quiz`, `flashcard`

### `created_at`
- Timestamp

## Яаж ашиглагдах вэ?
- User question хадгална
- Assistant answer хадгална
- Mastery evidence message_id-аар холбогдоно

---

## 6.3 `message_citations`

## Зорилго
Assistant-ийн нэг answer дээр ашигласан citation-уудыг хадгална.

Энэ table нь page-level + excerpt citation-ийн цөм.

## Баганууд

### `id`
- Primary key

### `message_id`
- `chat_messages.id` FK
- Аль assistant message дээр citation харуулах вэ

### `document_id`
- `documents.id` FK

### `chunk_id`
- `document_chunks.id` FK

### `page_number`
- PDF бол page number
- plain text бол NULL байж болно

### `citation_label`
- UI дээр `[1]`, `[2]` гэх мэт

### `excerpt_text`
- Хэрэглэсэн богино тасархай хэсэг
- User citation дарахад яг ямар хэсэг ашигласныг ойлгоно

### `relevance_score`
- Retrieval score эсвэл rerank score хадгалах боломжтой

### `created_at`
- Timestamp

## Яаж ашиглагдах вэ?
- Assistant answer display
- Citation side panel
- PDF viewer рүү үсрэх
- Explainability

---

# 7. Weaviate ба Postgres холбоо

Хэдийгээр Weaviate нь PgAdmin дээр харагдах table биш ч энэ database design-г ойлгоход маш чухал.

## Гол зарчим
- `document_chunks` = canonical truth
- Weaviate object = retrieval-д зориулсан copy / denormalized view

Жишээ:

Postgres:
- document_chunks.id = 101
- document_id = 12
- page_number = 7
- chunk_text = "Normalization reduces redundancy..."

Weaviate:
- chunkId = 101
- documentId = 12
- pageNumber = 7
- text = "Normalization reduces redundancy..."
- knowledgeAreaCode = ...

Хайлт Weaviate дээр явагдана.  
Гэхдээ citation, audit, display Postgres дээрх canonical data-аас хийгдэнэ.

---

# 8. Table-уудын ашиглалтын жишээ

---

## Жишээ 1: Taxonomy seed import

1. `domains` -> IT insert
2. `bok_sources` -> CS2023, IT2017 ...
3. `knowledge_areas` -> Programming, Databases ...
4. `knowledge_units` -> KU-ууд
5. `topics`, `learning_outcomes` -> дэлгэрэнгүй сэдэв

---

## Жишээ 2: PDF upload

1. User PDF upload хийнэ
2. `documents` row үүснэ
3. Worker parse хийнэ
4. `document_pages` insert
5. `document_chunks` insert
6. Weaviate index

---

## Жишээ 3: User question asks

1. `chat_sessions` session байна
2. `chat_messages` дээр user question хадгална
3. Retrieval -> `document_chunks` related chunks олно
4. Assistant answer үүсгэнэ
5. `chat_messages` дээр assistant answer хадгална
6. `message_citations` insert хийнэ

---

## Жишээ 4: Mastery update

1. User Databases сэдвээр асуулт асууна
2. Classification -> KA=Databases, KU=Normalization
3. System user ойлгосон эсэхийг infer хийнэ
4. `mastery_evidence` insert
5. `user_ku_mastery` update
6. `user_mastery` update

---

## Жишээ 5: Quiz attempt

1. User KU дээр quiz өгнө
2. `quiz_attempts` summary хадгална
3. `mastery_evidence` -> `quiz_result`
4. `user_ku_mastery` өснө

---

# 9. Dashboard дээр юу хаанаас ирэх вэ?

## KA mastery chart
- `user_mastery`

## KU breakdown
- `user_ku_mastery`

## Recent evidence
- `mastery_evidence`

## Chat history
- `chat_sessions`, `chat_messages`

## Citations
- `message_citations` + `documents`

## Uploaded source list
- `documents`

---

# 10. Дүгнэлт

Энэ database structure нь 3 том зорилгыг зэрэг хангана:

1. **Curriculum structure хадгалах**
   - domains → KA → KU → topics → outcomes

2. **RAG source ба citation хадгалах**
   - documents → pages → chunks → message_citations

3. **Personalized learning progression хадгалах**
   - user_mastery, user_ku_mastery, mastery_evidence, quiz_attempts, flashcard_attempts

Ингэснээр систем:
- user source дээр тулгуурласан answer өгнө
- citation харуулна
- user юу мэддэг, юун дээр сул байгааг хадгална
- taxonomy-aware personalization хийнэ

---

# 11. Хамгийн чухал table-уудын товч summary

## Curriculum
- `domains` → хамгийн том domain
- `knowledge_areas` → гол мэдлэгийн хэсэг
- `knowledge_units` → KA доторх нарийвчилсан нэгж
- `topics` → KU доторх сэдэв
- `learning_outcomes` → сурах ёстой үр дүн

## User
- `users` → хэрэглэгч
- `user_mastery` → KA mastery
- `user_ku_mastery` → KU mastery
- `mastery_evidence` → яагаад mastery update болсон тайлбар

## RAG
- `documents` → source metadata
- `document_pages` → PDF page text
- `document_chunks` → retrieval text units

## Chat
- `chat_sessions` → conversation group
- `chat_messages` → асуулт/хариулт
- `message_citations` → assistant answer-ын citation

## Assessment
- `quiz_attempts` → quiz summary
- `flashcard_attempts` → flashcard response log

---

# 12. Future extensibility

Энэ schema-г дараа нь дараах байдлаар өргөтгөж болно:

- audio transcript ingestion
- STT source tables
- reranker score tables
- multi-user auth/session
- recommendation table
- document collections
- lesson plans
- spaced repetition scheduler

Гэхдээ MVP хувьд одоогийн table-ууд хангалттай.
