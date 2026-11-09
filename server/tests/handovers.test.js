// Handover route tests. The database and mailer are mocked, so these run without PostgreSQL or SMTP.
process.env.JWT_SECRET = 'test-secret';

jest.mock('../config/db', () => ({ query: jest.fn() }));
jest.mock('../services/mailer', () => ({ sendMail: jest.fn().mockResolvedValue() }));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { sendMail } = require('../services/mailer');
const app = require('../app');

const token = (manager_id, department_id) => jwt.sign({ manager_id, department_id }, 'test-secret');
const sender = token(1, 1);    // owns the shift and started the handover
const incoming = token(2, 2);  // named incoming manager, other department
const colleague = token(4, 1); // same department as the shift
const outsider = token(3, 3);

// A row as returned by HANDOVER_SELECT.
function handoverRow(overrides = {}) {
  return {
    handover_id: 5, shift_id: 2, from_manager_id: 1, to_manager_id: 2, department_id: 1,
    status: 'Draft', summary: 'Hydraulic leak on 5Y-KZA still open', shift_type: 'Night',
    department_name: 'Line Maintenance', from_manager_name: 'Amina Odhiambo', staff_count: 6,
    start_time: '2026-10-20T19:00:00.000Z', end_time: '2026-10-21T03:00:00.000Z',
    ...overrides,
  };
}

const ITEMS = [
  { item_id: 1, item_type: 'Open task', task_id: 3, task_title: 'Borescope engine 1', aircraft_reg: '5Y-KZA', task_status: 'Pending', carried_over: true },
  { item_id: 2, item_type: 'Incident', incident_id: 3, incident_type: 'Power failure', occurred_at: '2026-10-20T23:30:00.000Z', risk_level: 'High', final_risk_level: 'High' },
  { item_id: 3, item_type: 'Note', note: 'Spare GPU is in bay 2' },
];

const auth = (req, t) => req.set('Authorization', `Bearer ${t}`);

beforeEach(() => {
  pool.query.mockReset();
  sendMail.mockReset().mockResolvedValue();
});

describe('start a handover', () => {
  test('creates it for the shift owner with open tasks and incidents', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ shift_id: 2, manager_id: 1 }] })
      .mockResolvedValueOnce({ rows: [{ handover_id: 5, shift_id: 2, status: 'Draft' }] })
      .mockResolvedValueOnce({ rows: ITEMS.slice(0, 2) });

    const res = await auth(request(app).post('/api/shifts/2/handover'), sender).send({ to_manager_id: 2 });

    expect(res.status).toBe(201);
    expect(res.body.items).toHaveLength(2);
    const [sql, params] = pool.query.mock.calls[1];
    expect(sql).toMatch(/ON CONFLICT \(shift_id\) DO NOTHING/);
    expect(sql).toMatch(/'Open task', t\.task_id, TRUE[\s\S]*t\.status <> 'Complete'/);
    expect(sql).toMatch(/'Incident', i\.incident_id[\s\S]*i\.shift_id = \$1/);
    expect(params).toEqual([2, 1, 2, null]);
  });

  test('is refused for a manager who does not own the shift', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ shift_id: 2, manager_id: 1 }] });

    const res = await auth(request(app).post('/api/shifts/2/handover'), outsider).send({});

    expect(res.status).toBe(403);
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test('returns 409 when the shift already has a handover', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ shift_id: 2, manager_id: 1 }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await auth(request(app).post('/api/shifts/2/handover'), sender).send({});

    expect(res.status).toBe(409);
  });

  test('rejects handing over to yourself', async () => {
    const res = await auth(request(app).post('/api/shifts/2/handover'), sender).send({ to_manager_id: 1 });

    expect(res.status).toBe(400);
    expect(res.body.details).toHaveProperty('to_manager_id');
    expect(pool.query).not.toHaveBeenCalled();
  });
});

describe('view and list', () => {
  test('GET /:id works for someone in the shift department', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [handoverRow()] })
      .mockResolvedValueOnce({ rows: ITEMS });

    const res = await auth(request(app).get('/api/handovers/5'), colleague);

    expect(res.status).toBe(200);
    expect(res.body.handover.from_manager_name).toBe('Amina Odhiambo');
    expect(res.body.items.map((i) => i.item_type)).toEqual(['Open task', 'Incident', 'Note']);
  });

  test('GET /:id is refused for an outsider', async () => {
    pool.query.mockResolvedValueOnce({ rows: [handoverRow()] });

    const res = await auth(request(app).get('/api/handovers/5'), outsider);

    expect(res.status).toBe(403);
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test('GET / lists incoming handovers for me or my department', async () => {
    pool.query.mockResolvedValueOnce({ rows: [handoverRow({ status: 'Submitted' })] });

    const res = await auth(request(app).get('/api/handovers?box=incoming'), incoming);

    expect(res.status).toBe(200);
    expect(pool.query.mock.calls[0][0]).toMatch(/h\.status <> 'Draft'/);
    expect(pool.query.mock.calls[0][1]).toEqual([2, 2]);
  });

  test('GET / rejects an unknown box', async () => {
    const res = await auth(request(app).get('/api/handovers?box=archive'), sender);

    expect(res.status).toBe(400);
  });
});

describe('edit while Draft', () => {
  test('PATCH updates the summary and incoming manager for the sender', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [handoverRow()] })
      .mockResolvedValueOnce({ rows: [handoverRow({ summary: 'Updated', to_manager_id: 4 })] });

    const res = await auth(request(app).patch('/api/handovers/5'), sender).send({ summary: 'Updated', to_manager_id: 4 });

    expect(res.status).toBe(200);
    expect(pool.query.mock.calls[1][0]).toMatch(/SET summary = \$1, to_manager_id = \$2, updated_at = NOW\(\)/);
    expect(pool.query.mock.calls[1][1]).toEqual(['Updated', 4, 5]);
  });

  test('PATCH returns 409 after the handover is submitted', async () => {
    pool.query.mockResolvedValueOnce({ rows: [handoverRow({ status: 'Submitted' })] });

    const res = await auth(request(app).patch('/api/handovers/5'), sender).send({ summary: 'Too late' });

    expect(res.status).toBe(409);
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test('PATCH is refused for anyone but the sender', async () => {
    pool.query.mockResolvedValueOnce({ rows: [handoverRow()] });

    const res = await auth(request(app).patch('/api/handovers/5'), incoming).send({ summary: 'Mine now' });

    expect(res.status).toBe(403);
  });

  test('adds and removes a note', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [handoverRow()] })
      .mockResolvedValueOnce({ rows: [{ item_id: 9, item_type: 'Note', note: 'Check GPU' }] })
      .mockResolvedValueOnce({ rows: [handoverRow()] })
      .mockResolvedValueOnce({ rows: [{ item_id: 9 }] });

    const added = await auth(request(app).post('/api/handovers/5/notes'), sender).send({ note: '  Check GPU ' });
    const removed = await auth(request(app).delete('/api/handovers/5/items/9'), sender);

    expect(added.status).toBe(201);
    expect(pool.query.mock.calls[1][1]).toEqual([5, 'Check GPU']);
    expect(removed.status).toBe(204);
    expect(pool.query.mock.calls[3][0]).toMatch(/item_type = 'Note'/);
  });

  test('adding a note after submit returns 409', async () => {
    pool.query.mockResolvedValueOnce({ rows: [handoverRow({ status: 'Acknowledged' })] });

    const res = await auth(request(app).post('/api/handovers/5/notes'), sender).send({ note: 'Late note' });

    expect(res.status).toBe(409);
  });
});

describe('submit', () => {
  test('needs a summary', async () => {
    pool.query.mockResolvedValueOnce({ rows: [handoverRow({ summary: '  ' })] });

    const res = await auth(request(app).post('/api/handovers/5/submit'), sender);

    expect(res.status).toBe(400);
    expect(res.body.details).toHaveProperty('summary');
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test('notifies and emails the incoming manager and marks the shift as handed over', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [handoverRow()] })
      .mockResolvedValueOnce({ rows: [handoverRow({ status: 'Submitted' })] })
      .mockResolvedValueOnce({ rows: ITEMS })
      .mockResolvedValueOnce({ rows: [{ email: 'brian@example.com', first_name: 'Brian' }] });

    const res = await auth(request(app).post('/api/handovers/5/submit'), sender);
    await new Promise(setImmediate);

    expect(res.status).toBe(200);
    expect(res.body.notified).toBe(1);
    expect(pool.query.mock.calls[1][0]).toMatch(/SET status = 'Submitted'/);

    const [sql, params] = pool.query.mock.calls[3];
    expect(sql).toMatch(/UPDATE shifts SET handover_sent_at/);
    expect(sql).toMatch(/INSERT INTO notifications \(manager_id, shift_id, message\)/);
    expect(params).toEqual([2, 'Handover from Amina Odhiambo: Night shift, Line Maintenance. 1 open task carried over.', 1, 2, 1]);

    expect(sendMail).toHaveBeenCalledTimes(1);
    const mail = sendMail.mock.calls[0][0];
    expect(mail.to).toBe('brian@example.com');
    expect(mail.text).toMatch(/Borescope engine 1 \(5Y-KZA\): Pending/);
    expect(mail.text).toMatch(/Power failure: High risk/);
    expect(mail.text).toMatch(/Hydraulic leak on 5Y-KZA still open\n- Spare GPU is in bay 2/);
  });

  test('returns 409 when already submitted', async () => {
    pool.query.mockResolvedValueOnce({ rows: [handoverRow({ status: 'Submitted' })] });

    const res = await auth(request(app).post('/api/handovers/5/submit'), sender);

    expect(res.status).toBe(409);
    expect(sendMail).not.toHaveBeenCalled();
  });
});

describe('acknowledge', () => {
  test('the incoming manager acknowledges the whole handover', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [handoverRow({ status: 'Submitted' })] })
      .mockResolvedValueOnce({ rows: [{ handover_id: 5, status: 'Acknowledged', items_acknowledged: 3 }] });

    const res = await auth(request(app).post('/api/handovers/5/acknowledge'), incoming);

    expect(res.status).toBe(200);
    expect(res.body.handover.items_acknowledged).toBe(3);
    expect(pool.query.mock.calls[1][1]).toEqual([5, 2]);
  });

  test('someone in the department acknowledges a single item', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [handoverRow({ status: 'Submitted' })] })
      .mockResolvedValueOnce({ rows: [{ item_id: 1, acknowledged_at: '2026-10-21T04:00:00.000Z' }] });

    const res = await auth(request(app).post('/api/handovers/5/items/1/acknowledge'), colleague);

    expect(res.status).toBe(200);
    expect(pool.query.mock.calls[1][1]).toEqual([1, 5]);
  });

  test('is refused for outsiders and for the sender', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [handoverRow({ status: 'Submitted' })] })
      .mockResolvedValueOnce({ rows: [handoverRow({ status: 'Submitted' })] });

    const byOutsider = await auth(request(app).post('/api/handovers/5/acknowledge'), outsider);
    const bySender = await auth(request(app).post('/api/handovers/5/items/1/acknowledge'), sender);

    expect(byOutsider.status).toBe(403);
    expect(bySender.status).toBe(403);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  test('returns 409 for a draft', async () => {
    pool.query.mockResolvedValueOnce({ rows: [handoverRow()] });

    const res = await auth(request(app).post('/api/handovers/5/acknowledge'), incoming);

    expect(res.status).toBe(409);
  });
});

describe('managers list', () => {
  test('returns active managers without contact details', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ manager_id: 2, first_name: 'Brian', last_name: 'Kamau' }] });

    const res = await auth(request(app).get('/api/managers?department_id=2'), sender);

    expect(res.status).toBe(200);
    expect(pool.query.mock.calls[0][0]).not.toMatch(/email|phone/);
    expect(pool.query.mock.calls[0][1]).toEqual([2]);
  });

  test('requires a token', async () => {
    const res = await request(app).get('/api/managers');

    expect(res.status).toBe(401);
  });
});
