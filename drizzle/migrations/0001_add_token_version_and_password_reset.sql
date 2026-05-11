-- Add token_version column for JWT revocation (bumped on logout, deactivation, password change).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "token_version" integer NOT NULL DEFAULT 1;--> statement-breakpoint

-- Add single-use password reset token + expiry columns.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_reset_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_reset_expires_at" timestamp with time zone;
