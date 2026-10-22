# Results

Metric tables for the report. Plots and metric CSVs live on Google Drive in
`incident-risk-predictor-files/reports/`; this file keeps the numbers in git.

## Leakage removed

`incident_type` (is the Failure Type that `risk_level` was built from), `operational_impact`
(came from Target) and `source` (identifies the dataset) were dropped. With them the model
scored ~100%.

## Model: with `department` (current `xgb_pipeline.pkl`)

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

## Model: without `department`

_To do (task 2): retrain, re-tune the threshold, and fill in the comparison._

| Metric | With department | Without department |
|---|---|---|
| 5-fold CV macro F1 | 0.857 | |
| Test macro F1 | 0.871 | |
| ROC-AUC | 0.984 | |
| High recall / precision (default) | 0.742 / 0.867 | |
| High recall / precision (tuned) | 0.791 / 0.795 (t=0.35) | |
