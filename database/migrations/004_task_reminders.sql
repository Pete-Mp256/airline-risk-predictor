-- Unfinished-task reminders: track sent reminders and link notifications to a shift.
-- psql -d incident_risk_predictor -f database/migrations/004_task_reminders.sql
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS shift_id INTEGER REFERENCES shifts(shift_id) ON DELETE CASCADE;
