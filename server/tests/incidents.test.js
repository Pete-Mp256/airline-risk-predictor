// Incident and notification route tests. The database and the Flask model are mocked.
process.env.JWT_SECRET = 'test-secret';

jest.mock('../config/db', () => ({ query: jest.fn() }));
jest.mock('../services/mailer', () => ({ sendMail: jest.fn().mockResolvedValue() }));
jest.mock('../services/mlClient', () => {
  const actual = jest.requireActual('../services/mlClient');
  return { ...actual, predict: jest.fn() };
});
// The rule queries are covered in handoverRules.test.js; here the rules give OK by default.
jest.mock('../services/handoverRules', () => {
  const actual = jest.requireActual('../services/handoverRules');
  return { ...actual, checkHandover: jest.fn() };
});

const request = require('supertest');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const mlClient = require('../services/mlClient');
const { sendMail } = require('../services/mailer');
const handoverRules = require('../services/handoverRules');
const app = require('../app');

// Lets the un-awaited High risk email finish before asserting on it.
const flush = () => new Promise((resolve) => setImmediate(resolve));

const owner = jwt.sign({ manager_id: 1, department_id: 1 }, 'test-secret');
const other = jwt.sign({ manager_id: 2, department_id: 2 }, 'test-secret');

const shift = { shift_id: 2, manager_id: 1, department_id: 1, shift_type: 'Night' };
const body = {
  shift_id: 2,
  task_id: 3,
  incident_type: 'Power failure',
  description: 'Ground power unit tripped during borescope',
  occurred_at: '2026-10-21T02:30:00+03:00',
  severity_score: 0.95,
  tool_wear_min: 210,
  air_temp_k: 302.1,
  process_temp_k: 311.4,
  rotational_speed: 1380,
  resolution_time: 240,
};
const incidentRow = { incident_id: 10, ...body, task_status: 'Pending' };

function mlResult(risk_level) {
  return {
    result: {
      risk_level,
      confidence: 0.92,
      probabilities: { Low: 0.02, Medium: 0.06, High: 0.92 },
      high_threshold: 0.425,
      top_factors: [{ feature: 'severity_score', value: 0.95, effect: 'raises', impact: 1.2 }],
    },
    responseMs: 80,
  };
}

// Mocks the queries run before the ML call: shift, task, incident insert.
function mockCreateQueries() {
  pool.query
    .mockResolvedValueOnce({ rows: [shift] })
    .mockResolvedValueOnce({ rows: [{ status: 'Pending' }] })
    .mockResolvedValueOnce({ rows: [incidentRow] });
}

beforeEach(() => {
  pool.query.mockReset();
  mlClient.predict.mockReset();
  sendMail.mockReset().mockResolvedValue();
  handoverRules.checkHandover.mockReset().mockImplementation(async (_incident, level) => (
    { handover_flags: [], handover_level: 'OK', final_risk_level: level }
  ));
});

const weakFlags = [
  { code: 'weak_summary', label: 'Previous handover summary missing or under 20 characters' },
  { code: 'edge_of_shift', label: 'Incident within 60 min of shift start or end' },
];

describe('POST /api/incidents', () => {
  test('saves the incident and a Low prediction without notifying', async () => {
    mockCreateQueries();
    mlClient.predict.mockResolvedValueOnce(mlResult('Low'));
    pool.query.mockResolvedValueOnce({ rows: [{ prediction_id: 4, risk_level: 'Low', final_risk_level: 'Low' }] });

    const res = await request(app).post('/api/incidents').set('Authorization', `Bearer ${owner}`).send(body);

    expect(res.status).toBe(201);
    expect(res.body.prediction.risk_level).toBe('Low');
    expect(mlClient.predict).toHaveBeenCalledWith({
      shift_type: 'Night',
      task_status: 'Pending',
      severity_score: 0.95,
      tool_wear_min: 210,
      air_temp_k: 302.1,
      process_temp_k: 311.4,
      rotational_speed: 1380,
      resolution_time: 240,
    });
    const predictionParams = pool.query.mock.calls[3][1];
    expect(predictionParams[5]).toBe(0.425); // high_threshold
    expect(predictionParams[7]).toBe(80); // response_ms
    expect(predictionParams.slice(8)).toEqual(['[]', 'OK', 'Low']); // handover_flags, handover_level, final_risk_level
    expect(pool.query).toHaveBeenCalledTimes(4);
  });

  test('notifies the department managers on a High prediction', async () => {
    mockCreateQueries();
    mlClient.predict.mockResolvedValueOnce(mlResult('High'));
    pool.query
      .mockResolvedValueOnce({ rows: [{ prediction_id: 5, risk_level: 'High', final_risk_level: 'High' }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).post('/api/incidents').set('Authorization', `Bearer ${owner}`).send(body);

    expect(res.status).toBe(201);
    const [sql, params] = pool.query.mock.calls[4];
    expect(sql).toMatch(/INSERT INTO notifications/);
    expect(params[0]).toBe(5);
    expect(params[1]).toMatch(/High risk incident #10/);
    expect(params.slice(2)).toEqual([1, 1]);
  });

  test('emails each notified manager the rating, reasons and a link on a High prediction', async () => {
    mockCreateQueries();
    mlClient.predict.mockResolvedValueOnce(mlResult('High'));
    const prediction = { prediction_id: 5, risk_level: 'High', final_risk_level: 'High', confidence: 0.92, top_factors: mlResult('High').result.top_factors };
    pool.query
      .mockResolvedValueOnce({ rows: [prediction] })
      .mockResolvedValueOnce({ rows: [
        { email: 'amina@example.com', first_name: 'Amina' },
        { email: 'brian@example.com', first_name: 'Brian' },
      ] });

    const res = await request(app).post('/api/incidents').set('Authorization', `Bearer ${owner}`).send(body);
    await flush();

    expect(res.status).toBe(201);
    expect(sendMail).toHaveBeenCalledTimes(2);
    const mail = sendMail.mock.calls[0][0];
    expect(mail.to).toBe('amina@example.com');
    expect(mail.subject).toBe('High risk: Power failure on the Night shift');
    expect(mail.text).toMatch(/High risk \(92%\)/);
    expect(mail.text).toMatch(/Severity score \(0\.95\) raised the score/);
    expect(mail.text).toMatch(/\/incidents\/10/);
  });

  test('still returns 201 when the High risk email fails', async () => {
    mockCreateQueries();
    mlClient.predict.mockResolvedValueOnce(mlResult('High'));
    pool.query
      .mockResolvedValueOnce({ rows: [{ prediction_id: 5, risk_level: 'High', final_risk_level: 'High', confidence: 0.92, top_factors: [] }] })
      .mockResolvedValueOnce({ rows: [{ email: 'amina@example.com', first_name: 'Amina' }] });
    sendMail.mockRejectedValueOnce(new Error('SMTP down'));
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(app).post('/api/incidents').set('Authorization', `Bearer ${owner}`).send(body);
    await flush();

    expect(res.status).toBe(201);
    expect(res.body.prediction.risk_level).toBe('High');
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  test('does not email on a Low prediction', async () => {
    mockCreateQueries();
    mlClient.predict.mockResolvedValueOnce(mlResult('Low'));
    pool.query.mockResolvedValueOnce({ rows: [{ prediction_id: 6, risk_level: 'Low', final_risk_level: 'Low' }] });

    const res = await request(app).post('/api/incidents').set('Authorization', `Bearer ${owner}`).send(body);
    await flush();

    expect(res.status).toBe(201);
    expect(sendMail).not.toHaveBeenCalled();
  });

  test('a Weak handover raises Medium to High, stores both ratings and alerts with the flags', async () => {
    mockCreateQueries();
    mlClient.predict.mockResolvedValueOnce(mlResult('Medium'));
    handoverRules.checkHandover.mockResolvedValueOnce(
      { handover_flags: weakFlags, handover_level: 'Weak', final_risk_level: 'High' }
    );
    const prediction = {
      prediction_id: 7, risk_level: 'Medium', final_risk_level: 'High', handover_level: 'Weak',
      handover_flags: weakFlags, confidence: 0.6, top_factors: [],
    };
    pool.query
      .mockResolvedValueOnce({ rows: [prediction] })
      .mockResolvedValueOnce({ rows: [{ email: 'amina@example.com', first_name: 'Amina' }] });

    const res = await request(app).post('/api/incidents').set('Authorization', `Bearer ${owner}`).send(body);
    await flush();

    expect(res.status).toBe(201);
    expect(handoverRules.checkHandover).toHaveBeenCalledWith(incidentRow, 'Medium');
    const params = pool.query.mock.calls[3][1];
    expect(params[1]).toBe('Medium'); // model rating kept
    expect(params.slice(8)).toEqual([JSON.stringify(weakFlags), 'Weak', 'High']);
    expect(pool.query.mock.calls[4][1][1]).toMatch(/Raised from Medium by the handover checks/);
    const mail = sendMail.mock.calls[0][0];
    expect(mail.text).toMatch(/The model rated it Medium; the handover checks raised it to High/);
    expect(mail.text).toMatch(/Handover checks:\n- Previous handover summary missing/);
  });

  test('does not alert when a Weak handover leaves a Low rating unchanged', async () => {
    mockCreateQueries();
    mlClient.predict.mockResolvedValueOnce(mlResult('Low'));
    handoverRules.checkHandover.mockResolvedValueOnce(
      { handover_flags: weakFlags, handover_level: 'Weak', final_risk_level: 'Low' }
    );
    pool.query.mockResolvedValueOnce({ rows: [{ prediction_id: 8, risk_level: 'Low', final_risk_level: 'Low' }] });

    const res = await request(app).post('/api/incidents').set('Authorization', `Bearer ${owner}`).send(body);
    await flush();

    expect(res.status).toBe(201);
    expect(pool.query).toHaveBeenCalledTimes(4);
    expect(sendMail).not.toHaveBeenCalled();
  });

  test('adds the incident to the shift handover while it is a Draft', async () => {
    mockCreateQueries();
    mlClient.predict.mockResolvedValueOnce(mlResult('Low'));
    pool.query.mockResolvedValueOnce({ rows: [{ prediction_id: 4, risk_level: 'Low', final_risk_level: 'Low' }] });

    await request(app).post('/api/incidents').set('Authorization', `Bearer ${owner}`).send(body);

    const sql = pool.query.mock.calls[2][0];
    expect(sql).toMatch(/INSERT INTO incidents/);
    expect(sql).toMatch(/INSERT INTO handover_items[\s\S]*h\.status = 'Draft'/);
  });

  test('accepts a task carried over to the shift by the previous handover', async () => {
    mockCreateQueries();
    mlClient.predict.mockResolvedValueOnce(mlResult('Low'));
    pool.query.mockResolvedValueOnce({ rows: [{ prediction_id: 4, risk_level: 'Low', final_risk_level: 'Low' }] });

    await request(app).post('/api/incidents').set('Authorization', `Bearer ${owner}`).send(body);

    const [sql, params] = pool.query.mock.calls[1];
    expect(sql).toMatch(/shift_id = \$1 OR task_id IN/);
    expect(sql).toMatch(/hi\.carried_over/);
    expect(params).toEqual([2, 3]);
  });

  test('keeps the incident when the model service is down', async () => {
    mockCreateQueries();
    mlClient.predict.mockRejectedValueOnce(
      new mlClient.MlServiceError('Risk prediction service unavailable')
    );

    const res = await request(app).post('/api/incidents').set('Authorization', `Bearer ${owner}`).send(body);

    expect(res.status).toBe(201);
    expect(res.body.incident.incident_id).toBe(10);
    expect(res.body.prediction).toBeNull();
    expect(res.body.prediction_error).toBe('Risk prediction service unavailable');
  });

  test('rejects out-of-range features before touching the database', async () => {
    const res = await request(app)
      .post('/api/incidents')
      .set('Authorization', `Bearer ${owner}`)
      .send({ ...body, severity_score: 1.5, task_status: 'Deferred' });

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.details)).toEqual(['task_status', 'severity_score']);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('needs task_status when no task is linked', async () => {
    pool.query.mockResolvedValueOnce({ rows: [shift] });
    const { task_id, ...withoutTask } = body;

    const res = await request(app)
      .post('/api/incidents')
      .set('Authorization', `Bearer ${owner}`)
      .send(withoutTask);

    expect(res.status).toBe(400);
    expect(res.body.details).toHaveProperty('task_status');
  });

  test('is refused for a manager who does not own the shift', async () => {
    pool.query.mockResolvedValueOnce({ rows: [shift] });

    const res = await request(app).post('/api/incidents').set('Authorization', `Bearer ${other}`).send(body);

    expect(res.status).toBe(403);
    expect(mlClient.predict).not.toHaveBeenCalled();
  });
});

describe('POST /api/incidents/:id/predict', () => {
  test('returns 503 when the model service is still down', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ ...incidentRow, ...shift }] });
    mlClient.predict.mockRejectedValueOnce(new mlClient.MlServiceError('Risk prediction service unavailable'));

    const res = await request(app).post('/api/incidents/10/predict').set('Authorization', `Bearer ${owner}`);

    expect(res.status).toBe(503);
  });

  test('stores a new prediction on retry', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ ...incidentRow, ...shift, severity_score: '0.9500' }] })
      .mockResolvedValueOnce({ rows: [{ prediction_id: 6, risk_level: 'Medium', final_risk_level: 'Medium' }] });
    mlClient.predict.mockResolvedValueOnce(mlResult('Medium'));

    const res = await request(app).post('/api/incidents/10/predict').set('Authorization', `Bearer ${owner}`);

    expect(res.status).toBe(201);
    expect(mlClient.predict.mock.calls[0][0].severity_score).toBe(0.95); // NUMERIC string -> number
  });
});

describe('GET /api/incidents', () => {
  test('rejects an unknown risk level filter', async () => {
    const res = await request(app).get('/api/incidents?risk_level=Severe').set('Authorization', `Bearer ${owner}`);

    expect(res.status).toBe(400);
  });

  test('passes the filters to the query', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/incidents?shift_id=2&risk_level=High')
      .set('Authorization', `Bearer ${owner}`);

    expect(res.status).toBe(200);
    expect(pool.query.mock.calls[0][1]).toEqual([2, 'High', null, null]);
  });
});

describe('notifications', () => {
  test('GET lists only my notifications with an unread count', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ notification_id: 1, is_read: false }, { notification_id: 2, is_read: true }] });

    const res = await request(app).get('/api/notifications').set('Authorization', `Bearer ${owner}`);

    expect(res.status).toBe(200);
    expect(res.body.unread_count).toBe(1);
    expect(pool.query.mock.calls[0][1]).toEqual([1]);
  });

  test("PATCH /:id/read returns 404 for someone else's notification", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).patch('/api/notifications/1/read').set('Authorization', `Bearer ${other}`);

    expect(res.status).toBe(404);
    expect(pool.query.mock.calls[0][1]).toEqual([1, 2]);
  });
});
