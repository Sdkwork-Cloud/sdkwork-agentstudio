-- sdkwork:migration
-- id: 0001_baseline
-- engine: postgres
-- module: sdkwork-agentstudio
-- purpose: Capture existing standalone desktop schema as the baseline migration
-- reversible: true
-- transactional: true
-- lock: lightweight
-- contract_version: 0.1.0

-- host_catalog_documents: central catalog store (host-core)
CREATE TABLE IF NOT EXISTS host_catalog_documents (
    catalog_key TEXT PRIMARY KEY,
    document_json TEXT NOT NULL,
    updated_at BIGINT NOT NULL DEFAULT ((EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT)
);

-- storage_entries: key-value storage (desktop)
CREATE TABLE IF NOT EXISTS storage_entries (
    namespace TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT),
    PRIMARY KEY (namespace, key)
);

-- sessions: chat sessions (desktop hermes_chat)
CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    title TEXT
);

-- messages: chat messages (desktop hermes_chat)
CREATE TABLE IF NOT EXISTS messages (
    id BIGSERIAL PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    run_id TEXT,
    model TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY(session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);

-- runs: agent runs (desktop hermes_chat)
CREATE TABLE IF NOT EXISTS runs (
    run_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    agent_id TEXT,
    model TEXT,
    status TEXT NOT NULL,
    created_at_ms BIGINT NOT NULL,
    updated_at_ms BIGINT NOT NULL,
    FOREIGN KEY(session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);

-- agents: agent profiles (desktop hermes_chat)
CREATE TABLE IF NOT EXISTS agents (
    instance_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    label TEXT NOT NULL,
    description TEXT,
    source TEXT NOT NULL,
    system_prompt TEXT,
    avatar TEXT,
    creator TEXT,
    PRIMARY KEY (instance_id, agent_id)
);
