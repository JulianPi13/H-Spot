// Administración de pedidos: listado, detalle, estados, pagos, notas y exportación CSV.
const prisma = require('../../config/prisma');
const { toNumber } = require('../../utils/money');
const { notFound } = require('../../utils/errors');
const { changeStatus, setPaymentStatus, maybeReleaseExpired, STATUS_LABELS, TRANSITIONS } = require('../../services/order.service');
const { audit } = require('../../services/audit.service');
const { whatsappUrl } = require('../../utils/whatsapp');

function parseDate(v, endOfDay) {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(String(v))) return undefined;
  // Fechas en hora de Colombia (UTC-5)
  return new Date(`${v}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}-05:00`);
}

function buildWhere(q) {
  const where = {};
  if (q.estado && STATUS_LABELS[q.estado]) where.status = q.estado;
  if (q.pago && ['PENDIENTE', 'PAGADO', 'REEMBOLSADO'].includes(q.pago)) where.paymentStatus = q.pago;
  const from = parseDate(q.desde); const to = parseDate(q.hasta, true);
  if (from || to) where.createdAt = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
  const s = String(q.q || '').trim().slice(0, 80);
  if (s) where.OR = [{ orderNumber: { contains: s } }, { customerName: { contains: s } }, { email: { contains: s } }, { phone: { contains: s.replace(/\D/g, '') || s } }];
  return where;
}

async function list(req, res) {
  await maybeReleaseExpired();
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = 25;
  const where = buildWhere(req.query);
  const [total, rows] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit,
      select: { id: true, orderNumber: true, createdAt: true, customerName: true, total: true, status: true, paymentStatus: true, paymentMethod: true, city: true, userId: true },
    }),
  ]);
  res.json({
    items: rows.map((o) => ({ ...o, total: toNumber(o.total), statusLabel: STATUS_LABELS[o.status] })),
    total, page, pages: Math.max(1, Math.ceil(total / limit)),
  });
}

async function get(req, res) {
  const order = await prisma.order.findUnique({
    where: { id: Number(req.params.id) || 0 },
    include: {
      items: true,
      user: { select: { id: true, email: true, fullName: true } },
      history: { orderBy: { createdAt: 'asc' }, include: { changedBy: { select: { fullName: true } } } },
      notes: { orderBy: { createdAt: 'desc' }, include: { author: { select: { fullName: true } } } },
    },
  });
  if (!order) throw notFound('Pedido no encontrado.');
  // Consultar datos personales de entrega queda registrado en la auditoría
  await audit(req, 'PEDIDO_CONSULTADO', 'Order', order.id);
  const { accessTokenHash, idempotencyKey, ...safe } = order; // eslint-disable-line no-unused-vars
  res.json({
    order: {
      ...safe,
      subtotal: toNumber(order.subtotal), discount: toNumber(order.discount),
      shippingCost: toNumber(order.shippingCost), total: toNumber(order.total),
      items: order.items.map((i) => ({ ...i, unitPrice: toNumber(i.unitPrice), lineTotal: toNumber(i.lineTotal) })),
      statusLabel: STATUS_LABELS[order.status],
      allowedTransitions: TRANSITIONS[order.status].map((s) => ({ value: s, label: STATUS_LABELS[s] })),
      customerWhatsappUrl: whatsappUrl(`57${order.phone}`, `Hola ${order.customerName.split(' ')[0]}, te escribimos de H-SPOT sobre tu pedido ${order.orderNumber}.`),
    },
  });
}

async function updateStatus(req, res) {
  const orderId = Number(req.params.id) || 0;
  const { status, note } = req.valid.body;
  const updated = await changeStatus(orderId, status, { userId: req.user.id, note });
  await audit(req, 'PEDIDO_ESTADO', 'Order', orderId, { status, note });
  res.json({ order: { id: updated.id, status: updated.status, statusLabel: STATUS_LABELS[updated.status] } });
}

async function updatePayment(req, res) {
  const orderId = Number(req.params.id) || 0;
  const updated = await setPaymentStatus(orderId, req.valid.body.paymentStatus, { userId: req.user.id });
  await audit(req, 'PEDIDO_PAGO', 'Order', orderId, { paymentStatus: updated.paymentStatus });
  res.json({ order: { id: updated.id, paymentStatus: updated.paymentStatus } });
}

async function addNote(req, res) {
  const orderId = Number(req.params.id) || 0;
  const exists = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true } });
  if (!exists) throw notFound('Pedido no encontrado.');
  const note = await prisma.orderNote.create({ data: { orderId, authorId: req.user.id, body: req.valid.body.body }, include: { author: { select: { fullName: true } } } });
  res.status(201).json({ note });
}

// CSV seguro: evita que Excel ejecute fórmulas escritas por un cliente
function csvCell(v) {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

async function exportCsv(req, res) {
  const where = buildWhere(req.query);
  const rows = await prisma.order.findMany({ where, orderBy: { createdAt: 'desc' }, take: 10000, include: { items: true } });
  if (rows.length === 10000) res.setHeader('X-Export-Truncated', 'true');
  const header = ['Pedido', 'Fecha', 'Estado', 'Pago', 'Cliente', 'Correo', 'Telefono', 'Departamento', 'Ciudad', 'Metodo pago', 'Envio', 'Subtotal', 'Descuento', 'Costo envio', 'Total', 'Productos'];
  const lines = [header.map(csvCell).join(',')];
  for (const o of rows) {
    lines.push([
      o.orderNumber, o.createdAt.toISOString(), STATUS_LABELS[o.status], o.paymentStatus, o.customerName, o.email, o.phone,
      o.department, o.city, o.paymentMethod, o.shippingMethodName, toNumber(o.subtotal), toNumber(o.discount),
      o.shippingDefined ? toNumber(o.shippingCost) : '', toNumber(o.total),
      o.items.map((i) => `${i.quantity}x ${i.productName} (${i.size}/${i.color})`).join(' | '),
    ].map(csvCell).join(','));
  }
  await audit(req, 'PEDIDOS_EXPORTADOS', 'Order', null, { count: rows.length });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="pedidos-hspot-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send('﻿' + lines.join('\r\n'));
}

module.exports = { list, get, updateStatus, updatePayment, addNote, exportCsv, csvCell, parseDate };

