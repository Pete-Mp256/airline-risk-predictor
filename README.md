# Incident Risk Prediction for Operational Continuity in Airline Maintenance Operations

A web-based decision-support system that helps airline maintenance shift managers anticipate operational incidents before they happen. The system combines shift and task data (staffing levels, task complexity, workload, aircraft being serviced) with historical incident records. It then uses a machine learning model to predict the incident risk level of each shift and task, so managers can act early by reallocating staff, deferring work or adding supervision.

## Problem

Aircraft maintenance runs under tight turnaround schedules, and incidents such as tooling errors, missed steps, injuries or delays tend to happen when workload, task complexity and staffing are out of balance. Most organisations record incidents only after they occur. Because nobody sees the risk building up, disruptions reach flight schedules and safety. This project aims to move maintenance operations from reacting to incidents towards predicting them.

## Objectives

- Record departments, shift managers, shifts, maintenance tasks and incidents in one system.
- Train a classification model on historical shift, task and incident data that predicts the risk of an incident as **Low**, **Medium** or **High**, with a confidence score.
- Explain each prediction by showing which factors contributed to it, so managers can trust the output and act on it.
- Notify shift managers when a shift or task is predicted to be high risk.
- Store predictions over time to support later analysis and model improvement.

## System Architecture

```
┌──────────────┐     REST/JSON      ┌──────────────┐     HTTP      ┌──────────────────┐
│ React client │ ─────────────────▶ │ Express API  │ ────────────▶ │ Flask ML service │
│  (port 3000) │ ◀───────────────── │ (port 5000)  │ ◀──────────── │   (port 5001)    │
└──────────────┘                    └──────┬───────┘               └──────────────────┘
                                           │ pg
                                    ┌──────▼───────┐
                                    │  PostgreSQL  │
                                    └──────────────┘
```

| Layer | Technology | Responsibility |
|---|---|---|
| Client | React 18 (Create React App) | Dashboard for shift managers: shifts, tasks, incidents, risk predictions and notifications |
| Server | Node.js, Express, `pg`, JWT, bcrypt | REST API, authentication, business logic, persistence, calls to the ML service |
| ML service | Python, Flask, XGBoost, scikit-learn, SHAP, imbalanced-learn | Serves risk predictions from the trained model and explains them |
| Database | PostgreSQL | Stores operational data, incidents, predictions and notifications |

### Machine learning approach

- **Model:** a gradient-boosted tree classifier (XGBoost) that outputs one of three risk levels.
- **Class imbalance:** incidents are rare compared with normal shifts, so the training data is rebalanced with resampling techniques from `imbalanced-learn`, such as SMOTE.
- **Explainability:** SHAP values show which features, such as staff count, task complexity or estimated hours, pushed a prediction towards higher risk. They are stored in `incident_predictions.contributing_factors`.
- **Persistence:** trained models are serialised with `joblib` into `ml/model/`. The `.pkl` files are git-ignored.

## Data Model

The schema lives in [database/schema.sql](database/schema.sql).

| Table | Purpose |
|---|---|
| `departments` | Maintenance departments or units |
| `shift_managers` | System users; each belongs to a department |
| `shifts` | A manager's shift: date, start and end time, staff count |
| `tasks` | Maintenance tasks within a shift: aircraft registration, type, complexity (1–5), estimated hours, status |
| `incidents` | Incidents that actually occurred, linked to a shift and optionally a task, with severity |
| `incident_predictions` | Model output per shift or task: risk level, confidence, contributing factors, model version |
| `notifications` | Alerts to managers, usually raised from high-risk predictions |

Risk levels and incident severity share the `risk_level` enum: `Low`, `Medium`, `High`.

## Project Structure

```
.
├── client/          React front end
│   ├── public/
│   └── src/
├── server/          Express REST API
│   ├── config/      Database connection pool
│   ├── controllers/ Route handlers
│   ├── middleware/  JWT authentication
│   ├── routes/      API route definitions
│   └── server.js
├── ml/              Flask prediction service
│   ├── model/       Trained model artifacts (git-ignored)
│   ├── app.py
│   └── requirements.txt
└── database/
    └── schema.sql   PostgreSQL schema
```

## Getting Started

### Prerequisites

- Node.js 18 or later and npm
- Python 3.10 or later
- PostgreSQL 14 or later

### 1. Database

```bash
createdb incident_risk_predictor
psql -d incident_risk_predictor -f database/schema.sql
```

### 2. API server

```bash
cd server
cp .env.example .env   # then set DB credentials and JWT_SECRET
npm install
npm run dev            # http://localhost:5000, health check at /api/health
```

### 3. ML service

```bash
cd ml
python -m venv venv
venv\Scripts\activate          # Windows; use `source venv/bin/activate` on macOS/Linux
pip install -r requirements.txt
python app.py                  # http://localhost:5001
```

### 4. Client

```bash
cd client
npm install
npm start                      # http://localhost:3000, proxies API calls to :5000
```

## API Overview

| Service | Method | Endpoint | Description |
|---|---|---|---|
| Express | `GET` | `/api/health` | Service health check |
| Flask | `POST` | `/predict` | Returns `{ "risk_level": ..., "confidence": ... }` for a shift or task feature payload |

Protected Express routes expect an `Authorization: Bearer <token>` header. The token is verified by [server/middleware/auth.js](server/middleware/auth.js).

## Project Status

The project is at the scaffold stage. The full-stack structure, database schema, database connection and authentication middleware are in place. The `/predict` endpoint currently returns a placeholder response.

Next steps:

- [ ] API routes and controllers for authentication, shifts, tasks, incidents, predictions and notifications
- [ ] Data preparation and model training pipeline
- [ ] Real model inference and SHAP explanations in the ML service
- [ ] Manager dashboard in the React client
- [ ] High-risk notifications

## Author

Pete Njagi, Strathmore University. IS Project II.
