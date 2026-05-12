# Smart Assistant for Learners — Системийн диаграммууд

---

## 0. Weaviate Vector DB — Chunk хадгалалтын бүтэц

### 0.1 PostgreSQL vs Weaviate — Chunk өгөгдлийн хуваарилалт

```mermaid
flowchart TB
    CHUNK["DocumentChunk\n(нэг chunk)"]

    CHUNK --> PG_SIDE & WV_SIDE

    subgraph PG_SIDE ["🗄️ PostgreSQL — Metadata & Relations"]
        direction TB
        PG["document_chunks"]
        PG --- PG1["id (PK)"]
        PG --- PG2["document_id (FK)"]
        PG --- PG3["page_id (FK)"]
        PG --- PG4["chunk_index"]
        PG --- PG5["chunk_text"]
        PG --- PG6["chunk_hash"]
        PG --- PG7["token_count"]
        PG --- PG8["taxonomy_metadata\n{kaCode, kuCode}"]
    end

    subgraph WV_SIDE ["🔍 Weaviate — Vector + Properties"]
        direction TB
        WV["DocumentChunk collection\n(Object)"]
        WV --- WV1["chunkId  ← PG id-тэй тэнцүү"]
        WV --- WV2["documentId"]
        WV --- WV3["userId"]
        WV --- WV4["documentTitle"]
        WV --- WV5["pageNumber"]
        WV --- WV6["chunkIndex"]
        WV --- WV7["text  ← chunk_text-тэй ижил"]
        WV --- WV8["knowledgeAreaCode"]
        WV --- WV9["knowledgeUnitCode"]
        WV --- VEC["🧮 vector\n1024-dim float array\n(bge-m3 embedding)\nHNSW Cosine index"]
    end

    WV1 -.->|"chunkId = id"| PG1

    style PG fill:#e3f2fd,stroke:#1565c0
    style WV fill:#e8f5e9,stroke:#2e7d32
    style VEC fill:#fff8e1,stroke:#f57f17
    style CHUNK fill:#f3e5f5
```

---

### 0.2 Chunk индексийн урсгал (Upload → Weaviate)

```mermaid
flowchart LR
    CT["chunk_text\n'Binary search нь\nсортлогдсон массивт...'"]

    CT --> EMB["bge-m3 Embedding\n(local CPU)"]
    EMB --> VEC["vector\n[0.021, -0.134, 0.089,\n..., 0.042]\n1024 float"]

    CT --> PROPS["Properties\nchunkId: 123\ndocumentId: 45\nuserId: 1\npageNumber: 7\nknowledgeAreaCode: IT-KA-02\nknowledgeUnitCode: IT-KA-02-KU-01\n..."]

    VEC --> OBJ["Weaviate Object"]
    PROPS --> OBJ
    OBJ --> IDX["HNSW Index\n(Cosine distance)"]

    style EMB fill:#fff8e1
    style VEC fill:#e8f5e9
    style IDX fill:#fce4ec
```

---

### 0.3 Semantic Search урсгал (Query → Top-K chunks)

```mermaid
flowchart TD
    Q["Хэрэглэгчийн асуулт\n'Binary search яаж ажилладаг вэ?'"]

    Q --> CE["bge-m3 Embedding\nquery vector үүсгэх\n[0.018, -0.142, 0.091, ..., 0.039]"]

    CE --> WV_SEARCH["Weaviate nearVector()"]

    WV_SEARCH --> FILTER{KA filter байна уу?}

    FILTER -->|"kaCode = IT-KA-02\nтайлж хайх"| F1["KA-filtered search\n(userId + documentIds + kaCode)"]
    F1 --> CHK{">= 2 үр дүн?"}
    CHK -->|Тийм| TOP8["Top 8 chunks\n(cosine similarity-ээр)"]
    CHK -->|Үгүй| F2["Fallback:\nKA filter-гүй хайх\n(userId + documentIds)"]
    FILTER -->|KA code байхгүй| F2
    F2 --> TOP8

    TOP8 --> TOP4["Top 4 chunk сонгох\n(by score)"]

    TOP4 --> RES["SearchResult[]\nchunkId, documentId,\ndocumentTitle, pageNumber,\ntext, kaCode, kuCode, score"]

    style Q fill:#e3f2fd
    style CE fill:#fff8e1
    style TOP4 fill:#e8f5e9
    style RES fill:#f3e5f5
```

---

## 0. Taxonomy бүтцийн диаграмм

### 0.1 IT Body of Knowledge — Ерөнхий бүтэц (12 KA)

> ⬛ = Core (MVP-д заавал), ⬜ = Optional

```mermaid
mindmap
  root(("IT BoK<br/>Domain"))
    Core KAs
      IT-KA-01
        Programming Fundamentals
      IT-KA-02
        Data Structures & Algorithms
      IT-KA-03
        Software Engineering
      IT-KA-04
        Data Management & Databases
      IT-KA-05
        Networking & Communication
      IT-KA-06
        Operating Systems & Platform
      IT-KA-07
        Cybersecurity
      IT-KA-09
        Cloud & Distributed Computing
      IT-KA-11
        AI & Data Science
      IT-KA-12
        Professional Practice & Ethics
    Optional KAs
      IT-KA-08
        Web & Mobile Systems
      IT-KA-10
        Human–Computer Interaction & UX
```

---

### 0.2 Taxonomy шатлалын бүтэц — Нэг KA-ийн жишээ (IT-KA-01)

```mermaid
flowchart TD
    DOMAIN["🌐 IT Domain\n(Information Technology Unified)"]
    DOMAIN --> KA01["📚 IT-KA-01\nProgramming Fundamentals\n★ Core"]

    KA01 --> KU01["📖 IT-KA-01-KU-01\nProgramming concepts\nand problem solving\n★ Core"]
    KA01 --> KU02["📖 IT-KA-01-KU-02\nProgramming paradigms\nand modern practices\n○ Optional"]

    KU01 --> T01["💡 Variables, types,\nexpressions, control flow"]
    KU01 --> T02["💡 Functions,\nmodularization, scope"]
    KU01 --> T03["💡 Debugging basics,\ntracing, logging"]
    KU01 --> T04["💡 Problem decomposition\nand stepwise refinement"]

    KU02 --> T05["💡 OOP basics\nclasses, encapsulation"]
    KU02 --> T06["💡 Scripting & automation\nshell, python basics"]
    KU02 --> T07["💡 Code style,\nreadability, documentation"]

    KU01 --> LO01["✅ Үндсэн конструкцуудыг\nашиглан програм бичнэ"]
    KU01 --> LO02["✅ Алгоритмын шатлал\ngаргана"]

    style DOMAIN fill:#e3f2fd,stroke:#1565c0
    style KA01 fill:#e8f5e9,stroke:#2e7d32
    style KU01 fill:#fff8e1,stroke:#f57f17
    style KU02 fill:#fff8e1,stroke:#f57f17,stroke-dasharray: 5 5
    style T01 fill:#f3e5f5
    style T02 fill:#f3e5f5
    style T03 fill:#f3e5f5
    style T04 fill:#f3e5f5
    style T05 fill:#f3e5f5,stroke-dasharray: 5 5
    style T06 fill:#f3e5f5,stroke-dasharray: 5 5
    style T07 fill:#f3e5f5,stroke-dasharray: 5 5
    style LO01 fill:#fce4ec
    style LO02 fill:#fce4ec
```

---

### 0.3 Taxonomy → Системд хэрхэн ашиглагдах

```mermaid
flowchart LR
    TAX["📋 it.yaml\n(12 KA, ~50 KU)"]

    TAX -->|Seed| PG[("PostgreSQL\ndomain\nknowledge_areas\nknowledge_units")]
    TAX -->|Prompt summary| CLS["Claude Classifier\n(chunk/question → kaCode, kuCode)"]

    CLS -->|Chunk ангилал| DC["DocumentChunk\ntaxonomyMetadata:\n{kaCode, kuCode}"]
    CLS -->|Асуулт ангилал| SRCH["Weaviate хайлт\nKA filter-тэй"]

    DC --> SRCH
    SRCH --> MAST["UserMastery / UserKuMastery\n(0.0 – 1.0 score)"]

    style TAX fill:#e8f5e9
    style PG fill:#fce4ec
    style CLS fill:#fff8e1
    style MAST fill:#e3f2fd
```

---

## 1. User Flow Diagram — Хэрэглэгчийн урсгал

```mermaid
flowchart TD
    Start([Хэрэглэгч нэвтрэх]) --> Login[Нэвтрэх хуудас]
    Login -->|Шинэ хэрэглэгч| Register[Бүртгүүлэх]
    Register --> Login
    Login -->|Амжилттай| Home[Нүүр хуудас]

    Home --> DocPage[Баримт бичгүүд]
    Home --> ChatPage[Чатбот]
    Home --> MasteryPage[Мэдлэгийн түвшин]

    %% Document flow
    DocPage --> Upload[PDF/TXT файл байршуулах]
    Upload --> Processing[Боловсруулж байна...]
    Processing --> Ready[Бэлэн - indexed]
    Processing --> Error[Алдаа гарсан]
    Error --> Upload
    Ready --> DocDetails[Баримт бичгийн дэлгэрэнгүй]
    DocDetails --> Download[Файл татах]
    DocDetails --> Delete[Устгах]
    DocPage --> Search[Баримт хайх / шүүх]

    %% Chat flow
    ChatPage --> SelectDocs[Баримт бичиг сонгох]
    SelectDocs --> AskQuestion[Асуулт бичих]
    AskQuestion --> ViewAnswer[Хариулт + эх сурвалж харах]
    ViewAnswer --> ViewCitation[Эшлэлийг дэлгэрэнгүй харах]
    ViewAnswer --> AskQuestion

    %% Session management
    ChatPage --> Sessions[Өмнөх чатууд]
    Sessions --> LoadSession[Чат ачаалах]
    LoadSession --> ViewAnswer
    Sessions --> DeleteSession[Чат устгах]
    Sessions --> NewChat[Шинэ чат эхлүүлэх]
    NewChat --> SelectDocs

    %% Mastery
    MasteryPage --> KAProgress[KA түвшин харах]
    KAProgress --> KUDetail[KU дэлгэрэнгүй]

    %% Phase 2 - planned
    Home -.-> QuizPage[Тест / Quiz]
    Home -.-> FlashPage[Flashcard]
    QuizPage -.-> TakeQuiz[Тест өгөх]
    TakeQuiz -.-> QuizResult[Үр дүн харах]
    QuizResult -.-> MasteryPage
    FlashPage -.-> StudyCards[Карт сурах]
    StudyCards -.-> CardResult[Хариулт шалгах]
    CardResult -.-> FlashPage

    style Login fill:#e1f5fe
    style Home fill:#e8f5e9
    style ChatPage fill:#fff3e0
    style DocPage fill:#f3e5f5
    style MasteryPage fill:#fce4ec
    style QuizPage fill:#f5f5f5,stroke-dasharray: 5 5
    style FlashPage fill:#f5f5f5,stroke-dasharray: 5 5
```

---

## 1.1 Document Upload Workflow — Баримт бичиг байршуулах урсгал

```mermaid
flowchart TD
    A([Эхлэл]) --> B["Файл сонгох (PDF / TXT)"]
    B --> C{Файлын төрөл зөв үү?}
    C -->|Үгүй| D["Алдааны мэдэгдэл:<br/>'PDF, TXT файл дэмжинэ'"]
    D --> B
    C -->|Тийм| E[Файлыг серверт илгээх]
    E --> F["uploads хавтаст хадгалах"]
    F --> G[Document бичлэг үүсгэх<br/>status: parsing]

    G --> H{PDF үү?}
    H -->|Тийм| I["unpdf-ээр хуудас бүрийн<br/>текст задлах"]
    H -->|Үгүй - TXT| J[Текстийг шууд унших]
    I --> K[DocumentPage бичлэгүүд хадгалах]
    J --> K

    K --> L["Chunk болгох<br/>(~450 token, 100 overlap)"]
    L --> M[DocumentChunk бичлэгүүд хадгалах]

    M --> N["Claude API-ээр KA/KU ангилах<br/>(chunk бүрт)"]
    N --> O[taxonomyMetadata шинэчлэх]

    O --> P["bge-m3 embedding үүсгэх<br/>(batch=4)"]
    P --> Q[Weaviate-д индекслэх]

    Q --> R{Амжилттай?}
    R -->|Тийм| S["Document status: indexed"]
    R -->|Үгүй| T["Document status: error"]

    S --> U(["Дууссан — Баримт бичиг бэлэн"])

    style A fill:#e8f5e9
    style U fill:#e8f5e9
    style T fill:#ffcdd2
    style D fill:#ffcdd2
    style N fill:#fff8e1
    style P fill:#e3f2fd
    style Q fill:#f3e5f5
```

---

### Зураг 5.2.1.2. Ingestion pipeline-ийн урсгал диаграмм

```mermaid
flowchart TD
    A([Эхлэл: Upload request]) --> B[JWT шалгах + файл валидлах]
    B --> C{"Файл зөв үү - PDF эсвэл TXT"}
    C -->|Үгүй| X[400 Bad Request]
    C -->|Тийм| D[uploads/ руу хадгалах]

    D --> E[documents хүснэгтэд бичлэг үүсгэх<br/>status: parsing]
    E --> F{Source type}

    F -->|PDF| G[unpdf.extractText()<br/>хуудас бүрээс текст авах]
    F -->|TXT| H[текстийг нэг хуудсаар унших]
    G --> I[document_pages хадгалах]
    H --> I

    I --> J[chunk-text()<br/>~338 words, overlap 75]
    J --> K[document_chunks хадгалах]

    K --> L[classifyChunks()<br/>KA/KU ангилал]
    L --> M[taxonomyMetadata update]

    M --> N[embedTextBatch()<br/>bge-m3, batch=4]
    N --> O[Weaviate DocumentChunk upsert]

    O --> P{"Индекслэлт амжилттай юу"}
    P -->|Тийм| Q[documents.status = indexed]
    P -->|Үгүй| R[documents.status = error]

    Q --> S([Дууссан: Retrieval-д бэлэн])
    R --> T([Дууссан: Retry/Reclassify шаардлагатай])

    style A fill:#e8f5e9
    style S fill:#e8f5e9
    style T fill:#ffcdd2
    style X fill:#ffcdd2
    style L fill:#fff8e1
    style N fill:#e3f2fd
    style O fill:#f3e5f5
```

---

## 1.2 Chat Workflow — Чатбот асуулт-хариулт урсгал

```mermaid
flowchart TD
    A([Эхлэл]) --> B[Чатбот хуудас нээх]
    B --> C{Өмнөх чат ачаалах уу?}
    C -->|Тийм| D[Чат session сонгох]
    D --> E[Өмнөх мессежүүд ачаалах]
    C -->|Үгүй| F[Шинэ чат эхлүүлэх]

    E --> G[Баримт бичиг сонгох]
    F --> G
    G --> H[Асуулт бичих]
    H --> I[POST /api/chat илгээх]

    I --> J{Session байна уу?}
    J -->|Үгүй| K[Шинэ ChatSession үүсгэх]
    J -->|Тийм| L[ChatMessage хадгалах: user]
    K --> L

    L --> M["1. Асуултыг KA/KU ангилах<br/>(Claude API)"]
    M --> N["2. Асуултыг embed хийх<br/>(bge-m3, 1024-dim)"]
    N --> O["3. Weaviate семантик хайлт<br/>(top 8 chunks)"]

    O --> P{KA шүүлтүүрт >= 2 үр дүн?}
    P -->|Тийм| Q[KA filtered үр дүн авах]
    P -->|Үгүй| R[Бүх баримтаас хайх — fallback]
    Q --> S["Top 4 chunk сонгох (by score)"]
    R --> S

    S --> T{Chunk олдсон уу?}
    T -->|Үгүй| U["'Мэдээлэл олдсонгүй' хариулт"]
    T -->|Тийм| V["4. Claude API-ээр хариулт үүсгэх<br/>(system: chunks context)"]

    V --> W["5. Эшлэл бүрдүүлэх<br/>(chunk → citation mapping)"]
    W --> X[ChatMessage хадгалах: assistant]
    X --> Y[MessageCitation бичлэгүүд хадгалах]
    U --> Z[Хариулт frontend-рүү буцаах]
    Y --> Z

    Z --> AA[Хариулт + эшлэл харуулах]
    AA --> BB{Дахин асуух уу?}
    BB -->|Тийм| H
    BB -->|Үгүй| CC([Дууссан])

    style A fill:#e8f5e9
    style CC fill:#e8f5e9
    style U fill:#ffcdd2
    style M fill:#fff8e1
    style N fill:#e3f2fd
    style O fill:#f3e5f5
    style V fill:#fff8e1
```

---

## 2. Ерөнхий архитектурын диаграмм

```mermaid
flowchart LR
    subgraph Client ["Client (Browser)"]
        FE["Next.js 16 + React 19<br/>TailwindCSS 4<br/>Redux Toolkit"]
    end

    subgraph Server ["Backend (Next.js API Routes)"]
        API["API Routes<br/>/api/chat<br/>/api/documents<br/>/api/sessions"]

        subgraph Modules ["Business Logic Modules"]
            CHAT["Chat Service<br/>(RAG Orchestrator)"]
            TAX["Taxonomy Classifier<br/>(KA/KU ангилал)"]
            RET["Retrieval Service<br/>(Semantic Search)"]
            CHUNK["Chunking Module<br/>(~450 tokens, 100 overlap)"]
            DOC["Documents Service<br/>(CRUD)"]
            MAST["Mastery Service<br/>(Түвшин тооцоолол)"]
            QUIZ["Quiz Service"]
            FLASH["Flashcard Service"]
        end
    end

    subgraph Infra ["Infrastructure"]
        EMB["BAAI/bge-m3<br/>(Local CPU, 1024-dim)"]
        LLM["Claude API<br/>(claude-haiku-4-5)"]
    end

    subgraph Storage ["Data Storage"]
        PG[("PostgreSQL<br/>(Prisma ORM)")]
        WV[("Weaviate<br/>(Vector DB)")]
        DISK[("File System<br/>/uploads/")]
    end

    FE <-->|HTTP / FormData| API

    API --> CHAT
    API --> DOC
    API --> MAST

    CHAT --> TAX
    CHAT --> RET
    TAX --> LLM
    CHAT --> LLM
    RET --> EMB
    RET --> WV

    DOC --> CHUNK
    DOC --> DISK
    CHUNK --> TAX
    CHUNK --> EMB
    EMB --> WV

    CHAT --> PG
    DOC --> PG
    MAST --> PG

    QUIZ -.-> CHAT
    FLASH -.-> CHAT
    QUIZ -.-> PG
    FLASH -.-> PG

    style QUIZ fill:#f5f5f5,stroke-dasharray: 5 5
    style FLASH fill:#f5f5f5,stroke-dasharray: 5 5
    style Client fill:#e3f2fd
    style Storage fill:#fce4ec
    style Infra fill:#fff8e1
```

---

## 3. Use Case диаграмм

### 3.1 Суралцагчийн Use Case

```mermaid
flowchart LR
    Student(("Суралцагч"))

    subgraph UC_Auth ["Нэвтрэлт"]
        UC1(["Бүртгүүлэх"])
        UC2(["Нэвтрэх"])
        UC3(["Нууц үг сэргээх"])
    end

    subgraph UC_Doc ["Баримт бичиг удирдлага"]
        UC4(["PDF/TXT файл байршуулах"])
        UC5(["Баримт бичиг жагсаалт харах"])
        UC6(["Баримт бичиг хайх / шүүх"])
        UC7(["Баримт бичиг дэлгэрэнгүй харах"])
        UC8(["Баримт бичиг татах"])
        UC9(["Баримт бичиг устгах"])
    end

    subgraph UC_Chat ["AI Чатбот"]
        UC10(["Асуулт асуух"])
        UC11(["Хариулт + эшлэл харах"])
        UC12(["Чат түүх харах"])
        UC13(["Шинэ чат эхлүүлэх"])
        UC14(["Чат устгах"])
        UC15(["Баримт бичиг сонгож асуух"])
    end

    subgraph UC_Learn ["Суралцах явц"]
        UC16(["KA/KU мэдлэгийн түвшин харах"])
        UC17(["Тест өгөх"])
        UC18(["Flashcard ашиглах"])
    end

    Student --- UC1
    Student --- UC2
    Student --- UC3

    Student --- UC4
    Student --- UC5
    Student --- UC6
    Student --- UC7
    Student --- UC8
    Student --- UC9

    Student --- UC10
    Student --- UC11
    Student --- UC12
    Student --- UC13
    Student --- UC14
    Student --- UC15

    Student --- UC16
    Student -.- UC17
    Student -.- UC18

    UC5 -.->|extend| UC6
    UC10 -.->|include| UC15

    style UC17 fill:#f5f5f5,stroke-dasharray: 5 5
    style UC18 fill:#f5f5f5,stroke-dasharray: 5 5
    style Student fill:#e3f2fd
```

### 3.2 Системийн автомат Use Case

```mermaid
flowchart LR
    System(("Систем / AI"))

    subgraph UC_Ingest ["Баримт бичиг боловсруулалт"]
        direction TB
        UC20(["PDF текст задлах"])
        UC21(["Текст chunk болгох"])
        UC22(["KA/KU ангилах (Claude)"])
        UC23(["Embedding үүсгэх (bge-m3)"])
        UC24(["Weaviate-д индекслэх"])
    end

    subgraph UC_RAG ["Асуулт-Хариулт (RAG)"]
        direction TB
        UC25(["Асуултыг KA/KU ангилах"])
        UC26(["Семантик хайлт хийх"])
        UC27(["Claude-ээр хариулт үүсгэх"])
        UC28(["Эшлэл бүрдүүлэх"])
        UC29(["Мэдлэгийн түвшин шинэчлэх"])
    end

    System --- UC20
    System --- UC25

    UC20 --> UC21
    UC21 --> UC22
    UC22 --> UC23
    UC23 --> UC24

    UC25 --> UC26
    UC26 --> UC27
    UC27 --> UC28
    UC28 --> UC29

    style System fill:#fff3e0
```

<!-- ### 3.3 Админы Use Case (Phase 3 — төлөвлөгдсөн)

```mermaid
flowchart LR
    Admin(("Админ"))

    subgraph UC_Admin ["Админ удирдлага"]
        UC30(["Хэрэглэгчдийн жагсаалт"])
        UC31(["Taxonomy удирдах"])
        UC32(["Аналитик харах"])
        UC33(["Документ хяналт"])
    end

    Admin -.- UC30
    Admin -.- UC31
    Admin -.- UC32
    Admin -.- UC33

    style UC30 fill:#f5f5f5,stroke-dasharray: 5 5
    style UC31 fill:#f5f5f5,stroke-dasharray: 5 5
    style UC32 fill:#f5f5f5,stroke-dasharray: 5 5
    style UC33 fill:#f5f5f5,stroke-dasharray: 5 5
    style UC_Admin fill:#f5f5f5,stroke-dasharray: 5 5
    style Admin fill:#fce4ec
``` -->

---

## 4. Sequence Diagram — RAG Pipeline (Асуулт-Хариулт)

```mermaid
sequenceDiagram
    actor User as Суралцагч
    participant FE as Frontend
    participant API as /api/chat
    participant DB as PostgreSQL
    participant TAX as Taxonomy Classifier
    participant LLM as Claude API
    participant EMB as bge-m3 Embedding
    participant WV as Weaviate

    User->>FE: Асуулт бичиж илгээх
    FE->>API: POST /api/chat (question, sessionId, documentIds)

    alt Шинэ чат
        API->>DB: ChatSession үүсгэх
        DB-->>API: sessionId
    end

    API->>DB: ChatMessage хадгалах (role: user)

    rect rgb(255, 248, 225)
        Note over API,LLM: 1. Асуултыг ангилах (Taxonomy Classification)
        API->>TAX: classifyChunk(question)
        TAX->>LLM: claude-haiku-4-5 (text → KA/KU)
        LLM-->>TAX: { kaCode, kuCode }
        TAX-->>API: { kaCode, kuCode }
    end

    rect rgb(225, 245, 254)
        Note over API,WV: 2. Семантик хайлт (Retrieval)
        API->>EMB: embedText(question)
        EMB-->>API: queryVector [1024-dim]
        API->>WV: nearVector(queryVector, kaCode filter)
        alt KA шүүлтүүртэй >= 2 үр дүн
            WV-->>API: top 8 chunks (KA filtered)
        else Үр дүн < 2
            API->>WV: nearVector(queryVector, no KA filter)
            WV-->>API: top 8 chunks (unfiltered)
        end
        Note over API: Top 4 chunks сонгох (by score)
    end

    rect rgb(232, 245, 233)
        Note over API,LLM: 3. Хариулт үүсгэх (Answer Generation)
        API->>LLM: claude-haiku-4-5 (system: context + chunks, user: question)
        LLM-->>API: answer text with [1],[2]... references
    end

    rect rgb(243, 229, 245)
        Note over API,DB: 4. Хадгалах + Citation
        API->>DB: ChatMessage хадгалах (role: assistant)
        API->>DB: MessageCitation хадгалах (chunk → message mapping)
    end

    API-->>FE: { sessionId, answer, citations[], kaCode, kuCode }
    FE-->>User: Хариулт + иш татгаа харуулах
```

---

## 4.1 RAG Pipeline — Mermaid биш (Markdown Text Diagram)

```text
[User]
    |
    | 1) Асуулт оруулах + documentIds сонгох
    v
[Frontend]
    |
    | POST /api/chat (question, sessionId?, documentIds[])
    v
[API Route]
    |
    |-- 2) JWT validate
    |-- 3) User message save (PostgreSQL: chat_messages)
    |
    |-- 4) Question Taxonomy Classification
    |      API -> Taxonomy Classifier -> Claude
    |      result: kaCode, kuCode
    |
    |-- 5) Retrieval
    |      5.1 Query embedding (bge-m3)
    |      5.2 Weaviate nearVector + filters(userId, documentIds, kaCode)
    |      5.3 Хэрэв KA-filter үр дүн < 2 бол fallback (kaCode-гүй)
    |      5.4 Top-8 -> Top-4 chunks selection
    |
    |-- 6) Answer Generation
    |      Claude-д context(top-4 chunks) + user question илгээх
    |      result: grounded answer
    |
    |-- 7) Citation Mapping
    |      assistant message save
    |      message_citations save (chunkId, pageNumber, score...)
    |
    |-- 8) Optional Mastery Update
    |      chat evidence record (fail бол non-blocking)
    |
    v
[API Response]
    { sessionId, answer, citations[], kaCode, kuCode }
    |
    v
[Frontend Render]
    - Хариулт
    - Эшлэл
    - Follow-up question loop

Error/Edge Paths:
- Хэрэв retrieval хоосон бол: "материалаас олдсонгүй" safe response
- Хэрэв mastery update алдаа гарвал: хариултыг буцаах хэвээр
```

---

## 4.2 RAG Pipeline — Mermaid Diagram

```mermaid
flowchart TD
    U[User асуулт оруулах] --> FE[Frontend]
    FE --> API[POST /api/chat]

    API --> AUTH[JWT validate]
    AUTH --> MSG[User message save]

    MSG --> CLS[Question classify kaCode kuCode]
    CLS --> EMB[Query embedding bge-m3]
    EMB --> WV1[Weaviate search with KA filter]

    WV1 --> DEC{"Filtered hits >= 2"}
    DEC -->|Yes| TOP[Top 8 to Top 4 chunks]
    DEC -->|No| WV2[Fallback search without KA filter]
    WV2 --> TOP

    TOP --> GEN[Claude answer generation]
    GEN --> CIT[Citation mapping save]
    CIT --> MUP[Optional mastery update]
    MUP --> RES[Response answer citations kaCode kuCode]
    RES --> RENDER[Frontend render]

    WV1 -. no chunks .-> SAFE[Safe response: materials not found]
    MUP -. fail is non blocking .-> RES

    style TOP fill:#e8f5e9
    style GEN fill:#fff8e1
    style EMB fill:#e3f2fd
    style SAFE fill:#ffcdd2
```

---

## 5. ER Diagram — Өгөгдлийн сангийн бүтэц

```mermaid
erDiagram
    User ||--o{ Document : "байршуулсан"
    User ||--o{ ChatSession : "эзэмшдэг"
    User ||--o{ UserMastery : "KA түвшин"
    User ||--o{ UserKuMastery : "KU түвшин"
    User ||--o{ MasteryEvidence : "нотолгоо"
    User ||--o{ QuizAttempt : "тест"
    User ||--o{ FlashcardAttempt : "карт"

    Document ||--o{ DocumentPage : "хуудсууд"
    Document ||--o{ DocumentChunk : "chunk-ууд"
    Document ||--o{ MessageCitation : "иш татгаа"

    DocumentPage ||--o{ DocumentChunk : "chunk-ууд"

    ChatSession ||--o{ ChatMessage : "мессежүүд"
    ChatSession ||--o{ MasteryEvidence : "нотолгоо"
    ChatSession ||--o{ QuizAttempt : "тест"
    ChatSession ||--o{ FlashcardAttempt : "карт"

    ChatMessage ||--o{ MessageCitation : "иш татгаа"
    ChatMessage ||--o{ MasteryEvidence : "нотолгоо"

    DocumentChunk ||--o{ MessageCitation : "иш татгаа"

    Domain ||--o{ KnowledgeArea : "KA-ууд"
    KnowledgeArea ||--o{ KnowledgeUnit : "KU-ууд"
    KnowledgeArea ||--o{ KaSourceMapping : "mapping"
    KnowledgeArea ||--o{ UserMastery : "түвшин"
    KnowledgeArea ||--o{ MasteryEvidence : "нотолгоо"
    KnowledgeArea ||--o{ QuizAttempt : "тест"
    KnowledgeArea ||--o{ FlashcardAttempt : "карт"

    KnowledgeUnit ||--o{ Topic : "сэдвүүд"
    KnowledgeUnit ||--o{ LearningOutcome : "үр дүн"
    KnowledgeUnit ||--o{ UserKuMastery : "түвшин"
    KnowledgeUnit ||--o{ MasteryEvidence : "нотолгоо"
    KnowledgeUnit ||--o{ QuizAttempt : "тест"
    KnowledgeUnit ||--o{ FlashcardAttempt : "карт"

    BokSource ||--o{ KaSourceMapping : "mapping"

    Topic ||--o{ MasteryEvidence : "нотолгоо"
    LearningOutcome ||--o{ MasteryEvidence : "нотолгоо"

    User {
        bigint id PK
        string email UK
        string fullName
        string passwordHash
    }

    Document {
        bigint id PK
        bigint userId FK
        string title
        string sourceType "pdf | plain_text"
        string fileName
        string storagePath
        bigint fileSize
        string status "uploaded | parsing | indexed | error"
    }

    DocumentPage {
        bigint id PK
        bigint documentId FK
        int pageNumber
        string extractedText
    }

    DocumentChunk {
        bigint id PK
        bigint documentId FK
        bigint pageId FK
        int chunkIndex
        string chunkText
        string chunkHash
        int tokenCount
        json taxonomyMetadata "kaCode + kuCode"
    }

    ChatSession {
        bigint id PK
        bigint userId FK
        string title
        string mode "tutoring"
    }

    ChatMessage {
        bigint id PK
        bigint sessionId FK
        string role "user | assistant"
        string content
        string messageType "chat"
    }

    MessageCitation {
        bigint id PK
        bigint messageId FK
        bigint documentId FK
        bigint chunkId FK
        int pageNumber
        string citationLabel
        string excerptText
        decimal relevanceScore
    }

    Domain {
        bigint id PK
        string code UK
        string name
    }

    KnowledgeArea {
        bigint id PK
        bigint domainId FK
        string kaCode UK
        string name
        boolean isCore
    }

    KnowledgeUnit {
        bigint id PK
        bigint knowledgeAreaId FK
        string kuCode UK
        string name
        boolean isCore
    }

    UserMastery {
        bigint id PK
        bigint userId FK
        bigint knowledgeAreaId FK
        decimal masteryScore "0.0-1.0"
        decimal confidenceScore
        int evidenceCount
    }

    UserKuMastery {
        bigint id PK
        bigint userId FK
        bigint knowledgeUnitId FK
        decimal masteryScore "0.0-1.0"
        decimal confidenceScore
        int evidenceCount
    }

    MasteryEvidence {
        bigint id PK
        bigint userId FK
        bigint sessionId FK
        bigint messageId FK
        string evidenceType "chat | quiz | flashcard"
        decimal scoreDelta
        decimal confidenceDelta
    }

    QuizAttempt {
        bigint id PK
        bigint userId FK
        decimal score
        int totalQuestions
        int correctAnswers
    }

    FlashcardAttempt {
        bigint id PK
        bigint userId FK
        string promptText
        string userAnswer
        boolean isCorrect
    }

    Topic {
        bigint id PK
        bigint knowledgeUnitId FK
        string topicName
    }

    LearningOutcome {
        bigint id PK
        bigint knowledgeUnitId FK
        string outcomeText
    }

    BokSource {
        bigint id PK
        string sourceCode UK
        string sourceName
    }

    KaSourceMapping {
        bigint id PK
        bigint knowledgeAreaId FK
        bigint sourceId FK
        string sourceReference
    }
```
