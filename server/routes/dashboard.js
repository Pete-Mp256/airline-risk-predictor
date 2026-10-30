const express = require('express');
const auth = require('../middleware/auth');
const { getSummary, listIncidents, listOpenTasks } = require('../controllers/dashboardController');

const router = express.Router();

router.use(auth);

router.get('/summary', getSummary);
router.get('/incidents', listIncidents);
router.get('/open-tasks', listOpenTasks);

module.exports = router;
