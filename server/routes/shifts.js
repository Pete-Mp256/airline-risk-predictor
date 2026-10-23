const express = require('express');
const auth = require('../middleware/auth');
const { listShifts, createShift, getShift, updateShift } = require('../controllers/shiftController');

const router = express.Router();

router.use(auth);

router.get('/', listShifts);
router.post('/', createShift);
router.get('/:id', getShift);
router.patch('/:id', updateShift);

module.exports = router;
