// Checkout: crea el pedido y devuelve el enlace de WhatsApp generado por el servidor.
const prisma = require('../config/prisma');
const { createOrder, publicOrderView, maybeReleaseExpired } = require('../services/order.service');
const { sha256, safeEqual } = require('../utils/tokens');
const { notFound } = require('../utils/errors');

async function checkout(req, res) {
  const input = req.valid.body;
  await maybeReleaseExpired(); // devuelve al stock lo de pedidos vencidos antes de vender
  const { order, duplicate, accessToken } = await createOrder({ input, user: req.user, idempotencyKey: input.idempotencyKey });

  // Guardamos en la sesión qué pedidos puede ver este navegador (útil para invitados)
  req.session.orderAccess = Array.from(new Set([...(req.session.orderAccess || []), order.id])).slice(-20);

  const view = await publicOrderView(order.id);
  res.status(duplicate ? 200 : 201).json({ order: view, accessToken, duplicate });
}

// Ver un pedido: dueño con sesión, mismo navegador que lo creó, o enlace con token
async function view(req, res) {
  const order = await prisma.order.findUnique({ where: { orderNumber: String(req.params.orderNumber).slice(0, 20) } });
  if (!order) throw notFound('Pedido no encontrado.');
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  const allowed =
    (req.user && order.userId === req.user.id) ||
    (req.session.orderAccess || []).includes(order.id) ||
    (token && safeEqual(sha256(token), order.accessTokenHash));
  if (!allowed) throw notFound('Pedido no encontrado.'); // no revelamos que existe
  res.json({ order: await publicOrderView(order.id) });
}

module.exports = { checkout, view };
