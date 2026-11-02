# Results

Metric tables for the report. Plots and metric CSVs live on Google Drive in
`incident-risk-predictor-files/reports/`; this file keeps the numbers in git.

## Leakage removed

`incident_type` (is the Failure Type that `risk_level` was built from), `operational_impact`
(came from Target) and `source` (identifies the dataset) were dropped. With them the model
scored ~100%.

## Model: with `department` (first model, since replaced)

Features: categorical `department, shift_type, task_status`; numeric `severity_score,
tool_wear_min, air_temp_k, process_temp_k, rotational_speed, resolution_time`.
Stratified 80/20 split, `random_state=42`. SMOTE inside the pipeline (training folds only).

| Metric | Value |
|---|---|
| 5-fold CV macro F1 | 0.857 ± 0.007 |
| Test accuracy | 0.946 |
| Test macro F1 | 0.871 |
| ROC-AUC (OvR, macro) | 0.984 |
| High: precision / recall / F1 | 0.867 / 0.742 / 0.799 |
| Medium: precision / recall / F1 | 0.780 / 0.872 / 0.823 |
| Low: precision / recall / F1 | 0.988 / 0.991 / 0.989 |

### XGBoost vs Random Forest baseline (`reports/model_comparison.csv`)

| Model | Macro F1 | ROC-AUC |
|---|---|---|
| XGBoost | 0.871 | 0.984 |
| Random Forest | 0.863 | 0.983 |

### High-risk threshold

Predict High when P(High) ≥ t. t chosen on out-of-fold training predictions (best High recall
with macro F1 within 0.01 of default). Chosen **t = 0.35** (`high_threshold` in `model_meta.json`).

| Test set | High recall | High precision | Macro F1 |
|---|---|---|---|
| Default (argmax) | 0.742 | 0.867 | 0.871 |
| Tuned t=0.35 | 0.791 | 0.795 | 0.863 |

Kept t=0.35: missing a High-risk incident is the costly error.

### SHAP: `department` dominates

| Feature | Low | Medium | High |
|---|---|---|---|
| department (mean \|SHAP\|) | 5.7 | 7.6 | 7.2 |
| severity_score (mean \|SHAP\|) | 1.0 | 2.4 | 0.8 |

`department` acts as a proxy for the source dataset: `Line_Maintenance`, `Heavy_Maintenance`
and `Engineering` only appear in the maintenance data, which is 96% Low. A Line_Maintenance
incident with severity 0.95 was predicted Low at 99% confidence.

## Model: without `department` (current `xgb_pipeline.pkl`)

Same pipeline, split and settings; features: categorical `shift_type, task_status`; numeric
`severity_score, tool_wear_min, air_temp_k, process_temp_k, rotational_speed, resolution_time`.

| Metric | Value |
|---|---|
| 5-fold CV macro F1 | 0.849 ± 0.008 |
| Test accuracy | 0.936 |
| Test macro F1 | 0.851 |
| ROC-AUC (OvR, macro) | 0.976 |
| High: precision / recall / F1 | 0.862 / 0.679 / 0.760 |
| Medium: precision / recall / F1 | 0.729 / 0.903 / 0.807 |
| Low: precision / recall / F1 | 0.988 / 0.983 / 0.986 |

### XGBoost vs Random Forest baseline

| Model | Macro F1 | ROC-AUC |
|---|---|---|
| XGBoost | 0.851 | 0.976 |
| Random Forest | 0.857 | 0.977 |

Without department, Random Forest is marginally ahead of XGBoost.

### High-risk threshold

Same selection rule as before, re-tuned for this model. Chosen **t = 0.425**
(out-of-fold: High recall 0.688, precision 0.805, macro F1 0.841).

| Test set | High recall | High precision | Macro F1 |
|---|---|---|---|
| Default (argmax) | 0.679 | 0.862 | 0.851 |
| Tuned t=0.425 | 0.696 | 0.815 | 0.842 |

### SHAP: `severity_score` now leads

| Feature (mean \|SHAP\|) | Low | Medium | High |
|---|---|---|---|
| severity_score | 2.455 | 3.412 | 1.826 |
| tool_wear_min | 0.567 | 0.133 | 0.410 |
| task_status | 0.141 | 0.108 | 0.203 |
| shift_type | 0.149 | 0.128 | 0.193 |
| resolution_time | 0.225 | 0.140 | 0.170 |
| rotational_speed | 0.679 | 0.218 | 0.168 |
| process_temp_k | 0.379 | 0.126 | 0.163 |
| air_temp_k | 0.412 | 0.248 | 0.140 |

Example from the Flask service (`ml/sample.json`: Night shift, Pending, severity 0.95, tool wear
210 min): predicted **High** at 0.922, top reasons severity_score and tool_wear_min (both raise risk).

## With vs without `department`

| Metric | With department | Without department |
|---|---|---|
| 5-fold CV macro F1 | 0.857 | 0.849 |
| Test macro F1 | 0.871 | 0.851 |
| ROC-AUC | 0.984 | 0.976 |
| High recall / precision (default) | 0.742 / 0.867 | 0.679 / 0.862 |
| High recall / precision (tuned) | 0.791 / 0.795 (t=0.35) | 0.696 / 0.815 (t=0.425) |
| Top SHAP feature | department | severity_score |

**Decision: use the model without `department`.** Macro F1 drops by only 0.02, and the
predictions now rest on incident attributes instead of on which dataset a row came from.

Discussion points for the report:
- The larger drop in High recall (0.79 → 0.70 tuned) shows part of the earlier High-risk
  performance came from recognising the source dataset.
- Threshold tuning helps less here (+0.017 High recall vs +0.049 before).
- Random Forest slightly outperforms XGBoost once the proxy feature is removed.

## System testing (end to end)

Run on 2 Nov 2026 on the development laptop (Windows 11, PostgreSQL 18, Flask dev server,
Node/Express, all on localhost), from a fresh start of every service.

### Response times (30 incidents, mixed Low/Medium/High inputs)

| Path | Median (ms) | Mean | p95 | Max |
|---|---|---|---|---|
| Flask `POST /predict` alone (incl. SHAP) | 67.9 | 66.9 | 81.9 | 89.4 |
| Node → Flask (`incident_predictions.response_ms`) | 64 | 65.5 | 81 | 85 |
| `POST /api/incidents` as the client sees it (insert + predict + store + notify) | 82.3 | 85.4 | 119 | 153 |
| `GET /api/dashboard/summary?days=30` (10 calls, warm) | – | 37.5 | – | 226 |

- The first prediction after Flask starts takes about 320 ms (lazy model/SHAP warm-up); after that
  it is steady around 65 ms. The first dashboard call is also slower (≈390 ms) than warm calls.
- Every prediction is well under the 2 s target, so prediction on incident create does not need
  a background job.

### Worked examples (logged through the incident form API, Night shift)

| Input | Prediction | Top 3 SHAP reasons (toward the predicted class) |
|---|---|---|
| Complete, severity 0.12, tool wear 25, resolution 30 | **Low** 0.909 | air_temp_k 298.1 (+0.66), rotational_speed 1550 (+0.47), resolution_time 30 (+0.46) |
| In Progress, severity 0.90, tool wear 50, resolution 60 | **Medium** 0.985 | severity_score 0.90 (+1.03), resolution_time 60 (+0.35), process_temp_k 310.5 (+0.19) |
| Pending, severity 0.95, tool wear 210, resolution 240 | **High** 0.922 | severity_score 0.95 (+1.17), tool_wear_min 210 (+1.13), rotational_speed 1380 (−0.25) |

The High example created a notification for the shift manager: "High risk incident #13
(Hardware) on the Night shift. Top factor: severity_score."

### Failure handling

| Case | Result |
|---|---|
| Flask stopped, incident logged | 201, incident saved, `prediction: null`, `prediction_error: "Risk prediction service unavailable"` (109 ms) |
| Retry `POST /api/incidents/:id/predict` while Flask still starting | 503 with message, nothing stored |
| Retry after Flask is up | 201, Medium 0.985, stored with `response_ms` 56 |

### Automated tests

- Server (Jest + Supertest): 4 suites, 51 tests pass.
- Flask (pytest): 6 tests pass.

### Observations for the report

- **Medium depends on `severity_score`.** A grid over severity 0.3–0.9, tool wear, task status and
  resolution time gave Medium only at severity 0.9 (23 of 90 inputs); a "middle" input (severity
  0.55) was predicted Low at 0.998. `severity_score` is derived from the incident priority that also
  drives `risk_level`, so it is close to a proxy for the label. List under limitations.
- SHAP `effect` is relative to the predicted class: for a Low prediction "raises" means it pushes
  toward Low, not toward higher risk. The UI wording should make this clear.
