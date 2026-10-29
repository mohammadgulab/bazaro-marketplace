const jwt = require('jsonwebtoken');
const config = require('./config');
const { HttpError } = require('./errors');

const signToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role, name: user.name }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

// Reads "Authorization: Bearer <token>" and puts the user on req.user.
function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new HttpError(401, 'Please sign in first'));
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = req.app.locals.db
      .prepare('SELECT id, name, email, role FROM users WHERE id = ?')
      .get(payload.sub);
    if (!user) return next(new HttpError(401, 'Account no longer exists'));
    req.user = user;
    next();
  } catch (err) {
    next(new HttpError(401, 'Session expired, please sign in again'));
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, (err) => {
    if (err) return next(err);
    if (req.user.role !== 'admin') return next(new HttpError(403, 'Admins only'));
    next();
  });
}

module.exports = { signToken, requireAuth, requireAdmin };
