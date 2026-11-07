// Cálculo de precios OFICIAL. El navegador solo envía qué variantes y cuántas;
// los precios, descuentos y envíos siempre salen de la base de datos.
const prisma = require('../config/prisma');
const { D, toNumber } = require('../utils/money');
const { getSetting } = require('./settings.service');
const { badRequest } = require('../utils/errors');

// Junta líneas repetidas de la misma variante (evita duplicados)
function mergeItems(items) {
  const map = new Map();
  for (const it of items) {
    const id = Number(it.variantId);
    const q = Number(it.quantity);
    if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(q) || q <= 0) continue;
    map.set(id, (map.get(id) || 0) + q);
  }
  return [...map].map(([variantId, quantity]) => ({ variantId, quantity }));
}

// Usa la foto del color elegido; si no hay, la primera del producto
function pickImage(images, color) {
  const img = images.find((i) => i.color === color) || images[0];
  return img ? { url: img.url, alt: img.alt } : null;
}

const variantSelect = {
  id: true, sku: true, size: true, color: true, colorHex: true, stock: true, active: true,
  product: {
    select: {
      id: true, name: true, slug: true, price: true, compareAtPrice: true, active: true,
      images: { orderBy: { sortOrder: 'asc' }, select: { url: true, alt: true, color: true } },
    },
  },
};

// Revisa el carrito contra la base de datos y devuelve líneas con precios reales.
// db puede ser prisma o una transacción.
async function priceLines(items, db = prisma) {
  const merged = mergeItems(items);
  const variants = await db.productVariant.findMany({
    where: { id: { in: merged.map((m) => m.variantId) } },
    select: variantSelect,
  });
  const byId = new Map(variants.map((v) => [v.id, v]));
  const lines = [];
  const issues = [];
  let subtotal = D(0);

  for (const m of merged) {
    const v = byId.get(m.variantId);
    if (!v || !v.active || !v.product.active) {
      issues.push({ variantId: m.variantId, type: 'NO_DISPONIBLE', message: 'Un producto de tu carrito ya no está disponible.' });
      continue;
    }
    let quantity = m.quantity;
    if (v.stock <= 0) {
      issues.push({ variantId: v.id, type: 'AGOTADO', message: `${v.product.name} (${v.size} / ${v.color}) está agotado.` });
      quantity = 0;
    } else if (quantity > v.stock) {
      issues.push({ variantId: v.id, type: 'STOCK_INSUFICIENTE', message: `Solo quedan ${v.stock} unidades de ${v.product.name} (${v.size} / ${v.color}).` });
      quantity = v.stock;
    }
    const unitPrice = D(v.product.price);
    const lineTotal = unitPrice.mul(quantity);
    subtotal = subtotal.add(lineTotal);
    lines.push({
      variantId: v.id, productId: v.product.id, sku: v.sku,
      name: v.product.name, slug: v.product.slug,
      size: v.size, color: v.color, colorHex: v.colorHex,
      image: pickImage(v.product.images, v.color),
      unitPrice, quantity, requestedQuantity: m.quantity, lineTotal, stock: v.stock,
    });
  }
  return { lines, issues, subtotal };
}

// Busca y valida un código promocional; devuelve el descuento calculado
async function evaluatePromotion(code, subtotal, db = prisma) {
  if (!code) return { promotion: null, discount: D(0) };
  const promo = await db.promotion.findUnique({ where: { code: code.trim().toUpperCase() } });
  const now = new Date();
  const invalid = (msg) => { throw badRequest(msg, { promoCode: msg }); };
  if (!promo || !promo.active) invalid('El código promocional no es válido.');
  if (promo.startsAt && promo.startsAt > now) invalid('El código promocional aún no está vigente.');
  if (promo.endsAt && promo.endsAt < now) invalid('El código promocional ya venció.');
  if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) invalid('El código promocional ya alcanzó su límite de usos.');
  if (promo.minSubtotal && subtotal.lt(promo.minSubtotal)) {
    invalid(`Este código requiere una compra mínima de $${toNumber(promo.minSubtotal).toLocaleString('es-CO')}.`);
  }
  let discount = promo.type === 'PORCENTAJE'
    ? subtotal.mul(promo.value).div(100).toDecimalPlaces(0)
    : D(promo.value);
  if (discount.gt(subtotal)) discount = subtotal;
  return { promotion: promo, discount };
}

// Calcula envío y total. Si no hay método de envío elegido/definido, el envío queda "por confirmar".
async function computeTotals({ subtotal, shippingMethodId, promoCode }, db = prisma) {
  const checkout = await getSetting('checkout');
  const { promotion, discount } = await evaluatePromotion(promoCode, subtotal, db);
  const methods = await db.shippingMethod.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } });

  let shippingMethod = null;
  if (shippingMethodId) {
    shippingMethod = methods.find((m) => m.id === Number(shippingMethodId)) || null;
    if (!shippingMethod) throw badRequest('El método de entrega no es válido.', { shippingMethodId: 'Elige un método de entrega válido.' });
  } else if (methods.length === 1) {
    shippingMethod = methods[0];
  }

  let shippingCost = D(0);
  let shippingDefined = false;
  let freeShipping = false;
  if (shippingMethod) {
    shippingDefined = true;
    shippingCost = D(shippingMethod.price);
    const threshold = checkout.freeShippingThreshold;
    if (threshold !== null && threshold !== undefined && subtotal.sub(discount).gte(threshold)) {
      shippingCost = D(0);
      freeShipping = true;
    }
  }
  const total = subtotal.sub(discount).add(shippingCost);
  return { discount, promotion, shippingMethod, shippingCost, shippingDefined, freeShipping, total, methods };
}

// Formato listo para el frontend (números enteros en COP)
function serializeQuote(priced, totals) {
  return {
    lines: priced.lines.map((l) => ({
      ...l, unitPrice: toNumber(l.unitPrice), lineTotal: toNumber(l.lineTotal),
    })),
    issues: priced.issues,
    subtotal: toNumber(priced.subtotal),
    discount: toNumber(totals.discount),
    promoCode: totals.promotion ? totals.promotion.code : null,
    shippingCost: totals.shippingDefined ? toNumber(totals.shippingCost) : null,
    shippingDefined: totals.shippingDefined,
    freeShipping: totals.freeShipping,
    shippingMethod: totals.shippingMethod ? { id: totals.shippingMethod.id, name: totals.shippingMethod.name } : null,
    shippingMethods: totals.methods.map((m) => ({ id: m.id, name: m.name, description: m.description, price: toNumber(m.price) })),
    total: toNumber(totals.total),
  };
}

module.exports = { mergeItems, priceLines, evaluatePromotion, computeTotals, serializeQuote };
