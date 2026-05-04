-- Migration: 0021_knowledge_base
-- Knowledge Base Entries table with vector embedding support (stored as JSONB until pgvector)

CREATE TABLE IF NOT EXISTS knowledge_base_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  title         VARCHAR(500) NOT NULL,
  content       TEXT NOT NULL,
  category      VARCHAR(100),
  tags          JSONB,
  embedding     JSONB,
  is_public     BOOLEAN DEFAULT FALSE,
  is_built_in   BOOLEAN DEFAULT FALSE,
  metadata      JSONB,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_kb_entries_category
  ON knowledge_base_entries (category);

CREATE INDEX IF NOT EXISTS idx_kb_entries_source_type
  ON knowledge_base_entries ((metadata->>'sourceType'));

CREATE INDEX IF NOT EXISTS idx_kb_entries_org_id
  ON knowledge_base_entries (organization_id);

CREATE INDEX IF NOT EXISTS idx_kb_entries_is_public
  ON knowledge_base_entries (is_public);

CREATE INDEX IF NOT EXISTS idx_kb_entries_created_at
  ON knowledge_base_entries (created_at DESC);
