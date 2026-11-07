// Indicadores del panel, calculados con datos reales de la base de datos.
// Diferencia clave:
//  - "Pedidos web": todo lo que se creó en la tienda (aunque no esté confirmado).
//  - "Ingresos confirmados": pedidos que el negocio confirmó (y no se cancelaron).
//  - "Ingresos pagados": pedidos marcados como PAGADO por el administrador.
const prisma = require('../../config/prisma');
const { toNumber } = require('../../utils/money');
const { STATUS_LABELS, CONFIRMED_STATES } = require('../../services/order.service');
const { getSetting } = require('../../services/settings.service');
const { parseDate } = require('./orders.controller');

// Inicio del día/mes en hora de Colombia
function bogotaStart(unit) {
  const now = new Date(Date.now() - 5 * 3600 * 1000); // hora local "falsa" en UTC
  const y = now.getUTCFullYear(); const m = now.getUTCMonth(); const d = now.getUTCDate();
  const start = unit === 'month' ? Date.UTC(y, m, 1) : Date.UTC(y, m, d);
  return new Date(start + 5 * 3600 * 1000);
}

async function sumOrders(where) {
  const r = await prisma.order.aggregate({ where, _sum: { total: true }, _count: true });
  return { count: r._count, total: toNumber(r._sum.total) || 0 };
}

async function stats(req, res) {
  const from = parseDate(req.query.desde) || new Date(Date.now() - 30 * 86400000);
  const to = parseDate(req.query.hasta, true) || new Date();
  const range = { gte: from, lte: to };
  const today = { gte: bogotaStart('day') };
  const month = { gte: bogotaStart('month') };
  const notCancelled = { status: { not: 'CANCELADO' } };
  const confirmed = { status: { in: CONFIRMED_STATES } };
  const paid = { paymentStatus: 'PAGADO', status: { not: 'CANCELADO' } };
  const lowStock = (await getSetting('checkout')).lowStockThreshold;

  const [
    webToday, webMonth, confToday, confMonth, paidMonth,
    confRange, paidRange, byStatus, activeProducts, lowStockVariants, soldOut, latest, topItems, rangeOrders,
  ] = await Promise.all([
    sumOrders({ ...notCancelled, createdAt: today }),
    sumOrders({ ...notCancelled, createdAt: month }),
    sumOrders({ ...confirmed, confirmedAt: today }),
    sumOrders({ ...confirmed, confirmedAt: month }),
    sumOrders({ ...paid, paidAt: month }),
    sumOrders({ ...confirmed, createdAt: range }),
    sumOrders({ ...paid, createdAt: range }),
    prisma.order.groupBy({ by: ['status'], where: { createdAt: range }, _count: true }),
    prisma.product.count({ where: { active: true } }),
    prisma.productVariant.findMany({
      where: { active: true, stock: { gt: 0, lte: lowStock }, product: { active: true } },
      select: { id: true, sku: true, size: true, color: true, stock: true, product: { select: { id: true, name: true } } },
      orderBy: { stock: 'asc' }, take: 20,
    }),
    prisma.product.count({ where: { active: true, variants: { none: { stock: { gt: 0 }, active: true } } } }),
    prisma.order.findMany({ orderBy: { createdAt: 'desc' }, take: 8, select: { id: true, orderNumber: true, customerName: true, total: true, status: true, createdAt: true } }),
    prisma.orderItem.groupBy({
      by: ['productId', 'productName'],
      where: { order: { ...confirmed, createdAt: range } },
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { quantity: 'desc' } }, take: 8,
    }),
    prisma.order.findMany({ where: { createdAt: range }, select: { createdAt: true, total: true, status: true } }),
  ]);

  // Serie diaria para la gráfica (hora Colombia)
  const series = new Map();
  for (let t = new Date(from); t <= to; t = new Date(t.getTime() + 86400000)) {
    series.set(new Date(t.getTime() - 5 * 3600 * 1000).toISOString().slice(0, 10), { web: 0, confirmed: 0 });
  }
  for (const o of rangeOrders) {
    const key = new Date(o.createdAt.getTime() - 5 * 3600 * 1000).toISOString().slice(0, 10);
    const row = series.get(key) || { web: 0, confirmed: 0 };
    if (o.status !== 'CANCELADO') row.web += toNumber(o.total);
    if (CONFIRMED_STATES.includes(o.status)) row.confirmed += toNumber(o.total);
    series.set(key, row);
  }

  res.json({
    range: { from, to },
    webOrders: { today: webToday, month: webMonth },
    confirmedRevenue: { today: confToday, month: confMonth, range: confRange },
    paidRevenue: { month: paidMonth, range: paidRange },
    ordersByStatus: Object.keys(STATUS_LABELS).map((s) => ({
      status: s, label: STATUS_LABELS[s], count: (byStatus.find((b) => b.status === s) || { _count: 0 })._count,
    })),
    products: { active: activeProducts, soldOut, lowStockThreshold: lowStock, lowStock: lowStockVariants },
    latestOrders: latest.map((o) => ({ ...o, total: toNumber(o.total), statusLabel: STATUS_LABELS[o.status] })),
    topProducts: topItems.map((t) => ({ productId: t.productId, name: t.productName, units: t._sum.quantity, revenue: toNumber(t._sum.lineTotal) })),
    series: [...series].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v })),
  });
}

module.exports = { stats };
