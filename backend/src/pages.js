// Sirve las páginas HTML con URLs legibles (/tienda, /producto/hoodie-negro...),
// inserta metadatos SEO y Open Graph del producto, y genera sitemap.xml y robots.txt.
const express = require('express');
const fs = require('fs');
const path = require('path');
const env = require('./config/env');
const prisma = require('./config/prisma');
const { FRONTEND } = require('./config/paths');
const { toNumber } = require('./utils/money');
const { asyncHandler } = require('./utils/errors');

const router = express.Router();
const cache = new Map();

function readPage(file) {
  if (env.isProduction && cache.has(file)) return cache.get(file);
  const html = fs.readFileSync(path.join(FRONTEND, file), 'utf8');
  cache.set(file, html);
  return html;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function send(res, file, { title, description, extraHead = '', status = 200, canonical } = {}) {
  let html = readPage(file);
  if (title) html = html.replace(/<title>.*?<\/title>/s, `<title>${esc(title)}</title>`);
  if (description) html = html.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(description)}">`);
  const head = [
    canonical ? `<link rel="canonical" href="${esc(env.APP_URL + canonical)}">` : '',
    extraHead,
  ].join('\n');
  html = html.replace('<!--SEO-->', head);
  res.status(status).type('html').set('Cache-Control', 'no-cache').send(html);
}

const page = (file, meta) => (req, res) => send(res, file, { ...meta, canonical: req.path });

// Páginas públicas
router.get('/', page('index.html', { title: 'H-SPOT | Moda urbana en Colombia', description: 'Streetwear, prendas oversize, hoodies y conjuntos. Compra en línea y confirma tu pedido por WhatsApp.' }));
router.get(['/tienda', '/hombre', '/mujer', '/unisex', '/ofertas', '/novedades'], (req, res) => {
  const names = { '/tienda': 'Tienda', '/hombre': 'Hombre', '/mujer': 'Mujer', '/unisex': 'Unisex', '/ofertas': 'Ofertas', '/novedades': 'Novedades' };
  send(res, 'pages/tienda.html', { title: `${names[req.path]} | H-SPOT`, description: `${names[req.path]} en H-SPOT: ropa urbana con envíos a toda Colombia.`, canonical: req.path });
});
router.get('/colecciones', page('pages/colecciones.html', { title: 'Colecciones y drops | H-SPOT', description: 'Explora las colecciones y lanzamientos de H-SPOT.' }));
router.get('/colecciones/:slug', asyncHandler(async (req, res) => {
  const c = await prisma.collection.findFirst({ where: { slug: req.params.slug, active: true } });
  if (!c) return notFound(req, res);
  send(res, 'pages/tienda.html', { title: `${c.name} | H-SPOT`, description: c.description || `Colección ${c.name} de H-SPOT.`, canonical: req.path });
}));
router.get('/categoria/:slug', asyncHandler(async (req, res) => {
  const c = await prisma.category.findFirst({ where: { slug: req.params.slug, active: true } });
  if (!c) return notFound(req, res);
  send(res, 'pages/tienda.html', { title: `${c.name} | H-SPOT`, description: c.description || `${c.name} en H-SPOT.`, canonical: req.path });
}));

// Página de producto con Open Graph y datos estructurados (JSON-LD)
router.get('/producto/:slug', asyncHandler(async (req, res) => {
  const p = await prisma.product.findFirst({
    where: { slug: req.params.slug, active: true },
    include: { images: { orderBy: { sortOrder: 'asc' }, take: 4 }, variants: { where: { active: true }, select: { stock: true, sku: true } }, category: true },
  });
  if (!p) return notFound(req, res);
  const url = `${env.APP_URL}/producto/${p.slug}`;
  const abs = (u) => (/^https?:\/\//.test(u) ? u : env.APP_URL + u);
  const img = p.images[0] ? abs(p.images[0].url) : '';
  const desc = p.description.replace(/\s+/g, ' ').slice(0, 155);
  const inStock = p.variants.some((v) => v.stock > 0);
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'Product', name: p.name, description: desc,
    image: p.images.map((i) => abs(i.url)), sku: p.variants[0]?.sku, category: p.category.name,
    brand: { '@type': 'Brand', name: 'H-SPOT' },
    offers: { '@type': 'Offer', url, priceCurrency: 'COP', price: toNumber(p.price), availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' },
  };
  const head = [
    `<meta property="og:type" content="product">`,
    `<meta property="og:title" content="${esc(p.name)} | H-SPOT">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    img ? `<meta property="og:image" content="${esc(img)}">` : '',
    `<meta property="product:price:amount" content="${toNumber(p.price)}">`,
    `<meta property="product:price:currency" content="COP">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`,
  ].join('\n');
  send(res, 'pages/producto.html', { title: `${p.name} | H-SPOT`, description: desc, extraHead: head, canonical: `/producto/${p.slug}` });
}));

const noindex = '<meta name="robots" content="noindex">';
router.get('/carrito', (req, res) => send(res, 'pages/carrito.html', { title: 'Carrito | H-SPOT', extraHead: noindex }));
router.get('/checkout', (req, res) => send(res, 'pages/checkout.html', { title: 'Finalizar pedido | H-SPOT', extraHead: noindex }));
router.get('/pedido/:orderNumber', (req, res) => send(res, 'pages/pedido.html', { title: 'Tu pedido | H-SPOT', extraHead: noindex }));
router.get(['/login', '/registro', '/recuperar', '/restablecer', '/verificar-correo'], (req, res) =>
  send(res, 'pages/auth.html', { title: 'Mi cuenta | H-SPOT', extraHead: noindex }));
router.get(['/cuenta', '/cuenta/*'], (req, res) => send(res, 'pages/cuenta.html', { title: 'Mi cuenta | H-SPOT', extraHead: noindex }));
router.get(['/politica-de-datos', '/terminos', '/envios', '/cambios-y-devoluciones'], page('pages/politica.html', { title: 'Políticas | H-SPOT' }));
router.get('/configuracion-inicial', (req, res) => send(res, 'pages/setup.html', { title: 'Configuración inicial | H-SPOT', extraHead: noindex }));
router.get(['/admin', '/admin/*'], (req, res) => send(res, 'admin/index.html', { title: 'Panel H-SPOT', extraHead: noindex }));

// SEO
router.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nDisallow: /admin\nDisallow: /api/\nDisallow: /cuenta\nDisallow: /checkout\nDisallow: /carrito\nDisallow: /pedido/\nSitemap: ${env.APP_URL}/sitemap.xml\n`);
});
router.get('/sitemap.xml', asyncHandler(async (req, res) => {
  const [products, collections, categories] = await Promise.all([
    prisma.product.findMany({ where: { active: true }, select: { slug: true, updatedAt: true } }),
    prisma.collection.findMany({ where: { active: true }, select: { slug: true, updatedAt: true } }),
    prisma.category.findMany({ where: { active: true }, select: { slug: true, updatedAt: true } }),
  ]);
  const urls = ['/', '/tienda', '/hombre', '/mujer', '/unisex', '/ofertas', '/colecciones'].map((u) => ({ loc: u }))
    .concat(collections.map((c) => ({ loc: `/colecciones/${c.slug}`, lastmod: c.updatedAt })))
    .concat(categories.map((c) => ({ loc: `/categoria/${c.slug}`, lastmod: c.updatedAt })))
    .concat(products.map((p) => ({ loc: `/producto/${p.slug}`, lastmod: p.updatedAt })));
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${esc(env.APP_URL + u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod.toISOString().slice(0, 10)}</lastmod>` : ''}</url>`)
    .join('\n')}\n</urlset>`;
  res.type('application/xml').send(xml);
}));
router.get('/favicon.ico', (req, res) => res.redirect(301, '/assets/img/favicon.svg'));

function notFound(req, res) {
  send(res, 'pages/404.html', { title: 'Página no encontrada | H-SPOT', status: 404, extraHead: noindex });
}
router.use((req, res) => notFound(req, res));

module.exports = router;
