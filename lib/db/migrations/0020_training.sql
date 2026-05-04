-- Migration: 0020_training
-- Creates training_modules, training_completions, and background_checks tables

CREATE TABLE IF NOT EXISTS training_modules (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID REFERENCES organizations(id) ON DELETE CASCADE,
  title            VARCHAR(500) NOT NULL,
  description      TEXT,
  content          TEXT,
  content_type     VARCHAR(50) DEFAULT 'text',
  estimated_minutes INTEGER,
  passing_score    INTEGER DEFAULT 80,
  is_required      BOOLEAN DEFAULT FALSE,
  is_active        BOOLEAN DEFAULT TRUE,
  is_built_in      BOOLEAN DEFAULT FALSE,
  storage_key      TEXT,
  metadata         JSONB,
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS training_completions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id        UUID NOT NULL REFERENCES training_modules(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  completed_at     TIMESTAMPTZ,
  score            INTEGER,
  passed           BOOLEAN,
  attempt_count    INTEGER DEFAULT 0,
  certificate_key  TEXT,
  metadata         JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS background_checks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id          UUID REFERENCES users(id) ON DELETE SET NULL,
  candidate_name   VARCHAR(255) NOT NULL,
  candidate_email  VARCHAR(255) NOT NULL,
  status           VARCHAR(50) NOT NULL DEFAULT 'pending',
  provider         VARCHAR(100),
  external_id      VARCHAR(255),
  report_url       TEXT,
  requested_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  completed_at     TIMESTAMPTZ,
  metadata         JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_training_completions_user_id ON training_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_training_completions_module_id ON training_completions(module_id);
CREATE INDEX IF NOT EXISTS idx_training_completions_org_id ON training_completions(organization_id);
CREATE INDEX IF NOT EXISTS idx_training_modules_org_id ON training_modules(organization_id);
CREATE INDEX IF NOT EXISTS idx_training_modules_is_active ON training_modules(is_active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_training_completions_user_module ON training_completions(user_id, module_id);
