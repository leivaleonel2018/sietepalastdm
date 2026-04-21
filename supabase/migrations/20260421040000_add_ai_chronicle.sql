-- Add ai_chronicle column to matches and challenges tables
ALTER TABLE matches ADD COLUMN IF NOT EXISTS ai_chronicle text;
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS ai_chronicle text;
