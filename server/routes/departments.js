const express = require('express');
const pool = require('../config/db');

const router = express.Router();

// Public: the register form needs the list before the user has an account.
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT department_id, name FROM departments ORDER BY name');
    res.json({ departments: rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
