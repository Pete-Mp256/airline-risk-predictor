-- Tracks which unread High risk alerts have been escalated to a supervisor.
-- psql -d incident_risk_predictor -f database/migrations/005_alert_escalation.sql
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ;
