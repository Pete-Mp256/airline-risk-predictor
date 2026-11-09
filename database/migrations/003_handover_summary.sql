-- Tracks which shifts have had their end-of-shift handover summary emailed.
-- psql -d incident_risk_predictor -f database/migrations/003_handover_summary.sql
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS handover_sent_at TIMESTAMPTZ;
