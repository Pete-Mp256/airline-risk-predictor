"""API tests for the Flask service. Run from ml/: python -m pytest

Needs the model files in ml/model/ (gitignored, copied from Drive).
"""
import json
import os

import pytest

HERE = os.path.dirname(os.path.abspath(__file__))
if not os.path.exists(os.path.join(HERE, 'model', 'xgb_pipeline.pkl')):
    pytest.skip('model files not in ml/model/', allow_module_level=True)

import app  # noqa: E402  (loads the model on import)

with open(os.path.join(HERE, 'sample.json')) as f:
    SAMPLE = json.load(f)


@pytest.fixture
def client():
    return app.app.test_client()


def test_health(client):
    body = client.get('/health').get_json()
    assert body['status'] == 'ok'
    assert body['features'] == app.FEATURES
    assert body['labels'] == ['Low', 'Medium', 'High']


def test_sample_matches_model_features():
    assert set(SAMPLE) == set(app.FEATURES)


def test_predict_valid(client):
    res = client.post('/predict', json=SAMPLE)
    assert res.status_code == 200
    body = res.get_json()
    assert body['risk_level'] in app.LABELS
    assert set(body['probabilities']) == set(app.LABELS)
    assert sum(body['probabilities'].values()) == pytest.approx(1, abs=0.01)
    assert body['confidence'] == body['probabilities'][body['risk_level']]
    assert body['high_threshold'] == app.HIGH_T
    assert len(body['top_factors']) == 3
    for factor in body['top_factors']:
        assert factor['feature'] in app.FEATURES
        assert factor['effect'] in ('raises', 'lowers')


def test_predict_missing_field(client):
    payload = {k: v for k, v in SAMPLE.items() if k != 'severity_score'}
    res = client.post('/predict', json=payload)
    assert res.status_code == 400
    assert 'Missing field: severity_score' in res.get_json()['details']


def test_predict_non_numeric_field(client):
    res = client.post('/predict', json={**SAMPLE, 'tool_wear_min': 'abc'})
    assert res.status_code == 400
    assert 'tool_wear_min must be a number' in res.get_json()['details']


def test_predict_body_not_object(client):
    res = client.post('/predict', json=[1, 2, 3])
    assert res.status_code == 400
