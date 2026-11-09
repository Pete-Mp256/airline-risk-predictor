-- Module 2: handover rule layer on predictions (schema.sql already includes it).
-- risk_level stays the model rating; final_risk_level is the rating after the handover checks.
-- psql -d incident_risk_predictor -f database/migrations/007_handover_risk_rules.sql
CREATE TYPE handover_level AS ENUM ('OK', 'Weak');

ALTER TABLE incident_predictions
    ADD COLUMN handover_flags   JSONB NOT NULL DEFAULT '[]',  -- [{code, label}, ...] checks that fired
    ADD COLUMN handover_level   handover_level NOT NULL DEFAULT 'OK',
    ADD COLUMN final_risk_level risk_level;

UPDATE incident_predictions SET final_risk_level = risk_level;
ALTER TABLE incident_predictions ALTER COLUMN final_risk_level SET NOT NULL;

CREATE INDEX idx_predictions_final_risk_level ON incident_predictions(final_risk_level);
