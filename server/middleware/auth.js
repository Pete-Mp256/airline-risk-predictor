const jwt = require('jsonwebtoken');

// Verifies a Bearer JWT and attaches the decoded payload to req.user
module.exports = function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // A pending 2FA token only works on the verify and resend routes.
    if (payload.purpose) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};
