-- Adds the email 2FA table to an existing database (schema.sql already includes it).
-- psql -d incident_risk_predictor -f database/migrations/001_login_codes.sql
CREATE TABLE IF NOT EXISTS login_codes (
    manager_id      INTEGER PRIMARY KEY REFERENCES shift_managers(manager_id) ON DELETE CASCADE,
    code_hash       CHAR(64) NOT NULL,
    attempts        SMALLINT NOT NULL DEFAULT 0,
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
