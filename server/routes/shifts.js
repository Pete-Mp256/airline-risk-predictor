const express = require('express');
const auth = require('../middleware/auth');
const { listShifts, createShift, getShift, updateShift } = require('../controllers/shiftController');
const { createTask } = require('../controllers/taskController');

const router = express.Router();

router.use(auth);

router.get('/', listShifts);
router.post('/', createShift);
router.get('/:id', getShift);
router.patch('/:id', updateShift);
router.post('/:id/tasks', createTask);

module.exports = router;
