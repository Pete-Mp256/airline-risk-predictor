// Shift and task route tests. The database is mocked, so these run without PostgreSQL.
process.env.JWT_SECRET = 'test-secret';

jest.mock('../config/db', () => ({ query: jest.fn() }));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const app = require('../app');
const { toShiftType, toTaskStatus } = require('../utils/labels');

const owner = jwt.sign({ manager_id: 1, department_id: 1 }, 'test-secret');
const other = jwt.sign({ manager_id: 2, department_id: 2 }, 'test-secret');

const validShift = {
  shift_type: 'night',
  shift_date: '2026-10-23',
  start_time: '2026-10-23T22:00:00+03:00',
  end_time: '2026-10-24T06:00:00+03:00',
  staff_count: 6,
};

beforeEach(() => {
  pool.query.mockReset();
});

describe('label mapping', () => {
  test('maps client values to the model labels', () => {
    expect(toTaskStatus('pending')).toBe('Pending');
    expect(toTaskStatus('in-progress')).toBe('In Progress');
    expect(toTaskStatus('Completed')).toBe('Complete');
    expect(toTaskStatus('Deferred')).toBeNull();
    expect(toShiftType('NIGHT')).toBe('Night');
    expect(toShiftType('Evening')).toBeNull();
  });
});

describe('shifts', () => {
  test('require a token', async () => {
    const res = await request(app).get('/api/shifts');
    expect(res.status).toBe(401);
  });

  test('POST creates a shift for the logged-in manager in their department', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ shift_id: 7, shift_type: 'Night' }] });

    const res = await request(app)
      .post('/api/shifts')
      .set('Authorization', `Bearer ${owner}`)
      .send(validShift);

    expect(res.status).toBe(201);
    const params = pool.query.mock.calls[0][1];
    expect(params.slice(0, 3)).toEqual([1, 1, 'Night']);
  });

  test('POST rejects a bad shift type and an end before the start', async () => {
    const res = await request(app)
      .post('/api/shifts')
      .set('Authorization', `Bearer ${owner}`)
      .send({ ...validShift, shift_type: 'Evening', end_time: '2026-10-23T21:00:00+03:00' });

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.details)).toEqual(['shift_type', 'end_time']);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('GET /:id returns the handover view with tasks and incidents', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ shift_id: 2, manager_name: 'Amina Odhiambo' }] })
      .mockResolvedValueOnce({ rows: [{ task_id: 3, status: 'Pending' }] })
      .mockResolvedValueOnce({ rows: [{ incident_id: 3, risk_level: 'High' }] });

    const res = await request(app).get('/api/shifts/2').set('Authorization', `Bearer ${other}`);

    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(1);
    expect(res.body.incidents[0].risk_level).toBe('High');
  });

  test('GET /:id returns 404 for a missing shift', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/shifts/999').set('Authorization', `Bearer ${owner}`);

    expect(res.status).toBe(404);
  });

  test('PATCH /:id is refused for a manager who does not own the shift', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ shift_id: 2, manager_id: 1 }] });

    const res = await request(app)
      .patch('/api/shifts/2')
      .set('Authorization', `Bearer ${other}`)
      .send({ notes: 'Handover notes' });

    expect(res.status).toBe(403);
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test('PATCH /:id updates the notes for the owner', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ shift_id: 2, manager_id: 1 }] })
      .mockResolvedValueOnce({ rows: [{ shift_id: 2, notes: 'Handover notes' }] });

    const res = await request(app)
      .patch('/api/shifts/2')
      .set('Authorization', `Bearer ${owner}`)
      .send({ notes: 'Handover notes' });

    expect(res.status).toBe(200);
    expect(pool.query.mock.calls[1][0]).toMatch(/UPDATE shifts SET notes = \$1 WHERE shift_id = \$2/);
    expect(pool.query.mock.calls[1][1]).toEqual(['Handover notes', 2]);
  });
});

describe('tasks', () => {
  test('POST /api/shifts/:id/tasks stores the mapped status', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ shift_id: 2, manager_id: 1 }] })
      .mockResolvedValueOnce({ rows: [{ task_id: 9, status: 'In Progress' }] });

    const res = await request(app)
      .post('/api/shifts/2/tasks')
      .set('Authorization', `Bearer ${owner}`)
      .send({ title: 'Borescope engine #1', complexity: 3, status: 'in-progress' });

    expect(res.status).toBe(201);
    expect(pool.query.mock.calls[1][1]).toEqual([2, 'Borescope engine #1', 3, 'In Progress']);
  });

  test('POST /api/shifts/:id/tasks requires a title', async () => {
    const res = await request(app)
      .post('/api/shifts/2/tasks')
      .set('Authorization', `Bearer ${owner}`)
      .send({ status: 'pending' });

    expect(res.status).toBe(400);
    expect(res.body.details).toHaveProperty('title');
  });

  test('PATCH /api/tasks/:id rejects a status the model does not know', async () => {
    const res = await request(app)
      .patch('/api/tasks/3')
      .set('Authorization', `Bearer ${owner}`)
      .send({ status: 'Deferred' });

    expect(res.status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('PATCH /api/tasks/:id is refused for a manager who does not own the shift', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ manager_id: 1 }] });

    const res = await request(app)
      .patch('/api/tasks/3')
      .set('Authorization', `Bearer ${other}`)
      .send({ status: 'complete' });

    expect(res.status).toBe(403);
  });

  test('PATCH /api/tasks/:id returns 404 for a missing task', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .patch('/api/tasks/999')
      .set('Authorization', `Bearer ${owner}`)
      .send({ status: 'complete' });

    expect(res.status).toBe(404);
  });
});
