-- Add AI config columns to FixAI and Code Parser organization tables.
-- Run this after updating the models, to add columns to existing databases.
--
-- Usage:
--   psql -U postgres -d fixai -f scripts/add_ai_config_columns.sql
--   psql -U postgres -d code_parser -f scripts/add_ai_config_columns.sql

-- Idempotent: only adds columns if they don't exist yet.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'organizations' AND column_name = 'claude_api_key') THEN
        ALTER TABLE organizations ADD COLUMN claude_api_key TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'organizations' AND column_name = 'claude_bedrock_url') THEN
        ALTER TABLE organizations ADD COLUMN claude_bedrock_url VARCHAR(512);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'organizations' AND column_name = 'claude_model_id') THEN
        ALTER TABLE organizations ADD COLUMN claude_model_id VARCHAR(200);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'organizations' AND column_name = 'claude_max_tokens') THEN
        ALTER TABLE organizations ADD COLUMN claude_max_tokens INTEGER;
    END IF;
END
$$;
