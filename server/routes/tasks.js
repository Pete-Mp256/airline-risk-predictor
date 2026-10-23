const express = require('express');
const auth = require('../middleware/auth');
const { updateTask } = require('../controllers/taskController');

const router = express.Router();

router.use(auth);

router.patch('/:id', updateTask);

module.exports = router;
