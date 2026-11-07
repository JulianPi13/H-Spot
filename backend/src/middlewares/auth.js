// Carga el usuario de la sesión y protege rutas privadas y de administración.
// IMPORTANTE: el control de permisos se hace aquí, en el servidor, no en el frontend.
const prisma = require('../config/prisma');
const { unauthorized, forbidden } = require('../utils/errors');

async function loadUser(req, res, next) {
  req.user = null;
  const userId = req.session && req.session.userId;
  if (!userId) return next();
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, fullName: true, phone: true, role: true, status: true, emailVerifiedAt: true, createdAt: true },
    });
    if (!user || user.status !== 'ACTIVE') {
      delete req.session.userId;
      return next();
    }
    req.user = user;
    next();
  } catch (err) { next(err); }
}

function requireAuth(req, res, next) {
  if (!req.user) return next(unauthorized());
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) return next(unauthorized());
  if (req.user.role !== 'ADMIN') return next(forbidden());
  next();
}

module.exports = { loadUser, requireAuth, requireAdmin };
