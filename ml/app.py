"""Flask service that serves the trained XGBoost risk model.

Expects ml/model/xgb_pipeline.pkl and ml/model/model_meta.json (download both from
Drive: incident-risk-predictor/model_checkpoints/). Node.js calls POST /predict.
"""
import json
import os

import joblib
import numpy as np
import pandas as pd
import shap
from flask import Flask, jsonify, request
from scipy import sparse

MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'model')

pipeline = joblib.load(os.path.join(MODEL_DIR, 'xgb_pipeline.pkl'))
with open(os.path.join(MODEL_DIR, 'model_meta.json')) as f:
    meta = json.load(f)

FEATURES = meta['features']
CATEGORICAL = meta['categorical']
NUMERIC = meta['numeric']
LABELS = meta['labels']
HIGH = LABELS.index('High')
HIGH_T = meta.get('high_threshold')  # set by notebook 03; None = plain argmax

prep = pipeline.named_steps['prep']
explainer = shap.TreeExplainer(pipeline.named_steps['model'])
feat_names = [n.split('__', 1)[1] for n in prep.get_feature_names_out()]


def original_feature(name):
    """Map a one-hot column like 'shift_type_Night' back to 'shift_type'."""
    for f in FEATURES:
        if name == f or name.startswith(f + '_'):
            return f
    return name


def validate(payload):
    """Return (clean_row, errors)."""
    if not isinstance(payload, dict):
        return None, ['Body must be a JSON object']
    errors, row = [], {}
    for f in FEATURES:
        if f not in payload or payload[f] in (None, ''):
            errors.append(f'Missing field: {f}')
        elif f in NUMERIC:
            try:
                row[f] = float(payload[f])
            except (TypeError, ValueError):
                errors.append(f'{f} must be a number')
        else:
            row[f] = str(payload[f])
    return row, errors


def predict_with_reasons(row, top_n=3):
    X = pd.DataFrame([row])[FEATURES]
    proba = pipeline.predict_proba(X)[0]
    k = int(proba.argmax())
    if HIGH_T is not None and proba[HIGH] >= HIGH_T:
        k = HIGH

    xt = prep.transform(X)
    xt = xt.toarray() if sparse.issparse(xt) else xt
    sv = np.asarray(explainer.shap_values(xt))
    if sv.shape[0] == len(LABELS) and sv.shape[1] == 1:  # older SHAP: (classes, rows, features)
        sv = sv.transpose(1, 2, 0)
    contrib = pd.Series(sv[0, :, k], index=feat_names).groupby(original_feature).sum()
    contrib = contrib.reindex(contrib.abs().sort_values(ascending=False).index)[:top_n]

    return {
        'risk_level': LABELS[k],
        'confidence': round(float(proba[k]), 3),
        'probabilities': {l: round(float(p), 3) for l, p in zip(LABELS, proba)},
        'top_factors': [
            {'feature': f, 'value': row[f],
             'effect': 'raises' if v > 0 else 'lowers', 'impact': round(float(v), 3)}
            for f, v in contrib.items()
        ],
    }


app = Flask(__name__)


@app.get('/health')
def health():
    return jsonify(status='ok', features=FEATURES, labels=LABELS, high_threshold=HIGH_T)


@app.post('/predict')
def predict():
    row, errors = validate(request.get_json(silent=True))
    if errors:
        return jsonify(error='Invalid input', details=errors), 400
    return jsonify(predict_with_reasons(row))


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5001)))
