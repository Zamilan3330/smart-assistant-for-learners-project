
-- =========================================
-- 1. DOMAINS
-- =========================================
CREATE TABLE domains (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =========================================
-- 2. BOK SOURCES
-- =========================================
CREATE TABLE bok_sources (
    id BIGSERIAL PRIMARY KEY,
    source_code VARCHAR(50) NOT NULL UNIQUE,
    source_name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =========================================
-- 3. KNOWLEDGE AREAS
-- =========================================
CREATE TABLE knowledge_areas (
    id BIGSERIAL PRIMARY KEY,
    domain_id BIGINT NOT NULL,
    ka_code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_core BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_knowledge_areas_domain
        FOREIGN KEY (domain_id)
        REFERENCES domains(id)
        ON DELETE CASCADE
);

-- =========================================
-- 4. KA SOURCE MAPPINGS
-- =========================================
CREATE TABLE ka_source_mappings (
    id BIGSERIAL PRIMARY KEY,
    knowledge_area_id BIGINT NOT NULL,
    source_id BIGINT NOT NULL,
    source_reference VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_ka_source_mappings_ka
        FOREIGN KEY (knowledge_area_id)
        REFERENCES knowledge_areas(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_ka_source_mappings_source
        FOREIGN KEY (source_id)
        REFERENCES bok_sources(id)
        ON DELETE CASCADE,
    CONSTRAINT uq_ka_source_mapping
        UNIQUE (knowledge_area_id, source_id, source_reference)
);

-- =========================================
-- 5. KNOWLEDGE UNITS
-- =========================================
CREATE TABLE knowledge_units (
    id BIGSERIAL PRIMARY KEY,
    knowledge_area_id BIGINT NOT NULL,
    ku_code VARCHAR(120) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_core BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_knowledge_units_ka
        FOREIGN KEY (knowledge_area_id)
        REFERENCES knowledge_areas(id)
        ON DELETE CASCADE
);

-- =========================================
-- 6. TOPICS
-- =========================================
CREATE TABLE topics (
    id BIGSERIAL PRIMARY KEY,
    knowledge_unit_id BIGINT NOT NULL,
    topic_name VARCHAR(255) NOT NULL,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_topics_ku
        FOREIGN KEY (knowledge_unit_id)
        REFERENCES knowledge_units(id)
        ON DELETE CASCADE
);

-- =========================================
-- 7. LEARNING OUTCOMES
-- =========================================
CREATE TABLE learning_outcomes (
    id BIGSERIAL PRIMARY KEY,
    knowledge_unit_id BIGINT NOT NULL,
    outcome_text TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_learning_outcomes_ku
        FOREIGN KEY (knowledge_unit_id)
        REFERENCES knowledge_units(id)
        ON DELETE CASCADE
);

-- =========================================
-- 8. USERS
-- =========================================
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255),
    password_hash TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =========================================
-- 9. USER MASTERY
-- =========================================
CREATE TABLE user_mastery (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    knowledge_area_id BIGINT NOT NULL,
    mastery_score NUMERIC(5,4) NOT NULL DEFAULT 0.0000,
    confidence_score NUMERIC(5,4) NOT NULL DEFAULT 0.0000,
    evidence_count INTEGER NOT NULL DEFAULT 0,
    last_assessed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_user_mastery_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_user_mastery_ka
        FOREIGN KEY (knowledge_area_id)
        REFERENCES knowledge_areas(id)
        ON DELETE CASCADE,
    CONSTRAINT uq_user_mastery_user_ka
        UNIQUE (user_id, knowledge_area_id),
    CONSTRAINT chk_user_mastery_mastery_score
        CHECK (mastery_score >= 0.0 AND mastery_score <= 1.0),
    CONSTRAINT chk_user_mastery_confidence_score
        CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
    CONSTRAINT chk_user_mastery_evidence_count
        CHECK (evidence_count >= 0)
);

-- =========================================
-- 10. DOCUMENTS
-- =========================================
CREATE TABLE documents (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    title VARCHAR(500) NOT NULL,
    source_type VARCHAR(50) NOT NULL, -- pdf, plain_text
    file_name VARCHAR(500),
    mime_type VARCHAR(100),
    storage_path TEXT,
    raw_text TEXT,
    file_size BIGINT,
    checksum VARCHAR(128),
    status VARCHAR(50) NOT NULL DEFAULT 'uploaded', 
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_documents_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);


-- =========================================
-- 12. DOCUMENT PAGES
-- =========================================
CREATE TABLE document_pages (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL,
    page_number INTEGER NOT NULL,
    extracted_text TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_document_pages_document
        FOREIGN KEY (document_id)
        REFERENCES documents(id)
        ON DELETE CASCADE,
    CONSTRAINT uq_document_pages_document_page
        UNIQUE (document_id, page_number)
);

-- =========================================
-- 13. DOCUMENT CHUNKS
-- =========================================

CREATE TABLE document_chunks (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL,
    page_id BIGINT,
    page_number INTEGER,
    chunk_index INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    chunk_hash VARCHAR(128),
    start_offset INTEGER,
    end_offset INTEGER,
    token_count INTEGER,
    taxonomy_metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_document_chunks_document
        FOREIGN KEY (document_id)
        REFERENCES documents(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_document_chunks_page
        FOREIGN KEY (page_id)
        REFERENCES document_pages(id)
        ON DELETE SET NULL,
    CONSTRAINT uq_document_chunks_document_chunk
        UNIQUE (document_id, chunk_index)
);

-- =========================================
-- CHAT SESSIONS
-- =========================================

CREATE TABLE chat_sessions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    title VARCHAR(255),
    mode VARCHAR(50) NOT NULL DEFAULT 'tutoring', -- tutoring, document_qa
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_chat_sessions_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);



-- =========================================
-- CHAT MESSAGES
-- =========================================

CREATE TABLE chat_messages (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL,
    role VARCHAR(20) NOT NULL, -- user, assistant, system
    content TEXT NOT NULL,
    message_type VARCHAR(50) NOT NULL DEFAULT 'chat', -- chat, quiz, flashcard
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_chat_messages_session
        FOREIGN KEY (session_id)
        REFERENCES chat_sessions(id)
        ON DELETE CASCADE
);


-- =========================================
-- MESSAGE CITATIONS
-- =========================================

CREATE TABLE message_citations (
    id BIGSERIAL PRIMARY KEY,
    message_id BIGINT NOT NULL,
    document_id BIGINT NOT NULL,
    chunk_id BIGINT NOT NULL,
    page_number INTEGER,
    citation_label VARCHAR(50) NOT NULL, -- [1], [2]
    excerpt_text TEXT NOT NULL,
    relevance_score NUMERIC(6,4),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_message_citations_message
        FOREIGN KEY (message_id)
        REFERENCES chat_messages(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_message_citations_document
        FOREIGN KEY (document_id)
        REFERENCES documents(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_message_citations_chunk
        FOREIGN KEY (chunk_id)
        REFERENCES document_chunks(id)
        ON DELETE CASCADE
);

-- =========================================
-- USER KU MASTERY - KU-level mastery
-- =========================================
CREATE TABLE user_ku_mastery (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    knowledge_unit_id BIGINT NOT NULL,
    mastery_score NUMERIC(5,4) NOT NULL DEFAULT 0.0000,
    confidence_score NUMERIC(5,4) NOT NULL DEFAULT 0.0000,
    evidence_count INTEGER NOT NULL DEFAULT 0,
    last_assessed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_user_ku_mastery_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_user_ku_mastery_ku
        FOREIGN KEY (knowledge_unit_id)
        REFERENCES knowledge_units(id)
        ON DELETE CASCADE,
    CONSTRAINT uq_user_ku_mastery_user_ku
        UNIQUE (user_id, knowledge_unit_id),
    CONSTRAINT chk_user_ku_mastery_mastery_score
        CHECK (mastery_score >= 0.0 AND mastery_score <= 1.0),
    CONSTRAINT chk_user_ku_mastery_confidence_score
        CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
    CONSTRAINT chk_user_ku_mastery_evidence_count
        CHECK (evidence_count >= 0)
);

-- =========================================
-- MASTERY EVIDENCE
-- =========================================

CREATE TABLE mastery_evidence (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    session_id BIGINT,
    message_id BIGINT,
    knowledge_area_id BIGINT,
    knowledge_unit_id BIGINT,
    topic_id BIGINT,
    learning_outcome_id BIGINT,
    evidence_type VARCHAR(50) NOT NULL, 
    score_delta NUMERIC(5,4) NOT NULL DEFAULT 0.0000,
    confidence_delta NUMERIC(5,4) NOT NULL DEFAULT 0.0000,
    evidence_text TEXT,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_mastery_evidence_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_mastery_evidence_session
        FOREIGN KEY (session_id)
        REFERENCES chat_sessions(id)
        ON DELETE SET NULL,
    CONSTRAINT fk_mastery_evidence_message
        FOREIGN KEY (message_id)
        REFERENCES chat_messages(id)
        ON DELETE SET NULL,
    CONSTRAINT fk_mastery_evidence_ka
        FOREIGN KEY (knowledge_area_id)
        REFERENCES knowledge_areas(id)
        ON DELETE SET NULL,
    CONSTRAINT fk_mastery_evidence_ku
        FOREIGN KEY (knowledge_unit_id)
        REFERENCES knowledge_units(id)
        ON DELETE SET NULL,
    CONSTRAINT fk_mastery_evidence_topic
        FOREIGN KEY (topic_id)
        REFERENCES topics(id)
        ON DELETE SET NULL,
    CONSTRAINT fk_mastery_evidence_lo
        FOREIGN KEY (learning_outcome_id)
        REFERENCES learning_outcomes(id)
        ON DELETE SET NULL
);

-- =========================================
-- QUIZ ATTEMPTS
-- =========================================

CREATE TABLE quiz_attempts (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    session_id BIGINT,
    knowledge_area_id BIGINT,
    knowledge_unit_id BIGINT,
    score NUMERIC(5,4) NOT NULL DEFAULT 0.0000,
    total_questions INTEGER NOT NULL DEFAULT 0,
    correct_answers INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_quiz_attempts_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_quiz_attempts_session
        FOREIGN KEY (session_id)
        REFERENCES chat_sessions(id)
        ON DELETE SET NULL,
    CONSTRAINT fk_quiz_attempts_ka
        FOREIGN KEY (knowledge_area_id)
        REFERENCES knowledge_areas(id)
        ON DELETE SET NULL,
    CONSTRAINT fk_quiz_attempts_ku
        FOREIGN KEY (knowledge_unit_id)
        REFERENCES knowledge_units(id)
        ON DELETE SET NULL
);


-- =========================================
-- FLASHCARD ATTEMPTS
-- =========================================

CREATE TABLE flashcard_attempts (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    session_id BIGINT,
    knowledge_area_id BIGINT,
    knowledge_unit_id BIGINT,
    prompt_text TEXT NOT NULL,
    expected_answer TEXT,
    user_answer TEXT,
    is_correct BOOLEAN,
    score NUMERIC(5,4) NOT NULL DEFAULT 0.0000,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_flashcard_attempts_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_flashcard_attempts_session
        FOREIGN KEY (session_id)
        REFERENCES chat_sessions(id)
        ON DELETE SET NULL,
    CONSTRAINT fk_flashcard_attempts_ka
        FOREIGN KEY (knowledge_area_id)
        REFERENCES knowledge_areas(id)
        ON DELETE SET NULL,
    CONSTRAINT fk_flashcard_attempts_ku
        FOREIGN KEY (knowledge_unit_id)
        REFERENCES knowledge_units(id)
        ON DELETE SET NULL
);



-- =========================================
-- INDEXES
-- =========================================
CREATE INDEX idx_knowledge_areas_domain_id
    ON knowledge_areas(domain_id);

CREATE INDEX idx_knowledge_units_knowledge_area_id
    ON knowledge_units(knowledge_area_id);

CREATE INDEX idx_topics_knowledge_unit_id
    ON topics(knowledge_unit_id);

CREATE INDEX idx_learning_outcomes_knowledge_unit_id
    ON learning_outcomes(knowledge_unit_id);

CREATE INDEX idx_user_mastery_user_id
    ON user_mastery(user_id);

CREATE INDEX idx_user_mastery_knowledge_area_id
    ON user_mastery(knowledge_area_id);

CREATE INDEX idx_ka_source_mappings_knowledge_area_id
    ON ka_source_mappings(knowledge_area_id);

CREATE INDEX idx_ka_source_mappings_source_id
    ON ka_source_mappings(source_id);

CREATE INDEX idx_documents_user_id
    ON documents(user_id);

CREATE INDEX idx_documents_status
    ON documents(status);

CREATE INDEX idx_document_pages_document_id
    ON document_pages(document_id);

CREATE INDEX idx_document_chunks_document_id
    ON document_chunks(document_id);

CREATE INDEX idx_document_chunks_page_number
    ON document_chunks(page_number);

CREATE INDEX idx_chat_sessions_user_id
    ON chat_sessions(user_id);

CREATE INDEX idx_chat_messages_session_id
    ON chat_messages(session_id);

CREATE INDEX idx_message_citations_message_id
    ON message_citations(message_id);

CREATE INDEX idx_message_citations_document_id
    ON message_citations(document_id);

CREATE INDEX idx_user_ku_mastery_user_id
    ON user_ku_mastery(user_id);

CREATE INDEX idx_user_ku_mastery_ku_id
    ON user_ku_mastery(knowledge_unit_id);

CREATE INDEX idx_mastery_evidence_user_id
    ON mastery_evidence(user_id);

CREATE INDEX idx_mastery_evidence_ka_id
    ON mastery_evidence(knowledge_area_id);

CREATE INDEX idx_mastery_evidence_ku_id
    ON mastery_evidence(knowledge_unit_id);

CREATE INDEX idx_mastery_evidence_message_id
    ON mastery_evidence(message_id);

CREATE INDEX idx_quiz_attempts_user_id
    ON quiz_attempts(user_id);

CREATE INDEX idx_flashcard_attempts_user_id
    ON flashcard_attempts(user_id);
