// Administración de productos, variantes (talla/color), inventario e imágenes.
const prisma = require('../../config/prisma');
const { slugify } = require('../../utils/slug');
const { toNumber } = require('../../utils/money');
const { notFound, badRequest, conflict } = require('../../utils/errors');
const { saveImage, deleteImage } = require('../../services/storage.service');
const { audit } = require('../../services/audit.service');
const { getSetting } = require('../../services/settings.service');

const id = (v) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw badRequest('Identificador inválido.');
  return n;
};

function serializeProduct(p) {
  return {
    ...p,
    price: toNumber(p.price),
    compareAtPrice: toNumber(p.compareAtPrice),
    totalStock: p.variants ? p.variants.reduce((s, v) => s + v.stock, 0) : undefined,
  };
}

async function uniqueSlug(base, excludeId) {
  let slug = slugify(base) || 'producto';
  let i = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await prisma.product.findFirst({ where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } })) {
    i += 1; slug = `${slugify(base)}-${i}`;
  }
  return slug;
}

async function list(req, res) {
  const q = String(req.query.q || '').trim().slice(0, 80);
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = 20;
  const where = {};
  if (q) where.OR = [{ name: { contains: q } }, { slug: { contains: q } }, { variants: { some: { sku: { contains: q } } } }];
  if (req.query.estado === 'activos') where.active = true;
  if (req.query.estado === 'inactivos') where.active = false;
  if (req.query.categoria) where.categoryId = Number(req.query.categoria) || undefined;

  const lowStock = (await getSetting('checkout')).lowStockThreshold;
  if (req.query.stock === 'agotados') where.variants = { none: { stock: { gt: 0 } } };
  if (req.query.stock === 'bajo') where.variants = { some: { stock: { gt: 0, lte: lowStock } } };

  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where, orderBy: { updatedAt: 'desc' }, skip: (page - 1) * limit, take: limit,
      include: {
        category: { select: { name: true } },
        images: { orderBy: { sortOrder: 'asc' }, take: 1, select: { url: true } },
        variants: { select: { stock: true } },
      },
    }),
  ]);
  res.json({ items: rows.map(serializeProduct), total, page, pages: Math.max(1, Math.ceil(total / limit)), lowStockThreshold: lowStock });
}

async function get(req, res) {
  const p = await prisma.product.findUnique({
    where: { id: id(req.params.id) },
    include: {
      category: true,
      collections: { select: { collection: { select: { id: true, name: true } } } },
      images: { orderBy: { sortOrder: 'asc' } },
      variants: { orderBy: [{ color: 'asc' }, { id: 'asc' }] },
    },
  });
  if (!p) throw notFound('Producto no encontrado.');
  res.json({ product: serializeProduct({ ...p, collections: p.collections.map((c) => c.collection) }) });
}

function productData(body) {
  return {
    name: body.name, description: body.description, materials: body.materials, care: body.care,
    price: body.price, compareAtPrice: body.compareAtPrice, gender: body.gender,
    category: { connect: { id: body.categoryId } },
    active: body.active, featured: body.featured, isNew: body.isNew, isBestSeller: body.isBestSeller,
  };
}

async function create(req, res) {
  const b = req.valid.body;
  const slug = await uniqueSlug(b.slug || b.name);
  const p = await prisma.product.create({
    data: { ...productData(b), slug, collections: { create: b.collectionIds.map((cid) => ({ collection: { connect: { id: cid } } })) } },
  });
  await audit(req, 'PRODUCTO_CREADO', 'Product', p.id, { name: p.name, price: b.price });
  res.status(201).json({ product: serializeProduct(p) });
}

async function update(req, res) {
  const pid = id(req.params.id);
  const b = req.valid.body;
  const before = await prisma.product.findUnique({ where: { id: pid } });
  if (!before) throw notFound('Producto no encontrado.');
  const slug = b.slug ? await uniqueSlug(b.slug, pid) : before.slug;
  const p = await prisma.product.update({
    where: { id: pid },
    data: { ...productData(b), slug, collections: { deleteMany: {}, create: b.collectionIds.map((cid) => ({ collection: { connect: { id: cid } } })) } },
  });
  const changes = {};
  if (toNumber(before.price) !== b.price) changes.price = { from: toNumber(before.price), to: b.price };
  if (before.active !== b.active) changes.active = b.active;
  await audit(req, 'PRODUCTO_EDITADO', 'Product', pid, changes);
  res.json({ product: serializeProduct(p) });
}

// No se borran productos con ventas (para conservar el historial); se desactivan.
async function remove(req, res) {
  const pid = id(req.params.id);
  const sold = await prisma.orderItem.count({ where: { productId: pid } });
  if (sold > 0) {
    await prisma.product.update({ where: { id: pid }, data: { active: false } });
    await audit(req, 'PRODUCTO_DESACTIVADO', 'Product', pid);
    return res.json({ message: 'El producto tiene pedidos asociados: se desactivó en lugar de eliminarse.', deactivated: true });
  }
  const images = await prisma.productImage.findMany({ where: { productId: pid } });
  await prisma.product.delete({ where: { id: pid } });
  for (const img of images) await deleteImage(img.storageKey);
  await audit(req, 'PRODUCTO_ELIMINADO', 'Product', pid);
  res.json({ message: 'Producto eliminado.', deleted: true });
}

// ---------- Variantes ----------
async function addVariant(req, res) {
  const pid = id(req.params.id);
  const b = req.valid.body;
  const product = await prisma.product.findUnique({ where: { id: pid } });
  if (!product) throw notFound('Producto no encontrado.');
  const sku = b.sku || `HS-${pid}-${slugify(b.color).toUpperCase().slice(0, 8)}-${slugify(b.size).toUpperCase()}`;
  try {
    const v = await prisma.$transaction(async (tx) => {
      const created = await tx.productVariant.create({
        data: { productId: pid, sku, size: b.size, color: b.color, colorHex: b.colorHex, stock: b.stock, active: b.active },
      });
      if (b.stock > 0) {
        await tx.inventoryMovement.create({ data: { variantId: created.id, type: 'STOCK_INICIAL', quantity: b.stock, stockAfter: b.stock, userId: req.user.id, reason: 'Stock inicial' } });
      }
      return created;
    });
    await audit(req, 'VARIANTE_CREADA', 'ProductVariant', v.id, { sku, stock: b.stock });
    res.status(201).json({ variant: v });
  } catch (err) {
    if (err.code === 'P2002') throw conflict('Ya existe esa combinación de talla y color, o el SKU está repetido.');
    throw err;
  }
}

async function updateVariant(req, res) {
  const vid = id(req.params.variantId);
  const v = await prisma.productVariant.update({ where: { id: vid }, data: req.valid.body });
  await audit(req, 'VARIANTE_EDITADA', 'ProductVariant', vid, req.valid.body);
  res.json({ variant: v });
}

async function deleteVariant(req, res) {
  const vid = id(req.params.variantId);
  const used = await prisma.orderItem.count({ where: { variantId: vid } });
  if (used) {
    await prisma.productVariant.update({ where: { id: vid }, data: { active: false } });
    return res.json({ message: 'La variante tiene pedidos: se desactivó.', deactivated: true });
  }
  await prisma.productVariant.delete({ where: { id: vid } });
  await audit(req, 'VARIANTE_ELIMINADA', 'ProductVariant', vid);
  res.json({ message: 'Variante eliminada.', deleted: true });
}

// Ajuste de inventario en transacción, con registro del movimiento
async function adjustStock(req, res) {
  const vid = id(req.params.variantId);
  const { mode, value, reason } = req.valid.body;
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM ProductVariant WHERE id = ${vid} FOR UPDATE`;
    const v = await tx.productVariant.findUnique({ where: { id: vid } });
    if (!v) throw notFound('Variante no encontrada.');
    const newStock = mode === 'set' ? value : v.stock + value;
    if (newStock < 0) throw badRequest('El stock no puede quedar negativo.');
    const delta = newStock - v.stock;
    const updated = await tx.productVariant.update({ where: { id: vid }, data: { stock: newStock } });
    if (delta !== 0) {
      await tx.inventoryMovement.create({ data: { variantId: vid, type: 'AJUSTE_ADMIN', quantity: delta, stockAfter: newStock, userId: req.user.id, reason } });
    }
    return { updated, delta };
  });
  await audit(req, 'INVENTARIO_AJUSTADO', 'ProductVariant', vid, { delta: result.delta, reason });
  res.json({ variant: result.updated });
}

async function movements(req, res) {
  const pid = id(req.params.id);
  const rows = await prisma.inventoryMovement.findMany({
    where: { variant: { productId: pid } }, orderBy: { createdAt: 'desc' }, take: 100,
    include: { variant: { select: { sku: true, size: true, color: true } }, user: { select: { fullName: true } }, order: { select: { orderNumber: true } } },
  });
  res.json({ movements: rows });
}

// ---------- Imágenes ----------
async function uploadImages(req, res) {
  const pid = id(req.params.id);
  const product = await prisma.product.findUnique({ where: { id: pid }, include: { _count: { select: { images: true } } } });
  if (!product) throw notFound('Producto no encontrado.');
  if (!req.files || !req.files.length) throw badRequest('Selecciona al menos una imagen.');
  let order = product._count.images;
  const created = [];
  for (const file of req.files) {
    const saved = await saveImage(file.buffer, 'products');
    created.push(await prisma.productImage.create({
      data: { productId: pid, url: saved.url, storageKey: saved.storageKey, alt: `${product.name} - foto ${order + 1}`, sortOrder: order++ },
    }));
  }
  await audit(req, 'IMAGENES_SUBIDAS', 'Product', pid, { count: created.length });
  res.status(201).json({ images: created });
}

async function replaceImage(req, res) {
  const imgId = id(req.params.imageId);
  const img = await prisma.productImage.findUnique({ where: { id: imgId } });
  if (!img) throw notFound('Imagen no encontrada.');
  if (!req.file) throw badRequest('Selecciona la nueva imagen.');
  const saved = await saveImage(req.file.buffer, 'products');
  const updated = await prisma.productImage.update({ where: { id: imgId }, data: { url: saved.url, storageKey: saved.storageKey, isDemo: false } });
  await deleteImage(img.storageKey);
  await audit(req, 'IMAGEN_REEMPLAZADA', 'ProductImage', imgId);
  res.json({ image: updated });
}

async function updateImage(req, res) {
  const imgId = id(req.params.imageId);
  const img = await prisma.productImage.update({ where: { id: imgId }, data: req.valid.body });
  res.json({ image: img });
}

async function reorderImages(req, res) {
  const pid = id(req.params.id);
  const ids = req.valid.body.ids;
  await prisma.$transaction(ids.map((imgId, idx) => prisma.productImage.updateMany({ where: { id: imgId, productId: pid }, data: { sortOrder: idx } })));
  res.json({ ok: true });
}

async function deleteImageCtrl(req, res) {
  const imgId = id(req.params.imageId);
  const img = await prisma.productImage.findUnique({ where: { id: imgId } });
  if (!img) throw notFound('Imagen no encontrada.');
  await prisma.productImage.delete({ where: { id: imgId } });
  await deleteImage(img.storageKey);
  await audit(req, 'IMAGEN_ELIMINADA', 'ProductImage', imgId);
  res.json({ ok: true });
}

module.exports = {
  list, get, create, update, remove,
  addVariant, updateVariant, deleteVariant, adjustStock, movements,
  uploadImages, replaceImage, updateImage, reorderImages, deleteImage: deleteImageCtrl,
};
