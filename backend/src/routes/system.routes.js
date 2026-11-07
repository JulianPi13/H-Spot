// Rutas de sistema:
//  - /api/cron/release-expired: la llama Vercel Cron (ver vercel.json) para cancelar
//    pedidos con reserva vencida y limpiar sesiones viejas.
//  - /api/setup/*: crea el PRIMER administrador sin usar la consola (para quien publica en
//    Vercel). Solo funciona si existe la variable SETUP_TOKEN y todavía no hay administradores.
const express = require('express');
const argon2 = require('argon2');
const prisma = require('../config/prisma');
const env = require('../config/env');
const { asyncHandler: h, forbidden, notFound, conflict } = require('../utils/errors');
const { safeEqual } = require('../utils/tokens');
const { validate } = require('../middlewares/validate');
const { sensitiveLimiter } = require('../middlewares/rateLimits');
const { releaseExpiredOrders } = require('../services/order.service');
const { purgeExpiredSessions } = require('../middlewares/session');
const { HASH_OPTIONS } = require('../controllers/auth.controller');
const { z, email, personName, password } = require('../validators/common');

const r = express.Router();

r.get('/cron/release-expired', h(async (req, res) => {
  const auth = req.get('authorization') || '';
  if (!env.CRON_SECRET || !safeEqual(auth, `Bearer ${env.CRON_SECRET}`)) throw forbidden('No autorizado.');
  const released = await releaseExpiredOrders();
  await purgeExpiredSessions();
  res.json({ ok: true, released });
}));

const setupEnabled = async () => env.SETUP_TOKEN.length >= 24 && (await prisma.user.count({ where: { role: 'ADMIN' } })) === 0;

r.get('/setup/status', h(async (req, res) => {
  res.json({ enabled: await setupEnabled(), tokenConfigured: env.SETUP_TOKEN.length >= 24 });
}));

const setupSchema = z.object({
  setupToken: z.string().min(1, 'Escribe la clave de configuración.').max(200),
  fullName: personName, email, password,
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, { path: ['confirmPassword'], message: 'Las contraseñas no coinciden.' });

r.post('/setup/admin', sensitiveLimiter, validate(setupSchema), h(async (req, res) => {
  if (!(await setupEnabled())) throw notFound('La configuración inicial no está disponible.');
  const b = req.valid.body;
  if (!safeEqual(b.setupToken, env.SETUP_TOKEN)) throw forbidden('La clave de configuración no es correcta.');
  const exists = await prisma.user.findUnique({ where: { email: b.email } });
  if (exists) throw conflict('Ya existe una cuenta con ese correo.', { email: 'Ya existe una cuenta con ese correo.' });
  const user = await prisma.user.create({
    data: { fullName: b.fullName, email: b.email, role: 'ADMIN', passwordHash: await argon2.hash(b.password, HASH_OPTIONS), dataPolicyAcceptedAt: new Date(), emailVerifiedAt: new Date() },
  });
  await prisma.auditLog.create({ data: { userId: user.id, action: 'ADMIN_CREADO_SETUP', entity: 'User', entityId: String(user.id), ip: String(req.ip || '').slice(0, 64) } });
  res.status(201).json({ message: 'Administrador creado. Ya puedes iniciar sesión.' });
}));

module.exports = r;
