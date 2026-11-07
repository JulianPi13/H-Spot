// Ajustes editables de la tienda guardados en la tabla StoreSetting.
// Si un ajuste no existe todavía, se usan los valores por defecto de abajo.
const prisma = require('../config/prisma');

const DEFAULTS = {
  brand: {
    name: 'H-SPOT',
    logoUrl: '',
    tagline: 'Moda urbana hecha en Colombia',
    contactEmail: '',
    contactPhone: '+57 301 322 3892',
    city: '',
    aboutText: 'H-SPOT es una tienda de moda urbana. Prendas oversize, hoodies y conjuntos pensados para la calle.',
  },
  announcement: {
    enabled: true,
    messages: ['NUEVA COLECCIÓN DISPONIBLE', 'ENVÍOS A TODO COLOMBIA', 'DESCUBRE EL PRÓXIMO DROP'],
  },
  whatsapp: { number: '573013223892' },
  social: { instagram: '', tiktok: '' }, // vacíos: no inventamos perfiles
  home: {
    heroEyebrow: 'DROP 01 — DISPONIBLE',
    heroTitle: 'YOUR STYLE. YOUR SPOT.',
    heroSubtitle: 'Siluetas oversize, tejidos pesados y colores de concreto. Ropa para moverse por la ciudad.',
    heroCta: 'EXPLORAR COLECCIÓN',
    heroCtaUrl: '/tienda',
    heroImage: '/assets/img/hero-provisional.svg',
    editorialTitle: 'HECHO PARA LA CALLE',
    editorialText: 'Cada prenda parte de una idea simple: comodidad, carácter y durabilidad. Diseñamos en pequeñas cantidades para que cada drop tenga identidad propia.',
    editorialImage: '/assets/img/editorial-provisional.svg',
    promoBanner: {
      enabled: true,
      title: 'TEMPORADA DE OFERTAS',
      text: 'Precios especiales en prendas seleccionadas mientras haya existencias.',
      ctaLabel: 'VER OFERTAS',
      ctaUrl: '/tienda?oferta=1',
      image: '/assets/img/promo-provisional.svg',
    },
    newsletterEnabled: true,
  },
  checkout: {
    currency: 'COP',
    freeShippingThreshold: null, // null = no hay envío gratis
    // Todos desactivados al inicio: el negocio decide cuáles acepta desde el panel.
    paymentMethods: [
      { id: 'transferencia', name: 'Transferencia bancaria', enabled: false },
      { id: 'nequi', name: 'Nequi', enabled: false },
      { id: 'daviplata', name: 'Daviplata', enabled: false },
      { id: 'contraentrega', name: 'Pago contra entrega', enabled: false },
    ],
    lowStockThreshold: 3,
  },
  policies: {
    privacy: '',   // se carga desde el archivo de política por defecto en el seed
    terms: '',
    shipping: '',
    returns: '',
  },
};

const PUBLIC_KEYS = ['brand', 'announcement', 'whatsapp', 'social', 'home', 'checkout', 'policies'];

function deepMerge(base, extra) {
  if (Array.isArray(base) || typeof base !== 'object' || base === null) return extra === undefined ? base : extra;
  const out = { ...base };
  for (const k of Object.keys(extra || {})) {
    out[k] = (typeof base[k] === 'object' && base[k] !== null && !Array.isArray(base[k]))
      ? deepMerge(base[k], extra[k]) : extra[k];
  }
  return out;
}

// db permite usarlo dentro de una transacción (misma conexión)
async function getSetting(key, db = prisma) {
  const row = await db.storeSetting.findUnique({ where: { key } });
  return deepMerge(DEFAULTS[key] ?? {}, row ? row.value : {});
}

async function getAllSettings() {
  const rows = await prisma.storeSetting.findMany({ where: { key: { in: PUBLIC_KEYS } } });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const out = {};
  for (const key of PUBLIC_KEYS) out[key] = deepMerge(DEFAULTS[key], map[key] || {});
  return out;
}

async function setSetting(key, value) {
  if (!PUBLIC_KEYS.includes(key)) throw new Error('Ajuste desconocido: ' + key);
  return prisma.storeSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

module.exports = { getSetting, getAllSettings, setSetting, DEFAULTS, PUBLIC_KEYS };
