// Clientes registrados. Los datos personales solo se muestran a administradores.
const prisma = require('../../config/prisma');
const { toNumber } = require('../../utils/money');
const { notFound, badRequest } = require('../../utils/errors');
const { audit } = require('../../services/audit.service');
const { destroyUserSessions } = require('../../middlewares/session');
const { STATUS_LABELS } = require('../../services/order.service');

async function list(req, res) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = 25;
  const q = String(req.query.q || '').trim().slice(0, 80);
  const where = { role: 'CUSTOMER' };
  if (q) where.OR = [{ fullName: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }, { phone: { contains: q, mode: 'insensitive' } }];
  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit,
      select: { id: true, fullName: true, email: true, phone: true, status: true, createdAt: true, lastLoginAt: true, _count: { select: { orders: true } } },
    }),
  ]);
  res.json({ items: rows, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
}

async function get(req, res) {
  const user = await prisma.user.findUnique({
    where: { id: Number(req.params.id) || 0 },
    select: {
      id: true, fullName: true, email: true, phone: true, role: true, status: true, createdAt: true, lastLoginAt: true, emailVerifiedAt: true,
      orders: { orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, orderNumber: true, total: true, status: true, createdAt: true } },
    },
  });
  if (!user) throw notFound('Cliente no encontrado.');
  await audit(req, 'CLIENTE_CONSULTADO', 'User', user.id);
  res.json({ customer: { ...user, orders: user.orders.map((o) => ({ ...o, total: toNumber(o.total), statusLabel: STATUS_LABELS[o.status] })) } });
}

async function setStatus(req, res) {
  const uid = Number(req.params.id) || 0;
  if (uid === req.user.id) throw badRequest('No puedes cambiar el estado de tu propia cuenta.');
  const target = await prisma.user.findUnique({ where: { id: uid } });
  if (!target) throw notFound('Usuario no encontrado.');
  const user = await prisma.user.update({ where: { id: uid }, data: { status: req.valid.body.status } });
  if (user.status === 'SUSPENDED') await destroyUserSessions(uid);
  await audit(req, 'CUENTA_ESTADO', 'User', uid, { status: user.status });
  res.json({ ok: true, status: user.status });
}

module.exports = { list, get, setStatus };
