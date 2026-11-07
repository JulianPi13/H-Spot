// Carrito.
// - Invitados: el carrito vive en el navegador y se "cotiza" aquí (POST /api/cart/quote).
// - Usuarios con cuenta: el carrito se guarda en MySQL (tablas Cart y CartItem).
const prisma = require('../config/prisma');
const { priceLines, computeTotals, serializeQuote, mergeItems } = require('../services/pricing.service');
const { notFound, badRequest } = require('../utils/errors');

async function quote(req, res) {
  const { items, shippingMethodId, promoCode } = req.valid.body;
  const priced = await priceLines(items);
  const totals = await computeTotals({ subtotal: priced.subtotal, shippingMethodId, promoCode });
  res.json(serializeQuote(priced, totals));
}

async function getOrCreateCart(userId) {
  return prisma.cart.upsert({ where: { userId }, update: {}, create: { userId } });
}

async function serverCartResponse(userId) {
  const cart = await prisma.cart.findUnique({ where: { userId }, include: { items: { orderBy: { createdAt: 'asc' } } } });
  const items = cart ? cart.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })) : [];
  const priced = await priceLines(items);
  const totals = await computeTotals({ subtotal: priced.subtotal });
  return serializeQuote(priced, totals);
}

async function getCart(req, res) {
  res.json(await serverCartResponse(req.user.id));
}

// Fija la cantidad de una variante (0 = quitar)
async function setItem(req, res) {
  const variantId = Number(req.params.variantId);
  const quantity = Number(req.body.quantity);
  if (!Number.isInteger(variantId) || variantId <= 0) throw badRequest('Producto inválido.');
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 99) throw badRequest('Cantidad inválida.');
  const cart = await getOrCreateCart(req.user.id);
  if (quantity === 0) {
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id, variantId } });
  } else {
    const variant = await prisma.productVariant.findFirst({ where: { id: variantId, active: true, product: { active: true } } });
    if (!variant) throw notFound('Producto no disponible.');
    if (variant.stock <= 0) throw badRequest('Esta talla está agotada.');
    const q = Math.min(quantity, variant.stock);
    await prisma.cartItem.upsert({
      where: { cartId_variantId: { cartId: cart.id, variantId } },
      update: { quantity: q },
      create: { cartId: cart.id, variantId, quantity: q },
    });
  }
  res.json(await serverCartResponse(req.user.id));
}

async function clear(req, res) {
  const cart = await prisma.cart.findUnique({ where: { userId: req.user.id } });
  if (cart) await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  res.json(await serverCartResponse(req.user.id));
}

// Combina el carrito de invitado con el de la cuenta al iniciar sesión.
// Regla: si la misma prenda está en los dos, se toma la MAYOR cantidad (no se suman),
// para evitar duplicados inesperados. Siempre limitado al stock disponible.
async function merge(req, res) {
  const guestItems = mergeItems(req.valid.body.items);
  const cart = await getOrCreateCart(req.user.id);
  const current = await prisma.cartItem.findMany({ where: { cartId: cart.id } });
  const byVariant = new Map(current.map((c) => [c.variantId, c.quantity]));
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: guestItems.map((g) => g.variantId) }, active: true, product: { active: true } },
    select: { id: true, stock: true },
  });
  const stockById = new Map(variants.map((v) => [v.id, v.stock]));
  for (const g of guestItems) {
    const stock = stockById.get(g.variantId);
    if (!stock) continue;
    const q = Math.min(Math.max(g.quantity, byVariant.get(g.variantId) || 0), stock);
    await prisma.cartItem.upsert({
      where: { cartId_variantId: { cartId: cart.id, variantId: g.variantId } },
      update: { quantity: q }, create: { cartId: cart.id, variantId: g.variantId, quantity: q },
    });
  }
  res.json(await serverCartResponse(req.user.id));
}

module.exports = { quote, getCart, setItem, clear, merge };
