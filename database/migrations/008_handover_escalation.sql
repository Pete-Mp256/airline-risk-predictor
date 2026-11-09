-- Tracks which submitted handovers with unticked High risk items have been escalated
-- (schema.sql already includes it).
-- psql -d incident_risk_predictor -f database/migrations/008_handover_escalation.sql
ALTER TABLE handovers ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ;
