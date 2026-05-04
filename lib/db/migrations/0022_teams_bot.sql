-- Migration: 0022_teams_bot
-- Creates the teams_conversation_refs table for Microsoft Teams Bot integration

CREATE TABLE IF NOT EXISTS "teams_conversation_refs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "conversation_ref" jsonb NOT NULL,
  "service_url" text NOT NULL,
  "tenant_id" text,
  "teams_user_id" text,
  "channel_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
