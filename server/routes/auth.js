const express = require('express');
const auth = require('../middleware/auth');
const { register, login, verifyCode, resendCode, me } = require('../controllers/authController');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/verify-2fa', verifyCode);
router.post('/resend-code', resendCode);
router.get('/me', auth, me);

module.exports = router;
