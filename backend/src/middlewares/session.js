// Sesiones con cookie HttpOnly. Los datos de la sesión se guardan en MySQL
// (tabla Session), así que no se pierden al reiniciar el servidor.
const session = require('express-session');
const prisma = require('../config/prisma');
const env = require('../config/env');

class PrismaSessionStore extends session.Store {
  async get(sid, cb) {
    try {
      const row = await prisma.session.findUnique({ where: { id: sid } });
      if (!row || row.expiresAt < new Date()) return cb(null, null);
      cb(null, JSON.parse(row.data));
    } catch (err) { cb(err); }
  }

  async set(sid, sess, cb) {
    try {
      const expiresAt = sess.cookie?.expires ? new Date(sess.cookie.expires) : new Date(Date.now() + 86400000);
      const data = JSON.stringify(sess);
      const userId = sess.userId || null;
      await prisma.session.upsert({ where: { id: sid }, update: { data, expiresAt, userId }, create: { id: sid, data, expiresAt, userId } });
      cb && cb(null);
    } catch (err) { cb && cb(err); }
  }

  async destroy(sid, cb) {
    try {
      await prisma.session.deleteMany({ where: { id: sid } });
      cb && cb(null);
    } catch (err) { cb && cb(err); }
  }

  async touch(sid, sess, cb) {
    try {
      const expiresAt = sess.cookie?.expires ? new Date(sess.cookie.expires) : new Date(Date.now() + 86400000);
      await prisma.session.updateMany({ where: { id: sid }, data: { expiresAt } });
      cb && cb(null);
    } catch (err) { cb && cb(err); }
  }
}

// Cierra todas las sesiones de un usuario (por ejemplo, al cambiar la contraseña)
async function destroyUserSessions(userId, exceptSid) {
  await prisma.session.deleteMany({ where: { userId, ...(exceptSid ? { id: { not: exceptSid } } : {}) } });
}

// Borra sesiones vencidas (se llama periódicamente desde server.js)
async function purgeExpiredSessions() {
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}

const sessionMiddleware = session({
  name: 'hspot.sid',
  secret: env.SESSION_SECRET,
  store: new PrismaSessionStore(),
  resave: false,
  saveUninitialized: false, // no crea sesión hasta que haga falta
  rolling: true,
  proxy: env.isProduction || env.isVercel,
  cookie: {
    httpOnly: true,               // JavaScript del navegador no puede leerla
    secure: env.isProduction || env.isVercel, // solo por HTTPS en producción
    sameSite: 'lax',              // protege contra envíos desde otros sitios
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 días
  },
});

module.exports = { sessionMiddleware, purgeExpiredSessions, destroyUserSessions, PrismaSessionStore };
