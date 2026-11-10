# Incident Risk Prediction for Operational Continuity in Airline Maintenance Operations

A web-based shift handover system for airline maintenance with incident risk prediction built in. Staff hand each shift over to the incoming team, and every incident logged on a shift gets a **Low / Medium / High** risk rating, with the top reasons for it. The rating comes from a machine learning model, and the handover rule layer can then raise it based on how the shift was handed over.

## Problem

Aircraft maintenance runs on tight turnaround schedules. Incidents such as tooling errors, missed steps, injuries or delays tend to happen when workload, task complexity and staffing are out of balance, and when information is lost between shifts. Most organisations record incidents only after they occur, and handover notes are rarely linked to what happens next. This project ties the handover to the risk of each incident, so the incoming team sees which items need attention first.

## The two modules

### Module 1: Shift Handover (all staff)

Any member of staff can use it. The UI says "Staff". The database still calls users `shift_managers`.

- **Start** a handover from the shift page. Open tasks and the shift's incidents are added automatically, and open tasks are marked as carried over to the next shift.
- **Edit** the summary, pick the incoming person (or leave it open to the whole department), and add or remove notes.
- **Submit.** The handover becomes read-only, and the incoming person gets a notification. Submitting replaces the end-of-shift summary email for that shift; the old email job only runs as a fallback.
- **Handovers page:** Incoming and Sent tabs, with a waiting count in the navigation. On the detail page the incoming person ticks each item and then acknowledges the whole handover.

### Module 2: Risk prediction linked to handovers

1. **Model rating (`risk_level`).** When an incident is logged, the Express API sends 8 features to the Flask service. The service returns a rating, a confidence, class probabilities and the top SHAP factors.
2. **Handover rule layer (`final_risk_level`).** [server/services/handoverRules.js](server/services/handoverRules.js) checks the handover the incoming team received (the most recent earlier shift in the same department) and the current shift's workload. If 2 or more flags fire, the handover is **Weak**, and a Weak handover raises a Medium rating to **High**. Low and High are never changed, and the rule layer never lowers a rating.
3. **Inside the handover.** Incident items are listed High first, each with its model and final rating, top factors and flags. The handover shows an overall risk (the highest final rating among its incidents). The incoming person must tick every High item before acknowledging (otherwise the API returns `409`). A handover with unticked High items is escalated by email after `ESCALATION_MINUTES`.

Alerts, the High risk email, dashboard counts and the risk badges all use `final_risk_level`. Both ratings are stored, so the effect of the rule layer can be measured (see [Checking the rule layer](#checking-the-rule-layer)).

> **Data note.** The model is trained on **public data**: Kaggle predictive-maintenance records merged with a public incident event log ([notebooks/01_merge_datasets.ipynb](notebooks/01_merge_datasets.ipynb)). That data has **no handover fields**, so the model knows nothing about handovers. `shift_type` and `task_status` are synthetic columns added during the merge. Handover quality affects only the **final** rating, through the rule layer in Node, and never the model's own prediction.

### Handover flags

All thresholds are in `RULES` at the top of [server/services/handoverRules.js](server/services/handoverRules.js). "Previous handover" means the submitted handover from the most recent earlier shift in the same department. A Draft counts as no handover. Flags 1–5 only fire when such an earlier shift exists.

| # | Flag (`code`) | Fires when | Threshold |
|---|---|---|---|
| 1 | `carried_over_task` | The incident is on a task the previous handover carried over to this shift | – |
| 2 | `many_open_tasks` | The previous handover had this many open tasks or more (without a submitted handover: the previous shift's unfinished tasks) | `OPEN_TASKS` = 3 |
| 3 | `weak_summary` | The previous handover summary is missing or shorter than this, or there is no submitted handover | `MIN_SUMMARY_CHARS` = 20 |
| 4 | `late_acknowledgement` | The previous handover was not acknowledged, or was acknowledged this long or more after this shift's start | `LATE_ACK_MINUTES` = 30 |
| 5 | `previous_high_incident` | The previous handover (or the previous shift, if it had none) had an incident with a final rating of High | – |
| 6 | `edge_of_shift` | The incident occurred within this many minutes of the shift's start or end | `EDGE_OF_SHIFT_MINUTES` = 60 |
| 7 | `high_workload` | Open tasks on this shift (including carried-over ones) per staff member is above this; skipped when `staff_count` is 0 | `OPEN_TASKS_PER_STAFF` = 2 |
| | **Weak handover** | This many flags or more | `MIN_FLAGS_FOR_WEAK` = 2 |
| | **Final rating** | Weak and model Medium → High. Otherwise final = model | – |

The flags that fired are stored on the prediction as `handover_flags` (`[{code, label}]`), with `handover_level` (`OK` / `Weak`). The UI shows them as "Model: Medium → Final: High (weak handover)" followed by the flags.

## System Architecture

```
┌──────────────┐     REST/JSON      ┌──────────────┐     HTTP      ┌──────────────────┐
│ React client │ ─────────────────▶ │ Express API  │ ────────────▶ │ Flask ML service │
│  (port 3000) │ ◀───────────────── │ (port 5000)  │ ◀──────────── │   (port 5001)    │
└──────────────┘                    └──────┬───────┘               └──────────────────┘
                                           │ pg           model rating + SHAP factors
                                    ┌──────▼───────┐
                                    │  PostgreSQL  │      handover rule layer runs in Express
                                    └──────────────┘
```

| Layer | Technology | Responsibility |
|---|---|---|
| Client | React 18 (Create React App), shadcn/ui, Tailwind, Recharts | Shifts, handovers, incidents with risk badges and reasons, dashboard, notifications |
| Server | Node.js, Express, `pg`, JWT, bcrypt, node-cron, Nodemailer | REST API, auth (email 2FA, Google sign-in), handovers, handover rule layer, alerts and email jobs |
| ML service | Python, Flask, XGBoost, scikit-learn, SHAP, imbalanced-learn | Serves the model rating and its top SHAP factors |
| Database | PostgreSQL | Operational data, handovers, incidents, predictions and notifications |

### Machine learning approach

- **Model:** XGBoost in an imbalanced-learn pipeline (OneHotEncoder + StandardScaler → SMOTE → XGBClassifier), trained in Colab ([notebooks/02_train_xgboost.ipynb](notebooks/02_train_xgboost.ipynb)). A Random Forest is trained as a baseline.
- **Features (8):** `shift_type`, `task_status`, `severity_score`, `tool_wear_min`, `air_temp_k`, `process_temp_k`, `rotational_speed`, `resolution_time`. Leakage columns and `department` are dropped.
- **High threshold:** High is predicted when P(High) ≥ 0.425, tuned on out-of-fold predictions ([notebooks/03_shap_and_threshold.ipynb](notebooks/03_shap_and_threshold.ipynb)).
- **Explainability:** SHAP values give the top factors, stored in `incident_predictions.top_factors`. The UI shows the top 3.
- **Artifacts:** `xgb_pipeline.pkl`, `xgb_model.ubj` and `model_meta.json` live on Google Drive and are copied into `ml/model/` (git-ignored). `model_meta.json` is the contract between the notebooks, Flask and Node.

Metrics are in [docs/results.md](docs/results.md) (test macro F1 0.851, ROC-AUC 0.976).

## Data Model

The full schema is in [database/schema.sql](database/schema.sql).

| Table | Purpose |
|---|---|
| `departments` | Maintenance departments or units |
| `shift_managers` | Staff accounts (password and/or Google sign-in), each in a department |
| `login_codes` | Email 2FA codes |
| `shifts` | A shift: date, type, start and end time, staff count |
| `tasks` | Maintenance tasks on a shift: aircraft registration, type, complexity, estimated hours, status |
| `incidents` | Incidents logged on a shift, optionally linked to a task |
| `incident_predictions` | Model rating (`risk_level`), `confidence`, `probabilities`, `top_factors`, `high_threshold`, `model_version`, `response_ms`, and from the rule layer `handover_flags`, `handover_level`, `final_risk_level` |
| `notifications` | In-app alerts (High risk incidents, handovers received) |
| `handovers` | One per shift: from/to person, summary, status (`Draft`, `Submitted`, `Acknowledged`), submitted/acknowledged times, `escalated_at` |
| `handover_items` | Items on a handover: `Open task` (with `carried_over`), `Incident` or `Note`, each with its own acknowledgement |

## Project Structure

```
.
├── client/              React front end
│   └── src/
│       ├── components/  Shared UI (risk badges, prediction result, handover items and checks)
│       └── pages/       Shifts, Handovers, Incident, Dashboard, Login/Register, Landing
├── server/              Express REST API
│   ├── config/          Database connection pool
│   ├── controllers/     Route handlers
│   ├── jobs/            Scheduled email jobs (node-cron, once a minute)
│   ├── middleware/      JWT authentication
│   ├── routes/          API route definitions
│   ├── services/        ML client, alerts and email, handover rule layer
│   └── tests/           Jest + Supertest
├── ml/                  Flask prediction service (app.py, test_app.py, model/ git-ignored)
├── notebooks/           01 merge, 02 train, 03 SHAP and threshold (run in Colab)
├── database/
│   ├── schema.sql       Full schema for a new database
│   └── migrations/      Changes for an existing database, 001–008
└── docs/results.md      Model and system results for the report
```

## Getting Started

### Prerequisites

- Node.js 18 or later and npm
- Python 3.10 or later
- PostgreSQL 14 or later

### 1. Database

A new database only needs the schema, which already includes every migration:

```bash
createdb incident_risk_predictor
psql -d incident_risk_predictor -f database/schema.sql
```

An existing database needs the migrations it is missing, **in this order, each run once**. 006 and 007 create types and columns without `IF NOT EXISTS`, so running them twice fails.

| # | File | Adds |
|---|---|---|
| 001 | `001_login_codes.sql` | `login_codes` table for email 2FA |
| 002 | `002_google_signin.sql` | `shift_managers.google_id`; password becomes optional |
| 003 | `003_handover_summary.sql` | `shifts.handover_sent_at` (end-of-shift email) |
| 004 | `004_task_reminders.sql` | `tasks.reminder_sent_at`, `notifications.shift_id` |
| 005 | `005_alert_escalation.sql` | `notifications.escalated_at` |
| 006 | `006_handovers.sql` | **Module 1:** `handovers` and `handover_items` tables and their enums |
| 007 | `007_handover_risk_rules.sql` | **Module 2:** `handover_flags`, `handover_level`, `final_risk_level` on `incident_predictions` (existing rows get final = model rating) |
| 008 | `008_handover_escalation.sql` | **Module 2:** `handovers.escalated_at` |

```bash
psql -d incident_risk_predictor -v ON_ERROR_STOP=1 -1 -f database/migrations/006_handovers.sql
psql -d incident_risk_predictor -v ON_ERROR_STOP=1 -1 -f database/migrations/007_handover_risk_rules.sql
psql -d incident_risk_predictor -v ON_ERROR_STOP=1 -1 -f database/migrations/008_handover_escalation.sql
```

If every API route returns 500 after pulling, a migration is usually missing.

### 2. API server

```bash
cd server
cp .env.example .env   # set DB credentials, JWT_SECRET, ML_SERVICE_URL, GOOGLE_CLIENT_ID, SMTP_* and ESCALATION_*
npm install
npm run dev            # http://localhost:5000, health check at /api/health
npm test               # Jest + Supertest
```

### 3. ML service

Copy `xgb_pipeline.pkl`, `xgb_model.ubj` and `model_meta.json` from the Drive folder `model_checkpoints/` into `ml/model/` first.

```bash
cd ml
python -m venv .venv
.venv\Scripts\activate         # Windows; use `source .venv/bin/activate` on macOS/Linux
pip install -r requirements.txt
python app.py                  # http://localhost:5001
python -m pytest
```

### 4. Client

```bash
cd client
cp .env.example .env           # optional: set REACT_APP_GOOGLE_CLIENT_ID to show Sign in with Google
npm install
npm start                      # http://localhost:3000, proxies API calls to :5000
```

## API Overview

All `/api` routes except `/api/health` and the auth routes need an `Authorization: Bearer <token>` header ([server/middleware/auth.js](server/middleware/auth.js)).

### Handovers (Module 1 and 2)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/shifts/:id/handover` | Start the shift's handover (Draft) with its open tasks and incidents; `409` if one exists |
| `GET` | `/api/handovers?box=incoming\|sent` | Inbox. Each row has `overall_risk` and the count of unticked High items |
| `GET` | `/api/handovers/:id` | Handover with its items; incident items High first, with model and final rating, top factors and flags |
| `PATCH` | `/api/handovers/:id` | Edit a Draft: `summary`, `to_manager_id` (`null` = whole department) |
| `POST` | `/api/handovers/:id/notes` | Add a note `{ note }` |
| `DELETE` | `/api/handovers/:id/items/:itemId` | Remove a note |
| `POST` | `/api/handovers/:id/submit` | Submit; becomes read-only and notifies the incoming person |
| `POST` | `/api/handovers/:id/items/:itemId/acknowledge` | Tick one item |
| `POST` | `/api/handovers/:id/acknowledge` | Acknowledge the handover; `409` while any High item is unticked |
| `GET` | `/api/managers` | Active staff, for picking the incoming person |

### Everything else

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/auth/register`, `/api/auth/login`, `/api/auth/verify-2fa`, `/api/auth/resend-code`, `/api/auth/google` | Register and sign in (see below) |
| `GET` | `/api/auth/me` | Current user |
| `GET` | `/api/departments` | Departments |
| `GET`, `POST` | `/api/shifts` | List or create shifts |
| `GET`, `PATCH` | `/api/shifts/:id` | Shift detail (with its handover) or update |
| `POST` | `/api/shifts/:id/tasks` | Add a task |
| `PATCH` | `/api/tasks/:id` | Update a task |
| `GET`, `POST` | `/api/incidents` | List incidents, or log one: predicts, runs the rule layer and stores both ratings |
| `GET` | `/api/incidents/:id` | Incident with its prediction |
| `POST` | `/api/incidents/:id/predict` | Retry the prediction (e.g. after Flask was down) |
| `GET` | `/api/notifications` | Notifications |
| `PATCH` | `/api/notifications/:id/read` | Mark read |
| `GET` | `/api/dashboard/summary?days=30`, `/api/dashboard/incidents`, `/api/dashboard/open-tasks` | Dashboard data (by final rating) |
| Flask `POST` | `/predict` | The 8 features (see `ml/sample.json`) → `risk_level`, `confidence`, `probabilities`, `top_factors` |

Logging in is two steps. `POST /api/auth/login` checks the password, emails a 6-digit code and returns a 10-minute `pending_token`. `POST /api/auth/verify-2fa` with that token and the code returns the session token. `POST /api/auth/resend-code` sends a new code, at most once a minute. A code expires after 10 minutes or 5 wrong attempts. If `SMTP_USER` is not set, the code is printed in the server console.

`POST /api/auth/google` takes the Google ID token (`credential`) from the Sign in with Google button. It verifies the token against `GOOGLE_CLIENT_ID` and returns a session token directly, with no email code. On first use it links an existing account with the same verified email, or creates a new account with no password.

### Background jobs

[server/jobs/scheduler.js](server/jobs/scheduler.js) runs these once a minute when `JOBS_ENABLED=true`:

| Job | What it does |
|---|---|
| `handoverSummary` | End-of-shift summary email, only for shifts with no submitted handover (fallback) |
| `taskReminders` | Reminds the shift's owner about unfinished tasks `REMINDER_LEAD_MINUTES` before the shift ends |
| `alertEscalation` | Emails `ESCALATION_EMAIL` about High risk alerts still unread after `ESCALATION_MINUTES` |
| `handoverEscalation` | Emails `ESCALATION_EMAIL` once per handover that still has unticked High items `ESCALATION_MINUTES` after submission |

## Checking the rule layer

How many predictions the handover rule layer changed, by model and final rating:

```sql
SELECT risk_level       AS model_rating,
       final_risk_level AS final_rating,
       COUNT(*)         AS predictions
  FROM incident_predictions
 WHERE final_risk_level <> risk_level
 GROUP BY risk_level, final_risk_level
 ORDER BY 1, 2;

-- Share of all predictions that were changed
SELECT COUNT(*) FILTER (WHERE final_risk_level <> risk_level) AS changed,
       COUNT(*)                                               AS total,
       ROUND(100.0 * COUNT(*) FILTER (WHERE final_risk_level <> risk_level)
             / NULLIF(COUNT(*), 0), 1)                        AS pct_changed
  FROM incident_predictions;
```

Since the rule layer only raises Medium to High, the first query returns at most one row (`Medium → High`).

## Project Status

Both modules are complete and merged: handover records and screens, the rule layer, risk inside the handover and the escalation emails. Also done: the trained model behind Flask, auth with email 2FA and Google sign-in, High risk alerts, the dashboard and the end-to-end tests. Server tests: 7 suites, 126 tests pass. Flask: 6 tests pass. Results are in [docs/results.md](docs/results.md).

## Author

Pete Njagi, Strathmore University. IS Project II.
