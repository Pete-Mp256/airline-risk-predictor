const express = require('express');
const auth = require('../middleware/auth');
const {
  createIncident,
  predictIncident,
  listIncidents,
  getIncident,
} = require('../controllers/incidentController');

const router = express.Router();

router.use(auth);

router.get('/', listIncidents);
router.post('/', createIncident);
router.get('/:id', getIncident);
router.post('/:id/predict', predictIncident);

module.exports = router;
