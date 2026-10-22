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
