-- sdkwork:migration
-- id: 0001_baseline
-- engine: postgres
-- module: sdkwork-agentstudio
-- purpose: Reverse the baseline migration by dropping all owned tables
-- reversible: true
-- transactional: true
-- lock: lightweight
-- contract_version: 0.1.0

DROP TABLE IF EXISTS agents;
DROP TABLE IF EXISTS runs;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS storage_entries;
DROP TABLE IF EXISTS host_catalog_documents;
