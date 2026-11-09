-- Shift handover as its own record (schema.sql already includes it).
-- psql -d incident_risk_predictor -f database/migrations/006_handovers.sql
CREATE TYPE handover_status AS ENUM ('Draft', 'Submitted', 'Acknowledged');
CREATE TYPE handover_item_type AS ENUM ('Open task', 'Incident', 'Note');

CREATE TABLE handovers (
    handover_id     SERIAL PRIMARY KEY,
    shift_id        INTEGER NOT NULL UNIQUE REFERENCES shifts(shift_id) ON DELETE CASCADE,
    from_manager_id INTEGER NOT NULL REFERENCES shift_managers(manager_id) ON DELETE RESTRICT,
    to_manager_id   INTEGER REFERENCES shift_managers(manager_id) ON DELETE SET NULL,  -- NULL: whole department
    summary         TEXT,
    status          handover_status NOT NULL DEFAULT 'Draft',
    submitted_at    TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by INTEGER REFERENCES shift_managers(manager_id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_handovers_from ON handovers(from_manager_id);
CREATE INDEX idx_handovers_to ON handovers(to_manager_id);

CREATE TABLE handover_items (
    item_id         SERIAL PRIMARY KEY,
    handover_id     INTEGER NOT NULL REFERENCES handovers(handover_id) ON DELETE CASCADE,
    item_type       handover_item_type NOT NULL,
    task_id         INTEGER REFERENCES tasks(task_id) ON DELETE CASCADE,
    incident_id     INTEGER REFERENCES incidents(incident_id) ON DELETE CASCADE,
    note            TEXT,
    carried_over    BOOLEAN NOT NULL DEFAULT FALSE,  -- still open, passed to the incoming shift
    acknowledged_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_handover_item_ref CHECK (
        (item_type = 'Open task' AND task_id IS NOT NULL AND incident_id IS NULL AND note IS NULL) OR
        (item_type = 'Incident'  AND incident_id IS NOT NULL AND task_id IS NULL AND note IS NULL) OR
        (item_type = 'Note'      AND note IS NOT NULL AND task_id IS NULL AND incident_id IS NULL)
    )
);

CREATE INDEX idx_handover_items_handover ON handover_items(handover_id);
