// =============================================================
// Datos iniciales y de DEMOSTRACIÓN.
// - Crea categorías, colecciones y textos de políticas.
// - Crea productos de demostración (isDemo = true) SOLO si la tienda no tiene productos.
//   Sus precios, stock e imágenes son de ejemplo: reemplázalos por los reales.
// - NO crea pedidos, ventas, tarifas de envío ni descuentos ficticios.
// Uso: npm run db:seed            (seguro de repetir)
//      npm run db:seed -- --reset-demo   (borra productos demo sin pedidos y los vuelve a crear)
// =============================================================
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });
const { PrismaClient } = require('@prisma/client');
const { renderProductWebp } = require('./demo-images');
const { storeWebp } = require('../src/services/storage.service');
const { slugify } = require('../src/utils/slug');

const prisma = new PrismaClient();

const CATEGORIES = [
  { name: 'Camisetas', slug: 'camisetas', sortOrder: 1, imageUrl: '/assets/img/cat-camisetas.svg', description: 'Camisetas oversize de algodón pesado.' },
  { name: 'Hoodies', slug: 'hoodies', sortOrder: 2, imageUrl: '/assets/img/cat-hoodies.svg', description: 'Buzos con capota y felpa interior.' },
  { name: 'Pantalones', slug: 'pantalones', sortOrder: 3, imageUrl: '/assets/img/cat-pantalones.svg', description: 'Cargos, joggers y siluetas amplias.' },
  { name: 'Conjuntos', slug: 'conjuntos', sortOrder: 4, imageUrl: '/assets/img/cat-conjuntos.svg', description: 'Sets coordinados para el día a día.' },
  { name: 'Accesorios', slug: 'accesorios', sortOrder: 5, imageUrl: '/assets/img/cat-accesorios.svg', description: 'Gorras, bolsos y complementos.' },
];

const COLLECTIONS = [
  { name: 'Drop 01 — Concreto', slug: 'drop-01-concreto', isDrop: true, description: 'Primer lanzamiento: tonos de ciudad, cortes amplios y tejidos pesados.' },
  { name: 'Esenciales', slug: 'esenciales', isDrop: false, description: 'Básicos que combinan con todo.' },
];

const C = {
  negro: ['Negro', '#151515'], hueso: ['Hueso', '#E8E4DC'], gris: ['Gris cemento', '#8A8A86'],
  oliva: ['Verde oliva', '#5B5E4A'], arena: ['Arena', '#C8B89A'], azul: ['Azul noche', '#2E3A4D'], grafito: ['Grafito', '#3A3A3A'],
};

// [nombre, categoría, tipo de silueta, género, precio, precioAnterior, colores, tallas, colecciones, flags]
const PRODUCTS = [
  ['Camiseta Oversize Concreto', 'camisetas', 'tee', 'UNISEX', 89900, null, ['negro', 'hueso', 'gris'], ['S', 'M', 'L', 'XL'], ['drop-01-concreto', 'esenciales'], { featured: true, isNew: true, isBestSeller: true }],
  ['Camiseta Boxy Spot', 'camisetas', 'tee', 'UNISEX', 79900, 99900, ['hueso', 'arena'], ['S', 'M', 'L', 'XL'], ['esenciales'], {}],
  ['Camiseta Heavy Grafito', 'camisetas', 'tee', 'HOMBRE', 94900, null, ['grafito', 'negro'], ['M', 'L', 'XL', 'XXL'], ['drop-01-concreto'], { isNew: true }],
  ['Hoodie Oversize Asfalto', 'hoodies', 'hoodie', 'UNISEX', 189900, null, ['negro', 'gris'], ['S', 'M', 'L', 'XL'], ['drop-01-concreto'], { featured: true, isNew: true, isBestSeller: true }],
  ['Hoodie Esencial', 'hoodies', 'hoodie', 'UNISEX', 159900, 189900, ['hueso', 'oliva', 'azul'], ['S', 'M', 'L', 'XL'], ['esenciales'], { featured: true }],
  ['Chaqueta Coach Nocturna', 'hoodies', 'jacket', 'HOMBRE', 229900, null, ['azul', 'negro'], ['M', 'L', 'XL'], ['drop-01-concreto'], { isNew: true }],
  ['Cargo Wide Urbano', 'pantalones', 'pants', 'UNISEX', 169900, null, ['oliva', 'negro', 'arena'], ['28', '30', '32', '34', '36'], ['drop-01-concreto'], { featured: true, isBestSeller: true }],
  ['Jogger Relaxed', 'pantalones', 'pants', 'MUJER', 139900, 159900, ['gris', 'negro'], ['XS', 'S', 'M', 'L'], ['esenciales'], {}],
  ['Short Cargo Calle', 'pantalones', 'shorts', 'HOMBRE', 109900, null, ['arena', 'negro'], ['28', '30', '32', '34'], [], { isNew: true }],
  ['Conjunto Set Cemento', 'conjuntos', 'set', 'MUJER', 219900, 259900, ['gris', 'hueso'], ['XS', 'S', 'M', 'L'], ['drop-01-concreto'], { featured: true }],
  ['Gorra Six Panel H', 'accesorios', 'cap', 'UNISEX', 69900, null, ['negro', 'arena'], ['ÚNICA'], ['esenciales'], { isBestSeller: true }],
  ['Tote Bag Spot', 'accesorios', 'bag', 'UNISEX', 59900, null, ['hueso', 'negro'], ['ÚNICA'], [], {}],
];

const DESCRIPTIONS = {
  tee: ['Camiseta de corte oversize con hombro caído y cuello acanalado. Pensada para usarse suelta.', '100% algodón peinado, 240 g/m².'],
  hoodie: ['Buzo con capota de silueta amplia, bolsillo canguro y puños en rib.', '80% algodón, 20% poliéster. Felpa perchada por dentro.'],
  jacket: ['Chaqueta tipo coach con botones de presión y cuello camisero. Liviana y resistente al viento.', 'Exterior 100% poliéster; forro en malla.'],
  pants: ['Pantalón de bota amplia con bolsillos laterales y pretina con presillas.', 'Dril 100% algodón, 280 g/m².'],
  shorts: ['Bermuda cargo de largo a la rodilla, cintura con cordón interno.', 'Dril 100% algodón.'],
  set: ['Conjunto coordinado de camiseta y short en el mismo tono. Se venden juntos.', '100% algodón, 220 g/m².'],
  cap: ['Gorra de seis paneles con visera curva y ajuste trasero.', 'Sarga de algodón.'],
  bag: ['Bolso tipo tote con asas largas y bolsillo interno.', 'Lona de algodón 12 oz.'],
};
const CARE = 'Lavar a máquina en agua fría con colores similares. No usar blanqueador. Secar a la sombra. Planchar al revés a temperatura media.';

const read = (f) => fs.readFileSync(path.join(__dirname, 'policies', f), 'utf8');

async function seedBase() {
  for (const c of CATEGORIES) {
    await prisma.category.upsert({ where: { slug: c.slug }, update: {}, create: c });
  }
  for (const c of COLLECTIONS) {
    await prisma.collection.upsert({ where: { slug: c.slug }, update: {}, create: c });
  }
  const pol = await prisma.storeSetting.findUnique({ where: { key: 'policies' } });
  if (!pol) {
    await prisma.storeSetting.create({
      data: { key: 'policies', value: { privacy: read('privacy.txt'), terms: read('terms.txt'), shipping: read('shipping.txt'), returns: read('returns.txt') } },
    });
  }
  console.log('Categorías, colecciones y políticas listas.');
}

async function resetDemo() {
  const demos = await prisma.product.findMany({ where: { isDemo: true }, select: { id: true, _count: { select: { orderItems: true } } } });
  const deletable = demos.filter((d) => d._count.orderItems === 0).map((d) => d.id);
  await prisma.product.deleteMany({ where: { id: { in: deletable } } });
  console.log(`Productos demo eliminados: ${deletable.length} (los que tienen pedidos se conservan).`);
}

async function seedDemoProducts() {
  const count = await prisma.product.count();
  if (count > 0) {
    console.log(`La tienda ya tiene ${count} productos: no se crean productos de demostración.`);
    return;
  }
  const cats = Object.fromEntries((await prisma.category.findMany()).map((c) => [c.slug, c.id]));
  const cols = Object.fromEntries((await prisma.collection.findMany()).map((c) => [c.slug, c.id]));
  let n = 0;
  for (const [name, cat, type, gender, price, compareAt, colors, sizes, collections, flags] of PRODUCTS) {
    n += 1;
    const slug = slugify(name);
    const [desc, materials] = DESCRIPTIONS[type];
    const product = await prisma.product.create({
      data: {
        name, slug, description: desc, materials, care: CARE, price, compareAtPrice: compareAt, gender,
        categoryId: cats[cat], isDemo: true, ...flags,
        collections: { create: collections.map((s) => ({ collection: { connect: { id: cols[s] } } })) },
      },
    });
    // Imágenes provisionales (una vista frontal por color + un detalle)
    let order = 0;
    for (const colorKey of colors) {
      const [colorName, hex] = C[colorKey];
      const file = `demo-${slug}-${slugify(colorName)}.webp`;
      const saved = await storeWebp(await renderProductWebp({ type, colorHex: hex, label: `HS-${String(n).padStart(3, '0')} / ${colorName.toUpperCase()}` }), 'products', file);
      await prisma.productImage.create({
        data: { productId: product.id, url: saved.url, storageKey: saved.storageKey, alt: `${name} color ${colorName} (imagen provisional)`, color: colorName, sortOrder: order++, isDemo: true },
      });
    }
    const [firstColor, firstHex] = C[colors[0]];
    const detail = `demo-${slug}-detalle.webp`;
    const savedDetail = await storeWebp(await renderProductWebp({ type, colorHex: firstHex, label: 'DETALLE', variant: 'detail' }), 'products', detail);
    await prisma.productImage.create({
      data: { productId: product.id, url: savedDetail.url, storageKey: savedDetail.storageKey, alt: `${name} detalle color ${firstColor} (imagen provisional)`, color: firstColor, sortOrder: order++, isDemo: true },
    });

    // Variantes con stock de ejemplo (algunas agotadas a propósito para probar)
    let i = 0;
    for (const colorKey of colors) {
      const [colorName, hex] = C[colorKey];
      for (const size of sizes) {
        i += 1;
        const stock = (n + i) % 7 === 0 ? 0 : ((n * 3 + i * 5) % 9) + 1;
        const v = await prisma.productVariant.create({
          data: {
            productId: product.id, size, color: colorName, colorHex: hex, stock,
            sku: `HS${String(n).padStart(3, '0')}-${slugify(colorName).toUpperCase().slice(0, 6)}-${slugify(size).toUpperCase() || 'U'}`,
          },
        });
        if (stock > 0) {
          await prisma.inventoryMovement.create({ data: { variantId: v.id, type: 'STOCK_INICIAL', quantity: stock, stockAfter: stock, reason: 'Stock de demostración' } });
        }
      }
    }
    console.log(`  + ${name}`);
  }
  console.log(`${PRODUCTS.length} productos de demostración creados (marcados como DEMO).`);
}

async function main() {
  if (process.argv.includes('--reset-demo')) await resetDemo();
  await seedBase();
  // SEED_DEMO=false evita crear productos de demostración (por ejemplo, en producción)
  if (process.env.SEED_DEMO === 'false') console.log('SEED_DEMO=false: no se crean productos de demostración.');
  else if (process.env.VERCEL && !process.env.BLOB_READ_WRITE_TOKEN) {
    // En Vercel las fotos deben ir a Vercel Blob; sin él se perderían
    console.log('Aún no hay Vercel Blob conectado: los productos de demostración se crearán en la próxima publicación.');
  } else await seedDemoProducts();
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
