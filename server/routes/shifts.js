const express = require('express');
const auth = require('../middleware/auth');
const { listShifts, createShift, getShift, updateShift } = require('../controllers/shiftController');
const { createTask } = require('../controllers/taskController');
const { startHandover } = require('../controllers/handoverController');

const router = express.Router();

router.use(auth);

router.get('/', listShifts);
router.post('/', createShift);
router.get('/:id', getShift);
router.patch('/:id', updateShift);
router.post('/:id/tasks', createTask);
router.post('/:id/handover', startHandover);

module.exports = router;
