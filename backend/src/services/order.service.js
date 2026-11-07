// Lógica de pedidos: creación con reserva de inventario, cambios de estado y liberación.
//
// ESTRATEGIA DE INVENTARIO (explicada simple):
// 1. Al crear el pedido, el stock se descuenta en una transacción con la condición
//    "solo si quedan suficientes unidades". La base de datos bloquea la fila mientras tanto, así que
//    si dos personas compran la última unidad al mismo tiempo, solo una lo logra.
// 2. El pedido queda "Pendiente de confirmación" con una reserva que vence
//    (ORDER_RESERVATION_HOURS). Si nadie lo confirma a tiempo, se cancela y el stock vuelve.
// 3. Si el administrador cancela el pedido, el stock se devuelve automáticamente.
// Todo movimiento queda en la tabla InventoryMovement.
const prisma = require('../config/prisma');
const env = require('../config/env');
const { toNumber } = require('../utils/money');
const { randomToken, sha256, orderNumber } = require('../utils/tokens');
const { badRequest, conflict, notFound } = require('../utils/errors');
const { priceLines, computeTotals } = require('./pricing.service');
const { getSetting } = require('./settings.service');
const { buildOrderMessage, whatsappUrl } = require('../utils/whatsapp');

const STATUS_LABELS = {
  PENDIENTE_CONFIRMACION: 'Pendiente de confirmación',
  CONFIRMADO: 'Confirmado',
  EN_PREPARACION: 'En preparación',
  ENVIADO: 'Enviado',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
};

// Cambios de estado permitidos
const TRANSITIONS = {
  PENDIENTE_CONFIRMACION: ['CONFIRMADO', 'CANCELADO'],
  CONFIRMADO: ['EN_PREPARACION', 'ENVIADO', 'CANCELADO'],
  EN_PREPARACION: ['ENVIADO', 'CANCELADO'],
  ENVIADO: ['ENTREGADO'],
  ENTREGADO: [],
  CANCELADO: [],
};

const CONFIRMED_STATES = ['CONFIRMADO', 'EN_PREPARACION', 'ENVIADO', 'ENTREGADO'];

async function createOrder({ input, user, idempotencyKey }) {
  // Si este mismo intento ya se procesó (doble clic, reintento), devolvemos el mismo pedido
  const existing = await prisma.order.findUnique({ where: { idempotencyKey } });
  if (existing) return { order: existing, duplicate: true, accessToken: null };

  const checkout = await getSetting('checkout');
  const enabledPayments = checkout.paymentMethods.filter((p) => p.enabled);
  let paymentMethodName = null;
  if (enabledPayments.length) {
    const pm = enabledPayments.find((p) => p.id === input.paymentMethod);
    if (!pm) throw badRequest('Elige un método de pago disponible.', { paymentMethod: 'Elige un método de pago disponible.' });
    paymentMethodName = pm.name;
  }

  const accessToken = randomToken(24);
  const reservationExpiresAt = new Date(Date.now() + env.ORDER_RESERVATION_HOURS * 3600 * 1000);

  try {
    const order = await prisma.$transaction(async (tx) => {
      const priced = await priceLines(input.items, tx);
      if (priced.issues.length) {
        throw conflict('Algunos productos cambiaron de disponibilidad. Revisa tu carrito.', { items: priced.issues.map((i) => i.message).join(' ') });
      }
      if (!priced.lines.length) throw badRequest('Tu carrito está vacío.');

      // Reserva atómica de inventario: solo descuenta si hay suficientes unidades
      for (const line of priced.lines) {
        const res = await tx.productVariant.updateMany({
          where: { id: line.variantId, active: true, stock: { gte: line.quantity } },
          data: { stock: { decrement: line.quantity } },
        });
        if (res.count === 0) {
          throw conflict(`Ya no hay suficientes unidades de ${line.name} (${line.size} / ${line.color}).`);
        }
      }

      const totals = await computeTotals({ subtotal: priced.subtotal, shippingMethodId: input.shippingMethodId, promoCode: input.promoCode }, tx);
      if (totals.methods.length > 1 && !totals.shippingMethod) {
        throw badRequest('Elige un método de entrega.', { shippingMethodId: 'Elige un método de entrega.' });
      }

      // Uso del código promocional (con límite de usos protegido)
      if (totals.promotion) {
        const where = { id: totals.promotion.id };
        if (totals.promotion.maxUses !== null) where.usedCount = { lt: totals.promotion.maxUses };
        const r = await tx.promotion.updateMany({ where, data: { usedCount: { increment: 1 } } });
        if (r.count === 0) throw badRequest('El código promocional ya alcanzó su límite de usos.', { promoCode: 'Código agotado.' });
      }

      const created = await tx.order.create({
        data: {
          orderNumber: orderNumber(),
          userId: user ? user.id : null,
          customerName: input.fullName,
          email: input.email,
          phone: input.phone,
          department: input.department,
          city: input.city,
          address: input.address,
          neighborhood: input.neighborhood || null,
          deliveryNotes: input.deliveryNotes || null,
          shareAddressWhatsapp: Boolean(input.shareAddressWhatsapp),
          shippingMethodName: totals.shippingMethod ? totals.shippingMethod.name : null,
          paymentMethod: paymentMethodName,
          promotionCode: totals.promotion ? totals.promotion.code : null,
          subtotal: priced.subtotal,
          discount: totals.discount,
          shippingCost: totals.shippingCost,
          shippingDefined: totals.shippingDefined,
          total: totals.total,
          idempotencyKey,
          accessTokenHash: sha256(accessToken),
          dataPolicyAcceptedAt: new Date(),
          reservationExpiresAt,
          items: {
            create: priced.lines.map((l) => ({
              productId: l.productId, variantId: l.variantId,
              productName: l.name, sku: l.sku, size: l.size, color: l.color,
              imageUrl: l.image ? l.image.url : null,
              unitPrice: l.unitPrice, quantity: l.quantity, lineTotal: l.lineTotal,
            })),
          },
          history: { create: { toStatus: 'PENDIENTE_CONFIRMACION', note: 'Pedido creado en la tienda web', changedById: user ? user.id : null } },
        },
      });

      for (const line of priced.lines) {
        const v = await tx.productVariant.findUnique({ where: { id: line.variantId }, select: { stock: true } });
        await tx.inventoryMovement.create({
          data: { variantId: line.variantId, type: 'RESERVA_PEDIDO', quantity: -line.quantity, stockAfter: v.stock, orderId: created.id, userId: user ? user.id : null, reason: `Pedido ${created.orderNumber}` },
        });
      }

      // Si el cliente tiene cuenta, vaciamos su carrito guardado
      if (user) {
        const cart = await tx.cart.findUnique({ where: { userId: user.id } });
        if (cart) await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      }
      return created;
    }, { timeout: 15000 });

    return { order, duplicate: false, accessToken };
  } catch (err) {
    // Dos solicitudes simultáneas con la misma clave: devolvemos la que ganó
    if (err.code === 'P2002' && String(err.meta?.target || '').includes('idempotency')) {
      const again = await prisma.order.findUnique({ where: { idempotencyKey } });
      if (again) return { order: again, duplicate: true, accessToken: null };
    }
    throw err;
  }
}

// Datos que se pueden mostrar al cliente sobre su pedido
async function publicOrderView(orderId) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) throw notFound('Pedido no encontrado.');
  const wa = await getSetting('whatsapp');
  const message = buildOrderMessage(order, order.items);
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    statusLabel: STATUS_LABELS[order.status],
    paymentStatus: order.paymentStatus,
    createdAt: order.createdAt,
    customerName: order.customerName,
    email: order.email,
    phone: order.phone,
    department: order.department,
    city: order.city,
    address: order.address,
    neighborhood: order.neighborhood,
    deliveryNotes: order.deliveryNotes,
    shippingMethodName: order.shippingMethodName,
    paymentMethod: order.paymentMethod,
    promotionCode: order.promotionCode,
    subtotal: toNumber(order.subtotal),
    discount: toNumber(order.discount),
    shippingCost: order.shippingDefined ? toNumber(order.shippingCost) : null,
    shippingDefined: order.shippingDefined,
    total: toNumber(order.total),
    reservationExpiresAt: order.status === 'PENDIENTE_CONFIRMACION' ? order.reservationExpiresAt : null,
    items: order.items.map((i) => ({
      productName: i.productName, size: i.size, color: i.color, sku: i.sku, imageUrl: i.imageUrl,
      unitPrice: toNumber(i.unitPrice), quantity: i.quantity, lineTotal: toNumber(i.lineTotal),
    })),
    whatsapp: { message, url: whatsappUrl(wa.number, message) },
  };
}

// Devuelve las unidades al inventario (cuando se cancela un pedido)
async function releaseStock(tx, order, userId, reason) {
  if (order.stockReleased) return;
  const items = await tx.orderItem.findMany({ where: { orderId: order.id } });
  for (const it of items) {
    if (!it.variantId) continue;
    const v = await tx.productVariant.update({ where: { id: it.variantId }, data: { stock: { increment: it.quantity } }, select: { stock: true } });
    await tx.inventoryMovement.create({
      data: { variantId: it.variantId, type: 'LIBERACION_PEDIDO', quantity: it.quantity, stockAfter: v.stock, orderId: order.id, userId: userId || null, reason },
    });
  }
  await tx.order.update({ where: { id: order.id }, data: { stockReleased: true } });
}

async function changeStatus(orderId, toStatus, { userId = null, note = null } = {}) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) throw notFound('Pedido no encontrado.');
    if (order.status === toStatus) return order;
    if (!TRANSITIONS[order.status].includes(toStatus)) {
      throw badRequest(`No se puede pasar de "${STATUS_LABELS[order.status]}" a "${STATUS_LABELS[toStatus]}".`);
    }

    const data = { status: toStatus };
    // Solo actualiza si nadie cambió el estado mientras tanto (evita dobles cancelaciones)
    const res = await tx.order.updateMany({ where: { id: orderId, status: order.status }, data: { status: toStatus } });
    if (res.count === 0) throw conflict('El pedido cambió mientras tanto. Recarga la página.');
    const wasConfirmed = CONFIRMED_STATES.includes(order.status);

    if (toStatus === 'CONFIRMADO') {
      data.confirmedAt = new Date();
      data.reservationExpiresAt = null; // ya no vence: el negocio lo confirmó
      for (const it of order.items) {
        if (it.productId) await tx.product.update({ where: { id: it.productId }, data: { salesCount: { increment: it.quantity } } });
      }
    }

    if (toStatus === 'CANCELADO') {
      data.cancelledAt = new Date();
      data.reservationExpiresAt = null;
      await releaseStock(tx, order, userId, `Cancelación del pedido ${order.orderNumber}`);
      if (wasConfirmed) {
        for (const it of order.items) {
          if (it.productId) await tx.product.updateMany({ where: { id: it.productId, salesCount: { gte: it.quantity } }, data: { salesCount: { decrement: it.quantity } } });
        }
      }
      if (order.promotionCode) {
        await tx.promotion.updateMany({ where: { code: order.promotionCode, usedCount: { gt: 0 } }, data: { usedCount: { decrement: 1 } } });
      }
    }

    const updated = await tx.order.update({ where: { id: orderId }, data });
    await tx.orderStatusHistory.create({ data: { orderId, fromStatus: order.status, toStatus, note, changedById: userId } });
    return updated;
  });
}

async function setPaymentStatus(orderId, paymentStatus, { userId = null } = {}) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw notFound('Pedido no encontrado.');
  if (order.status === 'CANCELADO' && paymentStatus === 'PAGADO') {
    throw badRequest('No se puede marcar como pagado un pedido cancelado.');
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: orderId },
      data: { paymentStatus, paidAt: paymentStatus === 'PAGADO' ? new Date() : order.paidAt },
    });
    await tx.orderNote.create({ data: { orderId, authorId: userId, body: `Estado de pago cambiado a ${paymentStatus}.` } });
    return updated;
  });
}

// Cancela pedidos pendientes cuya reserva venció y devuelve el inventario
async function releaseExpiredOrders() {
  const expired = await prisma.order.findMany({
    where: { status: 'PENDIENTE_CONFIRMACION', reservationExpiresAt: { lt: new Date() } },
    select: { id: true },
    take: 100,
  });
  let count = 0;
  for (const o of expired) {
    try {
      await changeStatus(o.id, 'CANCELADO', { note: 'Cancelado automáticamente: la reserva venció sin confirmación.' });
      count++;
    } catch (err) {
      console.error('[PEDIDOS] No se pudo liberar el pedido', o.id, err.message);
    }
  }
  return count;
}

// Versión "perezosa" para Vercel (no hay procesos de fondo): se ejecuta como
// máximo cada 5 minutos por instancia cuando alguien usa la tienda o el panel.
let lastRelease = 0;
async function maybeReleaseExpired() {
  if (Date.now() - lastRelease < 5 * 60 * 1000) return;
  lastRelease = Date.now();
  try { await releaseExpiredOrders(); } catch (err) { console.error('[PEDIDOS]', err.message); }
}

module.exports = {
  maybeReleaseExpired,
  createOrder, publicOrderView, changeStatus, setPaymentStatus, releaseExpiredOrders,
  STATUS_LABELS, TRANSITIONS, CONFIRMED_STATES,
};

