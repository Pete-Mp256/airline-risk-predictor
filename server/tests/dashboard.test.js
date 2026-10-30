// Dashboard summary route tests. The database is mocked.
process.env.JWT_SECRET = 'test-secret';

jest.mock('../config/db', () => ({ query: jest.fn() }));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const app = require('../app');

const token = jwt.sign({ manager_id: 1, department_id: 1 }, 'test-secret');

// Mocks the three summary queries: grouped counts, recent High incidents, today + open tasks.
function mockSummary(grouped, recentHigh = [], extra = { today: '2026-10-30', open_tasks: 3 }) {
  pool.query
    .mockResolvedValueOnce({ rows: grouped })
    .mockResolvedValueOnce({ rows: recentHigh })
    .mockResolvedValueOnce({ rows: [extra] });
}

function getSummary(query = '') {
  return request(app).get(`/api/dashboard/summary${query}`).set('Authorization', `Bearer ${token}`);
}

beforeEach(() => {
  pool.query.mockReset();
});

describe('GET /api/dashboard/summary', () => {
  test('returns 401 without a token', async () => {
    const res = await request(app).get('/api/dashboard/summary');

    expect(res.status).toBe(401);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test.each(['0', '366', '2.5', 'week'])('rejects days=%s', async (days) => {
    const res = await getSummary(`?days=${days}`);

    expect(res.status).toBe(400);
    expect(res.body.details).toHaveProperty('days');
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('uses a 30 day window by default', async () => {
    mockSummary([]);

    const res = await getSummary();

    expect(res.status).toBe(200);
    expect(pool.query.mock.calls.map((call) => call[1])).toEqual([[30], [30], [30]]);
    expect(res.body.by_day).toHaveLength(30);
    expect(res.body.from).toBe('2026-10-01');
    expect(res.body.to).toBe('2026-10-30');
  });

  test('adds up the grouped counts into each breakdown', async () => {
    const high = { incident_id: 9, incident_type: 'Power failure', confidence: 0.92 };
    mockSummary(
      [
        { day: '2026-10-30', department_id: 1, department_name: 'Line Maintenance', shift_type: 'Night', risk_level: 'High', count: 2 },
        { day: '2026-10-30', department_id: 1, department_name: 'Line Maintenance', shift_type: 'Morning', risk_level: 'Low', count: 1 },
        { day: '2026-10-28', department_id: 2, department_name: 'Base Maintenance', shift_type: 'Night', risk_level: 'Medium', count: 4 },
        { day: '2026-10-28', department_id: 2, department_name: 'Base Maintenance', shift_type: 'Night', risk_level: null, count: 1 },
      ],
      [high]
    );

    const res = await getSummary('?days=7');

    expect(res.status).toBe(200);
    expect(res.body.totals).toEqual({ incidents: 8, Low: 1, Medium: 4, High: 2, not_predicted: 1, open_tasks: 3 });
    expect(res.body.by_risk).toEqual([
      { risk_level: 'Low', count: 1 },
      { risk_level: 'Medium', count: 4 },
      { risk_level: 'High', count: 2 },
    ]);
    // Sorted by total, busiest department first.
    expect(res.body.by_department.map((d) => [d.department_id, d.department, d.total])).toEqual([
      [2, 'Base Maintenance', 5],
      [1, 'Line Maintenance', 3],
    ]);
    // Every shift type is listed, even with no incidents.
    expect(res.body.by_shift_type).toEqual([
      { shift_type: 'Morning', Low: 1, Medium: 0, High: 0, not_predicted: 0, total: 1 },
      { shift_type: 'Afternoon', Low: 0, Medium: 0, High: 0, not_predicted: 0, total: 0 },
      { shift_type: 'Night', Low: 0, Medium: 4, High: 2, not_predicted: 1, total: 7 },
    ]);
    // One entry per day in the window, oldest first, empty days included.
    expect(res.body.by_day.map((d) => [d.day, d.total])).toEqual([
      ['2026-10-24', 0],
      ['2026-10-25', 0],
      ['2026-10-26', 0],
      ['2026-10-27', 0],
      ['2026-10-28', 5],
      ['2026-10-29', 0],
      ['2026-10-30', 3],
    ]);
    expect(res.body.recent_high).toEqual([high]);
  });
});

describe('GET /api/dashboard/incidents', () => {
  test.each([
    ['risk_level=Severe', 'risk_level'],
    ['shift_type=Evening', 'shift_type'],
    ['department_id=abc', 'department_id'],
    ['day=2026-02-30', 'day'],
    ['day=yesterday', 'day'],
    ['days=0', 'days'],
  ])('rejects %s', async (query, field) => {
    const res = await request(app).get(`/api/dashboard/incidents?${query}`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.details).toHaveProperty(field);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('passes the filters to the query, mapping the shift type label', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ incident_id: 4 }] });

    const res = await request(app)
      .get('/api/dashboard/incidents?days=7&risk_level=none&shift_type=night&department_id=2&day=2026-10-28')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.incidents).toEqual([{ incident_id: 4 }]);
    expect(pool.query.mock.calls[0][1]).toEqual([7, 'none', 'Night', 2, '2026-10-28']);
  });

  test('lists every incident in the window when no filter is given', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/dashboard/incidents').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(pool.query.mock.calls[0][1]).toEqual([30, null, null, null, null]);
  });
});

describe('GET /api/dashboard/open-tasks', () => {
  test('returns 401 without a token', async () => {
    const res = await request(app).get('/api/dashboard/open-tasks');

    expect(res.status).toBe(401);
  });

  test('lists open tasks in the window', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ task_id: 3, status: 'Pending' }] });

    const res = await request(app).get('/api/dashboard/open-tasks?days=90').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.tasks).toEqual([{ task_id: 3, status: 'Pending' }]);
    expect(pool.query.mock.calls[0][0]).toMatch(/status <> 'Complete'/);
    expect(pool.query.mock.calls[0][1]).toEqual([90]);
  });
});
