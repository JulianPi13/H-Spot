// Consultas públicas del catálogo: listado con filtros, detalle y filtros disponibles.
const prisma = require('../config/prisma');
const { toNumber } = require('../utils/money');

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '28', '30', '32', '34', '36', '38', 'ÚNICA'];
const sortSizes = (sizes) =>
  [...sizes].sort((a, b) => {
    const ia = SIZE_ORDER.indexOf(a); const ib = SIZE_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
  });

const cardInclude = {
  category: { select: { name: true, slug: true } },
  images: { orderBy: { sortOrder: 'asc' }, take: 2, select: { url: true, alt: true, isDemo: true } },
  variants: { where: { active: true }, select: { size: true, color: true, colorHex: true, stock: true } },
};

// Convierte un producto de la base de datos al formato "tarjeta" del frontend
function toCard(p) {
  const colors = new Map();
  const sizes = new Set();
  let totalStock = 0;
  for (const v of p.variants) {
    if (!colors.has(v.color)) colors.set(v.color, v.colorHex);
    sizes.add(v.size);
    totalStock += v.stock;
  }
  const price = toNumber(p.price);
  const compareAt = toNumber(p.compareAtPrice);
  const onSale = compareAt !== null && compareAt > price;
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    price,
    compareAtPrice: onSale ? compareAt : null,
    discountPercent: onSale ? Math.round((1 - price / compareAt) * 100) : 0,
    gender: p.gender,
    category: p.category,
    images: p.images,
    colors: [...colors].map(([name, hex]) => ({ name, hex })),
    sizes: sortSizes(sizes),
    inStock: totalStock > 0,
    tags: { isNew: p.isNew, isBestSeller: p.isBestSeller, onSale, featured: p.featured },
    isDemo: p.isDemo,
  };
}

function buildWhere(f) {
  const AND = [{ active: true }, { category: { active: true } }];
  if (f.q) {
    AND.push({ OR: [{ name: { contains: f.q, mode: 'insensitive' } }, { description: { contains: f.q, mode: 'insensitive' } }] });
  }
  if (f.categoria) AND.push({ category: { slug: f.categoria } });
  if (f.genero) AND.push({ gender: { in: f.genero === 'UNISEX' ? ['UNISEX'] : [f.genero, 'UNISEX'] } });
  if (f.coleccion) AND.push({ collections: { some: { collection: { slug: f.coleccion, active: true } } } });
  if (f.min !== undefined) AND.push({ price: { gte: f.min } });
  if (f.max !== undefined) AND.push({ price: { lte: f.max } });
  if (f.oferta) AND.push({ compareAtPrice: { not: null } });
  if (f.nuevo) AND.push({ isNew: true });
  if (f.destacado) AND.push({ featured: true });
  if (f.masVendido) AND.push({ isBestSeller: true });

  // Talla / color / disponibilidad se evalúan sobre las variantes
  const variantWhere = { active: true };
  if (f.tallas && f.tallas.length) variantWhere.size = { in: f.tallas };
  if (f.colores && f.colores.length) variantWhere.color = { in: f.colores };
  if (f.disponible) variantWhere.stock = { gt: 0 };
  if (Object.keys(variantWhere).length > 1) AND.push({ variants: { some: variantWhere } });

  return { AND };
}

const ORDER_BY = {
  novedades: [{ createdAt: 'desc' }, { id: 'desc' }],
  precio_asc: [{ price: 'asc' }, { id: 'asc' }],
  precio_desc: [{ price: 'desc' }, { id: 'desc' }],
  populares: [{ salesCount: 'desc' }, { createdAt: 'desc' }],
};

async function listProducts(f) {
  const where = buildWhere(f);
  const page = f.page || 1;
  const limit = f.limit || 12;
  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where, include: cardInclude,
      orderBy: ORDER_BY[f.orden] || ORDER_BY.novedades,
      skip: (page - 1) * limit, take: limit,
    }),
  ]);
  return { items: rows.map(toCard), total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}

async function getProductBySlug(slug) {
  const p = await prisma.product.findFirst({
    where: { slug, active: true, category: { active: true } },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      collections: { where: { collection: { active: true } }, select: { collection: { select: { name: true, slug: true } } } },
      images: { orderBy: { sortOrder: 'asc' }, select: { id: true, url: true, alt: true, color: true, isDemo: true } },
      variants: {
        where: { active: true },
        orderBy: [{ color: 'asc' }, { id: 'asc' }],
        select: { id: true, sku: true, size: true, color: true, colorHex: true, stock: true },
      },
    },
  });
  if (!p) return null;

  const card = toCard({ ...p, images: p.images });
  const related = await prisma.product.findMany({
    where: { active: true, categoryId: p.categoryId, id: { not: p.id } },
    include: cardInclude, orderBy: { salesCount: 'desc' }, take: 4,
  });

  return {
    ...card,
    description: p.description,
    materials: p.materials,
    care: p.care,
    collections: p.collections.map((c) => c.collection),
    images: p.images,
    // El stock exacto se expone para limitar la cantidad seleccionable
    variants: p.variants.map((v) => ({ ...v, available: v.stock > 0 })),
    related: related.map(toCard),
    updatedAt: p.updatedAt,
  };
}

// Valores disponibles para construir los filtros del catálogo
async function getFacets() {
  const [categories, collections, variants, priceRange] = await Promise.all([
    prisma.category.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' }, select: { name: true, slug: true, imageUrl: true } }),
    prisma.collection.findMany({ where: { active: true }, orderBy: { createdAt: 'desc' }, select: { name: true, slug: true, isDrop: true, description: true, imageUrl: true } }),
    prisma.productVariant.findMany({
      where: { active: true, product: { active: true } },
      distinct: ['size', 'color'], select: { size: true, color: true, colorHex: true },
    }),
    prisma.product.aggregate({ where: { active: true }, _min: { price: true }, _max: { price: true } }),
  ]);
  const colors = new Map();
  const sizes = new Set();
  for (const v of variants) { sizes.add(v.size); if (!colors.has(v.color)) colors.set(v.color, v.colorHex); }
  return {
    categories, collections,
    sizes: sortSizes(sizes),
    colors: [...colors].map(([name, hex]) => ({ name, hex })).sort((a, b) => a.name.localeCompare(b.name)),
    price: { min: toNumber(priceRange._min.price) || 0, max: toNumber(priceRange._max.price) || 0 },
  };
}

async function getHomeData() {
  const base = { active: true, category: { active: true } };
  const [featured, newDrops, bestSellers] = await Promise.all([
    prisma.product.findMany({ where: { ...base, featured: true }, include: cardInclude, orderBy: { updatedAt: 'desc' }, take: 8 }),
    prisma.product.findMany({ where: { ...base, isNew: true }, include: cardInclude, orderBy: { createdAt: 'desc' }, take: 8 }),
    prisma.product.findMany({ where: base, include: cardInclude, orderBy: [{ isBestSeller: 'desc' }, { salesCount: 'desc' }], take: 4 }),
  ]);
  return { featured: featured.map(toCard), newDrops: newDrops.map(toCard), bestSellers: bestSellers.map(toCard) };
}

module.exports = { listProducts, getProductBySlug, getFacets, getHomeData, toCard, sortSizes };
