const express = require('express');
const auth = require('../middleware/auth');
const {
  listHandovers, getHandover, updateHandover, addNote, removeNote,
  submitHandover, acknowledgeHandover, acknowledgeItem,
} = require('../controllers/handoverController');

const router = express.Router();

router.use(auth);

// Starting a handover is POST /api/shifts/:id/handover (routes/shifts.js).
router.get('/', listHandovers);
router.get('/:id', getHandover);
router.patch('/:id', updateHandover);
router.post('/:id/notes', addNote);
router.delete('/:id/items/:itemId', removeNote);
router.post('/:id/submit', submitHandover);
router.post('/:id/acknowledge', acknowledgeHandover);
router.post('/:id/items/:itemId/acknowledge', acknowledgeItem);

module.exports = router;
