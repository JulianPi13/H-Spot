// Área del cliente: perfil, contraseña e historial de pedidos.
const argon2 = require('argon2');
const prisma = require('../config/prisma');
const { badRequest, notFound } = require('../utils/errors');
const { toNumber } = require('../utils/money');
const { HASH_OPTIONS, publicUser } = require('./auth.controller');
const { destroyUserSessions } = require('../middlewares/session');
const { publicOrderView, STATUS_LABELS } = require('../services/order.service');

async function updateProfile(req, res) {
  const { fullName, phone } = req.valid.body;
  const user = await prisma.user.update({ where: { id: req.user.id }, data: { fullName, phone } });
  res.json({ user: publicUser(user) });
}

async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.valid.body;
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  const ok = await argon2.verify(user.passwordHash, currentPassword).catch(() => false);
  if (!ok) throw badRequest('La contraseña actual no es correcta.', { currentPassword: 'La contraseña actual no es correcta.' });
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await argon2.hash(newPassword, HASH_OPTIONS) } });
  await destroyUserSessions(user.id, req.sessionID); // cierra las demás sesiones
  res.json({ message: 'Contraseña actualizada.' });
}

async function listOrders(req, res) {
  const orders = await prisma.order.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { id: true, orderNumber: true, status: true, total: true, createdAt: true, _count: { select: { items: true } } },
  });
  res.json({
    orders: orders.map((o) => ({
      id: o.id, orderNumber: o.orderNumber, status: o.status, statusLabel: STATUS_LABELS[o.status],
      total: toNumber(o.total), createdAt: o.createdAt, itemCount: o._count.items,
    })),
  });
}

async function getOrder(req, res) {
  const order = await prisma.order.findFirst({ where: { orderNumber: req.params.orderNumber, userId: req.user.id }, select: { id: true } });
  if (!order) throw notFound('Pedido no encontrado.');
  res.json({ order: await publicOrderView(order.id) });
}

module.exports = { updateProfile, changePassword, listOrders, getOrder };
