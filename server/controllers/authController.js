const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const pool = require('../config/db');
const { sendMail } = require('../services/mailer');

const TOKEN_EXPIRES_IN = '8h'; // one shift
const CODE_TTL_MINUTES = 10; // email 2FA code and the pending token that goes with it
const CODE_MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;

const googleClient = new OAuth2Client();
const BCRYPT_ROUNDS = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Columns safe to send to the client (never password_hash)
const MANAGER_COLUMNS =
  'manager_id, department_id, first_name, last_name, email, phone, is_active, created_at';

function signToken(manager) {
  return jwt.sign(
    {
      manager_id: manager.manager_id,
      email: manager.email,
      department_id: manager.department_id,
    },
    process.env.JWT_SECRET,
    { expiresIn: TOKEN_EXPIRES_IN }
  );
}

// Short-lived token that only lets the holder verify or resend a 2FA code; auth middleware rejects it.
function signPendingToken(managerId) {
  return jwt.sign({ manager_id: managerId, purpose: '2fa' }, process.env.JWT_SECRET, {
    expiresIn: `${CODE_TTL_MINUTES}m`,
  });
}

function readPendingToken(token) {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return payload.purpose === '2fa' ? payload.manager_id : null;
  } catch {
    return null;
  }
}

// Keyed hash so a leaked table can't be brute-forced without the server secret.
function hashCode(managerId, code) {
  return crypto.createHmac('sha256', process.env.JWT_SECRET).update(`${managerId}:${code}`).digest('hex');
}

// a****@example.com
function maskEmail(email) {
  const [name, domain] = email.split('@');
  return `${name[0]}${'*'.repeat(Math.max(name.length - 1, 3))}@${domain}`;
}

// Replaces any previous code for this manager and emails the new one.
async function issueCode(manager) {
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  await pool.query(
    `INSERT INTO login_codes (manager_id, code_hash, expires_at)
     VALUES ($1, $2, NOW() + make_interval(mins => $3))
     ON CONFLICT (manager_id) DO UPDATE
       SET code_hash = EXCLUDED.code_hash, attempts = 0,
           expires_at = EXCLUDED.expires_at, created_at = NOW()`,
    [manager.manager_id, hashCode(manager.manager_id, code), CODE_TTL_MINUTES]
  );
  await sendMail({
    to: manager.email,
    subject: `Your sign-in code: ${code}`,
    text:
      `Hello ${manager.first_name},\n\nYour Incident Risk Predictor sign-in code is ${code}.\n` +
      `It expires in ${CODE_TTL_MINUTES} minutes. If you did not try to sign in, change your password.`,
    html:
      `<p>Hello ${manager.first_name},</p><p>Your Incident Risk Predictor sign-in code is</p>` +
      `<p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p>` +
      `<p>It expires in ${CODE_TTL_MINUTES} minutes. If you did not try to sign in, change your password.</p>`,
  });
}

// 502 when the email can't be sent; returns true if the response was already sent.
async function sendCodeOr502(manager, res) {
  try {
    await issueCode(manager);
    return false;
  } catch (err) {
    console.error('Sending the 2FA code failed:', err);
    res.status(502).json({ message: 'Could not send the verification code. Try again shortly.' });
    return true;
  }
}

function isBlank(value) {
  return typeof value !== 'string' || value.trim() === '';
}

async function register(req, res, next) {
  const { first_name, last_name, email, password, department_id, phone } = req.body || {};

  const errors = {};
  if (isBlank(first_name)) errors.first_name = 'First name is required';
  if (isBlank(last_name)) errors.last_name = 'Last name is required';
  if (isBlank(email) || !EMAIL_RE.test(email.trim())) errors.email = 'A valid email is required';
  if (typeof password !== 'string' || password.length < 8) {
    errors.password = 'Password must be at least 8 characters';
  }
  if (department_id != null && !Number.isInteger(department_id)) {
    errors.department_id = 'department_id must be an integer';
  }
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ message: 'Invalid input', details: errors });
  }

  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const { rows } = await pool.query(
      `INSERT INTO shift_managers (department_id, first_name, last_name, email, password_hash, phone)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${MANAGER_COLUMNS}`,
      [
        department_id ?? null,
        first_name.trim(),
        last_name.trim(),
        email.trim().toLowerCase(),
        passwordHash,
        phone || null,
      ]
    );
    const manager = rows[0];
    res.status(201).json({ token: signToken(manager), manager });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }
    if (err.code === '23503') {
      return res.status(400).json({ message: 'Invalid input', details: { department_id: 'Department not found' } });
    }
    next(err);
  }
}

async function login(req, res, next) {
  const { email, password } = req.body || {};
  if (isBlank(email) || typeof password !== 'string' || password === '') {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT ${MANAGER_COLUMNS}, password_hash FROM shift_managers WHERE email = $1`,
      [email.trim().toLowerCase()]
    );
    const found = rows[0];
    // Same message for unknown email, wrong password and Google-only accounts (no password)
    if (!found || !found.password_hash || !(await bcrypt.compare(password, found.password_hash))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    if (!found.is_active) {
      return res.status(403).json({ message: 'This account has been deactivated' });
    }

    if (await sendCodeOr502(found, res)) return;
    res.json({
      requires_2fa: true,
      pending_token: signPendingToken(found.manager_id),
      email: maskEmail(found.email),
    });
  } catch (err) {
    next(err);
  }
}

// Sign in with Google: the client sends the Google ID token (credential). Google has already
// verified the person, so this skips the email 2FA code and returns a session straight away.
async function googleSignIn(req, res, next) {
  const { credential } = req.body || {};
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(503).json({ message: 'Google sign-in is not configured on the server' });
  }
  if (isBlank(credential)) {
    return res.status(400).json({ message: 'Google credential is required' });
  }

  let profile;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    profile = ticket.getPayload();
  } catch {
    return res.status(401).json({ message: 'Google sign-in failed. Try again.' });
  }
  if (!profile.email || !profile.email_verified) {
    return res.status(401).json({ message: 'Your Google account email is not verified' });
  }

  const email = profile.email.toLowerCase();
  try {
    // Existing account: matched by Google ID, or linked on first Google sign-in by its verified email.
    let { rows } = await pool.query(
      `SELECT ${MANAGER_COLUMNS} FROM shift_managers WHERE google_id = $1`,
      [profile.sub]
    );
    if (!rows[0]) {
      ({ rows } = await pool.query(
        `UPDATE shift_managers SET google_id = $1
         WHERE email = $2 AND google_id IS NULL
         RETURNING ${MANAGER_COLUMNS}`,
        [profile.sub, email]
      ));
    }
    let created = false;
    if (!rows[0]) {
      ({ rows } = await pool.query(
        `INSERT INTO shift_managers (first_name, last_name, email, google_id)
         VALUES ($1, $2, $3, $4)
         RETURNING ${MANAGER_COLUMNS}`,
        [
          (profile.given_name || email.split('@')[0]).slice(0, 50),
          (profile.family_name || '-').slice(0, 50),
          email,
          profile.sub,
        ]
      ));
      created = true;
    }

    const manager = rows[0];
    if (!manager.is_active) {
      return res.status(403).json({ message: 'This account has been deactivated' });
    }
    res.status(created ? 201 : 200).json({ token: signToken(manager), manager, created });
  } catch (err) {
    // The email belongs to an account already linked to a different Google account.
    if (err.code === '23505') {
      return res.status(409).json({ message: 'This email is linked to a different Google account' });
    }
    next(err);
  }
}

async function verifyCode(req, res, next) {
  const { pending_token, code } = req.body || {};
  const managerId = readPendingToken(pending_token);
  if (!managerId) {
    return res.status(401).json({ message: 'Your sign-in session has expired. Log in again.' });
  }
  if (typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) {
    return res.status(400).json({ message: 'Enter the 6-digit code from your email' });
  }

  try {
    // Count the attempt before comparing, so parallel guesses can't exceed the limit.
    const { rows } = await pool.query(
      `UPDATE login_codes SET attempts = attempts + 1
       WHERE manager_id = $1 AND attempts < $2 AND expires_at > NOW()
       RETURNING code_hash, attempts`,
      [managerId, CODE_MAX_ATTEMPTS]
    );
    const stored = rows[0];
    if (!stored) {
      return res.status(401).json({
        message: 'This code has expired or had too many wrong attempts. Request a new code.',
      });
    }

    const expected = Buffer.from(stored.code_hash, 'hex');
    const given = Buffer.from(hashCode(managerId, code.trim()), 'hex');
    if (!crypto.timingSafeEqual(expected, given)) {
      return res.status(401).json({
        message: 'Incorrect code',
        attempts_left: CODE_MAX_ATTEMPTS - stored.attempts,
      });
    }

    await pool.query('DELETE FROM login_codes WHERE manager_id = $1', [managerId]);
    const found = await pool.query(
      `SELECT ${MANAGER_COLUMNS} FROM shift_managers WHERE manager_id = $1`,
      [managerId]
    );
    const manager = found.rows[0];
    if (!manager || !manager.is_active) {
      return res.status(403).json({ message: 'This account has been deactivated' });
    }
    res.json({ token: signToken(manager), manager });
  } catch (err) {
    next(err);
  }
}

async function resendCode(req, res, next) {
  const managerId = readPendingToken((req.body || {}).pending_token);
  if (!managerId) {
    return res.status(401).json({ message: 'Your sign-in session has expired. Log in again.' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT m.manager_id, m.first_name, m.email, m.is_active,
              GREATEST(0, CEIL(EXTRACT(EPOCH FROM
                (c.created_at + make_interval(secs => $2) - NOW()))))::int AS wait_seconds
       FROM shift_managers m LEFT JOIN login_codes c ON c.manager_id = m.manager_id
       WHERE m.manager_id = $1`,
      [managerId, RESEND_COOLDOWN_SECONDS]
    );
    const found = rows[0];
    if (!found || !found.is_active) {
      return res.status(403).json({ message: 'This account has been deactivated' });
    }
    if (found.wait_seconds > 0) {
      return res.status(429).json({
        message: `Wait ${found.wait_seconds} seconds before requesting a new code`,
        retry_after: found.wait_seconds,
      });
    }

    if (await sendCodeOr502(found, res)) return;
    res.json({ email: maskEmail(found.email) });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT ${MANAGER_COLUMNS} FROM shift_managers WHERE manager_id = $1`,
      [req.user.manager_id]
    );
    if (!rows[0]) {
      return res.status(404).json({ message: 'Account not found' });
    }
    res.json({ manager: rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, googleSignIn, verifyCode, resendCode, me };
