-- Incident Risk Predictor - PostgreSQL schema
-- Model inputs follow ml/model/model_meta.json: shift_type, task_status and six numeric features.

DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS incident_predictions CASCADE;
DROP TABLE IF EXISTS incidents CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS shifts CASCADE;
DROP TABLE IF EXISTS shift_managers CASCADE;
DROP TABLE IF EXISTS departments CASCADE;
DROP TYPE IF EXISTS risk_level;
DROP TYPE IF EXISTS shift_type;
DROP TYPE IF EXISTS task_status;

CREATE TYPE risk_level AS ENUM ('Low', 'Medium', 'High');
CREATE TYPE shift_type AS ENUM ('Morning', 'Afternoon', 'Night');
-- Same labels the model was trained on; Node maps pending/in-progress/complete to these.
CREATE TYPE task_status AS ENUM ('Pending', 'In Progress', 'Complete');

-- DEPARTMENTS (stored for the dashboard, not a model feature)
CREATE TABLE departments (
    department_id   SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL UNIQUE,
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SHIFT_MANAGERS
CREATE TABLE shift_managers (
    manager_id      SERIAL PRIMARY KEY,
    department_id   INTEGER REFERENCES departments(department_id) ON DELETE SET NULL,
    first_name      VARCHAR(50) NOT NULL,
    last_name       VARCHAR(50) NOT NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    phone           VARCHAR(20),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shift_managers_department ON shift_managers(department_id);

-- SHIFTS
CREATE TABLE shifts (
    shift_id        SERIAL PRIMARY KEY,
    manager_id      INTEGER NOT NULL REFERENCES shift_managers(manager_id) ON DELETE RESTRICT,
    department_id   INTEGER NOT NULL REFERENCES departments(department_id) ON DELETE RESTRICT,
    shift_type      shift_type NOT NULL,
    shift_date      DATE NOT NULL,
    start_time      TIMESTAMPTZ NOT NULL,
    end_time        TIMESTAMPTZ NOT NULL,
    staff_count     INTEGER NOT NULL DEFAULT 0 CHECK (staff_count >= 0),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_shift_times CHECK (end_time > start_time)
);

CREATE INDEX idx_shifts_manager ON shifts(manager_id);
CREATE INDEX idx_shifts_department ON shifts(department_id);
CREATE INDEX idx_shifts_date ON shifts(shift_date);

-- TASKS
CREATE TABLE tasks (
    task_id             SERIAL PRIMARY KEY,
    shift_id            INTEGER NOT NULL REFERENCES shifts(shift_id) ON DELETE CASCADE,
    title               VARCHAR(150) NOT NULL,
    description         TEXT,
    aircraft_reg        VARCHAR(20),
    task_type           VARCHAR(50),
    complexity          SMALLINT CHECK (complexity BETWEEN 1 AND 5),
    estimated_hours     NUMERIC(5,2) CHECK (estimated_hours >= 0),
    status              task_status NOT NULL DEFAULT 'Pending',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tasks_shift ON tasks(shift_id);
CREATE INDEX idx_tasks_status ON tasks(status);

-- INCIDENTS
-- shift_type comes from the shift; task_status is a snapshot of the task when the incident was logged.
CREATE TABLE incidents (
    incident_id         SERIAL PRIMARY KEY,
    shift_id            INTEGER NOT NULL REFERENCES shifts(shift_id) ON DELETE CASCADE,
    task_id             INTEGER REFERENCES tasks(task_id) ON DELETE SET NULL,
    reported_by         INTEGER REFERENCES shift_managers(manager_id) ON DELETE SET NULL,
    incident_type       VARCHAR(50) NOT NULL,
    description         TEXT NOT NULL,
    reported_severity   risk_level,
    occurred_at         TIMESTAMPTZ NOT NULL,
    task_status         task_status NOT NULL,
    severity_score      NUMERIC(6,4) NOT NULL CHECK (severity_score BETWEEN 0 AND 1),
    tool_wear_min       INTEGER NOT NULL CHECK (tool_wear_min >= 0),
    air_temp_k          NUMERIC(6,2) NOT NULL CHECK (air_temp_k > 0),
    process_temp_k      NUMERIC(6,2) NOT NULL CHECK (process_temp_k > 0),
    rotational_speed    INTEGER NOT NULL CHECK (rotational_speed > 0),
    resolution_time     INTEGER NOT NULL CHECK (resolution_time >= 0),  -- minutes
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_incidents_shift ON incidents(shift_id);
CREATE INDEX idx_incidents_task ON incidents(task_id);
CREATE INDEX idx_incidents_occurred_at ON incidents(occurred_at);

-- INCIDENT_PREDICTIONS (one row per call to the Flask /predict endpoint)
CREATE TABLE incident_predictions (
    prediction_id       SERIAL PRIMARY KEY,
    incident_id         INTEGER NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
    risk_level          risk_level NOT NULL,
    confidence          NUMERIC(5,4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
    probabilities       JSONB NOT NULL,   -- {"Low": .., "Medium": .., "High": ..}
    top_factors         JSONB,            -- [{feature, value, effect, impact}, ...]
    high_threshold      NUMERIC(4,3),     -- model_meta.json high_threshold at prediction time
    model_version       VARCHAR(50),
    response_ms         INTEGER,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_predictions_incident ON incident_predictions(incident_id);
CREATE INDEX idx_predictions_risk_level ON incident_predictions(risk_level);

-- NOTIFICATIONS
CREATE TABLE notifications (
    notification_id SERIAL PRIMARY KEY,
    manager_id      INTEGER NOT NULL REFERENCES shift_managers(manager_id) ON DELETE CASCADE,
    prediction_id   INTEGER REFERENCES incident_predictions(prediction_id) ON DELETE CASCADE,
    message         TEXT NOT NULL,
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_manager ON notifications(manager_id);
CREATE INDEX idx_notifications_unread ON notifications(manager_id) WHERE is_read = FALSE;
