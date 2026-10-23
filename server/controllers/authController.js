const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const TOKEN_EXPIRES_IN = '8h'; // one shift
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
    // Same message for unknown email and wrong password
    if (!found || !(await bcrypt.compare(password, found.password_hash))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    if (!found.is_active) {
      return res.status(403).json({ message: 'This account has been deactivated' });
    }

    const { password_hash, ...manager } = found;
    res.json({ token: signToken(manager), manager });
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

module.exports = { register, login, me };
