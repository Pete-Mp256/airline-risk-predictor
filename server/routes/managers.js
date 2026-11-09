const express = require('express');
const auth = require('../middleware/auth');
const pool = require('../config/db');
const { parseId, invalid } = require('../utils/request');

const router = express.Router();

// Active managers for picking a handover's incoming manager. No emails or phone numbers.
router.get('/', auth, async (req, res, next) => {
  const { department_id } = req.query;
  const departmentId = department_id === undefined ? null : parseId(department_id);
  if (department_id !== undefined && departmentId === null) {
    return invalid(res, { department_id: 'department_id must be a positive integer' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT m.manager_id, m.first_name, m.last_name, m.department_id, d.name AS department_name
         FROM shift_managers m
         LEFT JOIN departments d ON d.department_id = m.department_id
        WHERE m.is_active AND ($1::int IS NULL OR m.department_id = $1::int)
        ORDER BY m.first_name, m.last_name`,
      [departmentId]
    );
    res.json({ managers: rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
