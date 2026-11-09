// Auth route tests. The database is mocked, so these run without PostgreSQL.
process.env.JWT_SECRET = 'test-secret';

jest.mock('../config/db', () => ({ query: jest.fn() }));
jest.mock('../services/mailer', () => ({ sendMail: jest.fn().mockResolvedValue() }));

const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/db');
const { sendMail } = require('../services/mailer');
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

// Same keyed hash the controller stores in login_codes.
function hashCode(managerId, code) {
  return crypto.createHmac('sha256', 'test-secret').update(`${managerId}:${code}`).digest('hex');
}
const pendingToken = jwt.sign({ manager_id: 1, purpose: '2fa' }, 'test-secret', { expiresIn: '10m' });

beforeEach(() => {
  pool.query.mockReset();
  sendMail.mockReset().mockResolvedValue();
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
  test('emails a 6-digit code for the right password instead of a session token', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ ...manager, password_hash: passwordHash }] })
      .mockResolvedValueOnce({ rows: [] }); // upsert login code

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'AMINA.ODHIAMBO@example.com', password: 'Password123!' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      requires_2fa: true,
      pending_token: expect.any(String),
      email: `a${'*'.repeat(13)}@example.com`, // amina.odhiambo -> a + 13 stars
    });
    expect(res.body).not.toHaveProperty('token');
    expect(jwt.verify(res.body.pending_token, 'test-secret').purpose).toBe('2fa');
    expect(pool.query.mock.calls[0][1]).toEqual(['amina.odhiambo@example.com']);

    // The emailed code matches the stored hash.
    const code = sendMail.mock.calls[0][0].text.match(/\b(\d{6})\b/)[1];
    const [, params] = pool.query.mock.calls[1];
    expect(params[0]).toBe(1);
    expect(params[1]).toBe(hashCode(1, code));
    expect(sendMail.mock.calls[0][0].to).toBe(manager.email);
  });

  test('returns 502 when the code email cannot be sent', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ ...manager, password_hash: passwordHash }] })
      .mockResolvedValueOnce({ rows: [] });
    sendMail.mockRejectedValueOnce(new Error('SMTP down'));
    jest.spyOn(console, 'error').mockImplementationOnce(() => {});

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: manager.email, password: 'Password123!' });

    expect(res.status).toBe(502);
    expect(res.body).not.toHaveProperty('pending_token');
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

describe('POST /api/auth/verify-2fa', () => {
  test('returns a session token for the right code and deletes the code', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ code_hash: hashCode(1, '123456'), attempts: 1 }] })
      .mockResolvedValueOnce({ rows: [] }) // delete code
      .mockResolvedValueOnce({ rows: [manager] });

    const res = await request(app)
      .post('/api/auth/verify-2fa')
      .send({ pending_token: pendingToken, code: '123456' });

    expect(res.status).toBe(200);
    expect(res.body.manager).toEqual(manager);
    const payload = jwt.verify(res.body.token, 'test-secret');
    expect(payload.manager_id).toBe(1);
    expect(payload).not.toHaveProperty('purpose');
    expect(pool.query.mock.calls[1][0]).toMatch(/DELETE FROM login_codes/);
  });

  test('returns 401 with attempts left for a wrong code', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ code_hash: hashCode(1, '123456'), attempts: 2 }] });

    const res = await request(app)
      .post('/api/auth/verify-2fa')
      .send({ pending_token: pendingToken, code: '654321' });

    expect(res.status).toBe(401);
    expect(res.body.attempts_left).toBe(3);
    expect(res.body).not.toHaveProperty('token');
  });

  test('returns 401 when the code is expired or locked', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/auth/verify-2fa')
      .send({ pending_token: pendingToken, code: '123456' });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Request a new code/);
  });

  test('rejects a session token used as the pending token, and a malformed code', async () => {
    const session = jwt.sign({ manager_id: 1 }, 'test-secret');
    const wrongToken = await request(app)
      .post('/api/auth/verify-2fa')
      .send({ pending_token: session, code: '123456' });
    const badCode = await request(app)
      .post('/api/auth/verify-2fa')
      .send({ pending_token: pendingToken, code: '12ab' });

    expect(wrongToken.status).toBe(401);
    expect(badCode.status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/resend-code', () => {
  test('sends a new code after the cooldown', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ ...manager, wait_seconds: 0 }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).post('/api/auth/resend-code').send({ pending_token: pendingToken });

    expect(res.status).toBe(200);
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  test('returns 429 during the cooldown', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ ...manager, wait_seconds: 42 }] });

    const res = await request(app).post('/api/auth/resend-code').send({ pending_token: pendingToken });

    expect(res.status).toBe(429);
    expect(res.body.retry_after).toBe(42);
    expect(sendMail).not.toHaveBeenCalled();
  });
});

describe('GET /api/departments', () => {
  test('lists departments without a token', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ department_id: 1, name: 'Line Maintenance' }] });

    const res = await request(app).get('/api/departments');

    expect(res.status).toBe(200);
    expect(res.body.departments).toHaveLength(1);
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

  test('returns 401 without a token, with a bad token, or with a pending 2FA token', async () => {
    const none = await request(app).get('/api/auth/me');
    const bad = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-jwt');
    const pending = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${pendingToken}`);

    expect(none.status).toBe(401);
    expect(bad.status).toBe(401);
    expect(pending.status).toBe(401);
    expect(pool.query).not.toHaveBeenCalled();
  });
});
