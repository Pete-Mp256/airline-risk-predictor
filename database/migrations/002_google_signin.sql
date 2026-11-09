-- Adds Google sign-in to an existing database (schema.sql already includes it).
-- psql -d incident_risk_predictor -f database/migrations/002_google_signin.sql
ALTER TABLE shift_managers ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE shift_managers ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;
