// Auth route tests. The database is mocked, so these run without PostgreSQL.
process.env.JWT_SECRET = 'test-secret';

jest.mock('../config/db', () => ({ query: jest.fn() }));

const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const app = require('../app');

const manager = {
  manager_id: 1,
  department_id: 1,
  first_name: 'Amina',
  last_name: 'Odhiambo',
  email: 'amina.odhiambo@example.com',
  phone: null,
  is_active: true,
  created_at: '2026-10-23T00:00:00.000Z',
};
const passwordHash = bcrypt.hashSync('Password123!', 4);

beforeEach(() => {
  pool.query.mockReset();
});

describe('POST /api/auth/register', () => {
  const valid = {
    first_name: 'Amina',
    last_name: 'Odhiambo',
    email: 'Amina.Odhiambo@example.com',
    password: 'Password123!',
    department_id: 1,
  };

  test('creates a manager and returns a token without the password hash', async () => {
    pool.query.mockResolvedValueOnce({ rows: [manager] });

    const res = await request(app).post('/api/auth/register').send(valid);

    expect(res.status).toBe(201);
    expect(res.body.manager).toEqual(manager);
    expect(jwt.verify(res.body.token, 'test-secret').manager_id).toBe(1);

    const [, params] = pool.query.mock.calls[0];
    expect(params[3]).toBe('amina.odhiambo@example.com');
    expect(await bcrypt.compare('Password123!', params[4])).toBe(true);
  });

  test('rejects missing fields and a short password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'short' });

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.details)).toEqual(
      expect.arrayContaining(['first_name', 'last_name', 'email', 'password'])
    );
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('returns 409 when the email is already registered', async () => {
    pool.query.mockRejectedValueOnce(Object.assign(new Error('duplicate'), { code: '23505' }));

    const res = await request(app).post('/api/auth/register').send(valid);

    expect(res.status).toBe(409);
  });
});

describe('POST /api/auth/login', () => {
  test('returns a token for the right password', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ ...manager, password_hash: passwordHash }] });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'AMINA.ODHIAMBO@example.com', password: 'Password123!' });

    expect(res.status).toBe(200);
    expect(res.body.manager).not.toHaveProperty('password_hash');
    expect(jwt.verify(res.body.token, 'test-secret').email).toBe(manager.email);
    expect(pool.query.mock.calls[0][1]).toEqual(['amina.odhiambo@example.com']);
  });

  test('returns the same 401 for a wrong password and an unknown email', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ ...manager, password_hash: passwordHash }] });
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: manager.email, password: 'wrong-password' });

    pool.query.mockResolvedValueOnce({ rows: [] });
    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'Password123!' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
  });

  test('returns 403 for a deactivated account', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ ...manager, is_active: false, password_hash: passwordHash }],
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: manager.email, password: 'Password123!' });

    expect(res.status).toBe(403);
  });
});

describe('GET /api/auth/me', () => {
  test('returns the logged-in manager for a valid token', async () => {
    pool.query.mockResolvedValueOnce({ rows: [manager] });
    const token = jwt.sign({ manager_id: 1 }, 'test-secret');

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.manager.email).toBe(manager.email);
  });

  test('returns 401 without a token or with a bad token', async () => {
    const none = await request(app).get('/api/auth/me');
    const bad = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-jwt');

    expect(none.status).toBe(401);
    expect(bad.status).toBe(401);
    expect(pool.query).not.toHaveBeenCalled();
  });
});
