// Protección CSRF: el servidor entrega un token (GET /api/csrf) que el frontend
// debe reenviar en la cabecera "X-CSRF-Token" en cada POST/PUT/PATCH/DELETE.
const { randomToken, safeEqual } = require('../utils/tokens');
const { AppError } = require('../utils/errors');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function ensureCsrfToken(req) {
  if (!req.session.csrfToken) req.session.csrfToken = randomToken(24);
  return req.session.csrfToken;
}

function csrfProtection(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const sent = req.get('X-CSRF-Token');
  const expected = req.session && req.session.csrfToken;
  if (!sent || !expected || !safeEqual(sent, expected)) {
    return next(new AppError(403, 'La sesión de seguridad expiró. Recarga la página e inténtalo de nuevo.'));
  }
  next();
}

module.exports = { csrfProtection, ensureCsrfToken };
