ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "trust_public" boolean DEFAULT false NOT NULL;
