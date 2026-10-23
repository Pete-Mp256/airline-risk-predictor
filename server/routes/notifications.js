const express = require('express');
const auth = require('../middleware/auth');
const { listNotifications, markRead } = require('../controllers/notificationController');

const router = express.Router();

router.use(auth);

router.get('/', listNotifications);
router.patch('/:id/read', markRead);

module.exports = router;
