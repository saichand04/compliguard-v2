-- Migration: 0004_firewall_dns_modules
-- Adds firewall_audits, firewall_findings, firewall_evidence, firewall_comments,
-- dns_audits, dns_issues, dns_evidence, dns_comments, and module_config tables

-- ─── New enums — Firewall Audit ───────────────────────────────────────────────
DO $$ BEGIN CREATE TYPE "firewall_audit_severity" AS ENUM ('info', 'low', 'medium', 'high', 'critical'); EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE TYPE "firewall_audit_status" AS ENUM ('open', 'in_progress', 'remediated', 'accepted', 'false_positive'); EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE TYPE "firewall_audit_type" AS ENUM ('perimeter', 'internal', 'cloud', 'waf', 'ngfw', 'other'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ─── New enums — DNS Audit ────────────────────────────────────────────────────
DO $$ BEGIN CREATE TYPE "dns_audit_severity" AS ENUM ('info', 'low', 'medium', 'high', 'critical'); EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE TYPE "dns_audit_status" AS ENUM ('open', 'in_progress', 'remediated', 'accepted', 'false_positive'); EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE TYPE "dns_audit_type" AS ENUM ('external', 'internal', 'both'); EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE TYPE "dns_issue_type" AS ENUM ('misconfiguration', 'dangling_record', 'missing_spf', 'missing_dmarc', 'missing_dkim', 'zone_transfer', 'subdomain_takeover', 'cache_poisoning', 'wildcard_record', 'other'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ─── firewall_audits ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "firewall_audits" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id"  uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name"             varchar(500) NOT NULL,
  "audit_type"       "firewall_audit_type" NOT NULL DEFAULT 'perimeter',
  "vendor"           varchar(255),
  "device_name"      varchar(255),
  "scope"            text,
  "audit_date"       timestamptz,
  "auditor_name"     varchar(255),
  "status"           "firewall_audit_status" NOT NULL DEFAULT 'open',
  "report_file_url"  text,
  "report_file_name" text,
  "created_by"       uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at"       timestamptz NOT NULL DEFAULT now(),
  "updated_at"       timestamptz NOT NULL DEFAULT now()
);

-- ─── firewall_findings ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "firewall_findings" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id"  uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "audit_id"         uuid NOT NULL REFERENCES "firewall_audits"("id") ON DELETE CASCADE,
  "title"            varchar(500) NOT NULL,
  "description"      text,
  "severity"         "firewall_audit_severity" NOT NULL DEFAULT 'medium',
  "status"           "firewall_audit_status" NOT NULL DEFAULT 'open',
  "rule_id"          varchar(255),
  "affected_device"  varchar(255),
  "affected_zone"    varchar(255),
  "risk_details"     text,
  "remediation"      text,
  "cvss_score"       varchar(10),
  "assigned_to"      uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "due_date"         timestamptz,
  "resolved_at"      timestamptz,
  "created_by"       uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at"       timestamptz NOT NULL DEFAULT now(),
  "updated_at"       timestamptz NOT NULL DEFAULT now()
);

-- ─── firewall_evidence ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "firewall_evidence" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "finding_id"      uuid NOT NULL REFERENCES "firewall_findings"("id") ON DELETE CASCADE,
  "file_name"       varchar(500) NOT NULL,
  "file_url"        text NOT NULL,
  "file_type"       varchar(50) NOT NULL DEFAULT 'other',
  "file_size_bytes" integer,
  "uploaded_by"     uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "description"     text,
  "created_at"      timestamptz NOT NULL DEFAULT now()
);

-- ─── firewall_comments ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "firewall_comments" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "finding_id"       uuid NOT NULL REFERENCES "firewall_findings"("id") ON DELETE CASCADE,
  "organization_id"  uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "content"          text NOT NULL,
  "author_name"      varchar(255),
  "created_by"       uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at"       timestamptz NOT NULL DEFAULT now(),
  "updated_at"       timestamptz NOT NULL DEFAULT now()
);

-- ─── dns_audits ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "dns_audits" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id"  uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name"             varchar(500) NOT NULL,
  "audit_type"       "dns_audit_type" NOT NULL DEFAULT 'both',
  "domain"           varchar(255),
  "scope"            text,
  "audit_date"       timestamptz,
  "auditor_name"     varchar(255),
  "status"           varchar(50) NOT NULL DEFAULT 'active',
  "report_file_url"  text,
  "report_file_name" text,
  "created_by"       uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at"       timestamptz NOT NULL DEFAULT now(),
  "updated_at"       timestamptz NOT NULL DEFAULT now()
);

-- ─── dns_issues ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "dns_issues" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id"  uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "audit_id"         uuid NOT NULL REFERENCES "dns_audits"("id") ON DELETE CASCADE,
  "title"            varchar(500) NOT NULL,
  "description"      text,
  "severity"         "dns_audit_severity" NOT NULL DEFAULT 'medium',
  "status"           "dns_audit_status" NOT NULL DEFAULT 'open',
  "issue_type"       "dns_issue_type" NOT NULL DEFAULT 'misconfiguration',
  "affected_record"  varchar(500),
  "record_type"      varchar(50),
  "affected_domain"  varchar(255),
  "current_value"    text,
  "expected_value"   text,
  "risk_details"     text,
  "remediation"      text,
  "assigned_to"      uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "due_date"         timestamptz,
  "resolved_at"      timestamptz,
  "created_by"       uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at"       timestamptz NOT NULL DEFAULT now(),
  "updated_at"       timestamptz NOT NULL DEFAULT now()
);

-- ─── dns_evidence ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "dns_evidence" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "issue_id"        uuid NOT NULL REFERENCES "dns_issues"("id") ON DELETE CASCADE,
  "file_name"       varchar(500) NOT NULL,
  "file_url"        text NOT NULL,
  "file_type"       varchar(50) NOT NULL DEFAULT 'other',
  "file_size_bytes" integer,
  "uploaded_by"     uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "description"     text,
  "created_at"      timestamptz NOT NULL DEFAULT now()
);

-- ─── dns_comments ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "dns_comments" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "issue_id"         uuid NOT NULL REFERENCES "dns_issues"("id") ON DELETE CASCADE,
  "organization_id"  uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "content"          text NOT NULL,
  "author_name"      varchar(255),
  "created_by"       uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at"       timestamptz NOT NULL DEFAULT now(),
  "updated_at"       timestamptz NOT NULL DEFAULT now()
);

-- ─── module_config ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "module_config" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id"  uuid NOT NULL UNIQUE REFERENCES "organizations"("id") ON DELETE CASCADE,
  "modules"          jsonb NOT NULL DEFAULT '{}',
  "created_at"       timestamptz NOT NULL DEFAULT now(),
  "updated_at"       timestamptz NOT NULL DEFAULT now()
);

-- ─── Indexes — Firewall ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "idx_firewall_audits_org_id"         ON "firewall_audits"("organization_id");
CREATE INDEX IF NOT EXISTS "idx_firewall_audits_status"         ON "firewall_audits"("status");
CREATE INDEX IF NOT EXISTS "idx_firewall_findings_org_id"       ON "firewall_findings"("organization_id");
CREATE INDEX IF NOT EXISTS "idx_firewall_findings_audit_id"     ON "firewall_findings"("audit_id");
CREATE INDEX IF NOT EXISTS "idx_firewall_findings_status"       ON "firewall_findings"("status");
CREATE INDEX IF NOT EXISTS "idx_firewall_findings_severity"     ON "firewall_findings"("severity");
CREATE INDEX IF NOT EXISTS "idx_firewall_findings_assigned_to"  ON "firewall_findings"("assigned_to");
CREATE INDEX IF NOT EXISTS "idx_firewall_evidence_finding_id"   ON "firewall_evidence"("finding_id");
CREATE INDEX IF NOT EXISTS "idx_firewall_evidence_org_id"       ON "firewall_evidence"("organization_id");
CREATE INDEX IF NOT EXISTS "idx_firewall_comments_finding_id"   ON "firewall_comments"("finding_id");

-- ─── Indexes — DNS ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "idx_dns_audits_org_id"              ON "dns_audits"("organization_id");
CREATE INDEX IF NOT EXISTS "idx_dns_audits_status"              ON "dns_audits"("status");
CREATE INDEX IF NOT EXISTS "idx_dns_issues_org_id"              ON "dns_issues"("organization_id");
CREATE INDEX IF NOT EXISTS "idx_dns_issues_audit_id"            ON "dns_issues"("audit_id");
CREATE INDEX IF NOT EXISTS "idx_dns_issues_status"              ON "dns_issues"("status");
CREATE INDEX IF NOT EXISTS "idx_dns_issues_severity"            ON "dns_issues"("severity");
CREATE INDEX IF NOT EXISTS "idx_dns_issues_assigned_to"         ON "dns_issues"("assigned_to");
CREATE INDEX IF NOT EXISTS "idx_dns_issues_issue_type"          ON "dns_issues"("issue_type");
CREATE INDEX IF NOT EXISTS "idx_dns_evidence_issue_id"          ON "dns_evidence"("issue_id");
CREATE INDEX IF NOT EXISTS "idx_dns_evidence_org_id"            ON "dns_evidence"("organization_id");
CREATE INDEX IF NOT EXISTS "idx_dns_comments_issue_id"          ON "dns_comments"("issue_id");

-- ─── Indexes — Module Config ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "idx_module_config_org_id"           ON "module_config"("organization_id");
