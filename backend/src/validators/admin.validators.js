const { z, cleanText, optionalText, boolish, intId, email } = require('./common');

const money = (label) => z.coerce.number({ invalid_type_error: `${label} debe ser un número.` })
  .min(0, `${label} no puede ser negativo.`).max(100000000, `${label} es demasiado alto.`);

// Fechas "AAAA-MM-DD" del formulario: inicio o fin del día en hora de Colombia
const dayDate = (endOfDay) => z.union([z.literal(''), z.null(), z.undefined(), z.string(), z.date()]).transform((v, ctx) => {
  if (!v) return null;
  const d = typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T${endOfDay ? '23:59:59' : '00:00:00'}-05:00`) : new Date(v);
  if (Number.isNaN(d.getTime())) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Fecha inválida.' }); return z.NEVER; }
  return d;
});

const slugField = z.string().trim().toLowerCase().max(140)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'El enlace solo puede tener letras minúsculas, números y guiones.')
  .optional().or(z.literal('').transform(() => undefined));

const product = z.object({
  name: cleanText(2, 120, 'El nombre'),
  slug: slugField,
  description: cleanText(10, 5000, 'La descripción'),
  materials: optionalText(2000, 'Los materiales'),
  care: optionalText(2000, 'Los cuidados'),
  price: money('El precio').refine((v) => v > 0, 'El precio debe ser mayor que 0.'),
  compareAtPrice: z.union([z.literal(''), z.null(), z.undefined(), money('El precio anterior')]).transform((v) => (v === '' || v === undefined ? null : v)),
  gender: z.enum(['HOMBRE', 'MUJER', 'UNISEX']),
  categoryId: intId,
  collectionIds: z.array(intId).optional().default([]),
  active: boolish.optional().default(true),
  featured: boolish.optional().default(false),
  isNew: boolish.optional().default(false),
  isBestSeller: boolish.optional().default(false),
}).refine((d) => d.compareAtPrice === null || d.compareAtPrice > d.price, {
  path: ['compareAtPrice'], message: 'El precio anterior debe ser mayor que el precio actual (o déjalo vacío).',
});

const variant = z.object({
  size: cleanText(1, 20, 'La talla').transform((s) => s.toUpperCase()),
  color: cleanText(1, 40, 'El color'),
  colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Usa un color en formato #RRGGBB.').optional().nullable().or(z.literal('').transform(() => null)),
  sku: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{3,60}$/, 'El SKU solo puede tener letras, números y guiones.').optional().or(z.literal('').transform(() => undefined)),
  stock: z.coerce.number().int('El stock debe ser un número entero.').min(0, 'El stock no puede ser negativo.').max(100000),
  active: boolish.optional().default(true),
});

const variantUpdate = z.object({
  colorHex: variant.shape.colorHex,
  active: boolish.optional(),
});

const stockAdjust = z.object({
  mode: z.enum(['set', 'add']),
  value: z.coerce.number().int().min(-100000).max(100000),
  reason: cleanText(3, 200, 'El motivo'),
});

const imageMeta = z.object({
  alt: cleanText(3, 200, 'El texto alternativo').optional(),
  color: optionalText(40, 'El color'),
  sortOrder: z.coerce.number().int().min(0).max(999).optional(),
});

const imageOrder = z.object({ ids: z.array(intId).min(1) });

const category = z.object({
  name: cleanText(2, 80, 'El nombre'),
  slug: slugField,
  description: optionalText(300, 'La descripción'),
  imageUrl: optionalText(300, 'La imagen'),
  sortOrder: z.coerce.number().int().min(0).max(999).optional().default(0),
  active: boolish.optional().default(true),
});

const collection = z.object({
  name: cleanText(2, 80, 'El nombre'),
  slug: slugField,
  description: optionalText(500, 'La descripción'),
  imageUrl: optionalText(300, 'La imagen'),
  isDrop: boolish.optional().default(false),
  releaseDate: dayDate(false),
  active: boolish.optional().default(true),
});

const promotion = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,40}$/, 'El código solo puede tener letras, números, guiones (3 a 40).'),
  description: optionalText(200, 'La descripción'),
  type: z.enum(['PORCENTAJE', 'VALOR_FIJO']),
  value: money('El valor').refine((v) => v > 0, 'El valor debe ser mayor que 0.'),
  minSubtotal: z.union([z.literal(''), z.null(), z.undefined(), money('La compra mínima')]).transform((v) => (v === '' || v === undefined ? null : v)),
  startsAt: dayDate(false),
  endsAt: dayDate(true),
  maxUses: z.union([z.literal(''), z.null(), z.undefined(), z.coerce.number().int().min(1)]).transform((v) => (v === '' || v === undefined ? null : v)),
  active: boolish.optional().default(true),
}).refine((d) => d.type !== 'PORCENTAJE' || d.value <= 100, { path: ['value'], message: 'Un porcentaje no puede ser mayor a 100.' });

const shipping = z.object({
  name: cleanText(2, 80, 'El nombre'),
  description: optionalText(200, 'La descripción'),
  price: money('La tarifa'),
  active: boolish.optional().default(true),
  sortOrder: z.coerce.number().int().min(0).max(999).optional().default(0),
});

const orderStatus = z.object({
  status: z.enum(['PENDIENTE_CONFIRMACION', 'CONFIRMADO', 'EN_PREPARACION', 'ENVIADO', 'ENTREGADO', 'CANCELADO']),
  note: optionalText(300, 'La nota'),
});

const paymentStatus = z.object({ paymentStatus: z.enum(['PENDIENTE', 'PAGADO', 'REEMBOLSADO']) });

const orderNote = z.object({ body: cleanText(2, 1000, 'La nota') });

const userStatus = z.object({ status: z.enum(['ACTIVE', 'SUSPENDED']) });

const promoteAdmin = z.object({ email, confirm: z.literal(true, { errorMap: () => ({ message: 'Confirma la promoción.' }) }) });

// ---------- Ajustes de la tienda (uno por sección) ----------
const url = (label) => optionalText(300, label).refine(
  (v) => v === null || /^(https:\/\/|\/)[^\s<>"']*$/.test(v), `${label}: usa un enlace que empiece por https:// o /`,
);

const settings = {
  brand: z.object({
    name: cleanText(1, 40, 'El nombre'),
    logoUrl: url('El logotipo'),
    tagline: optionalText(120, 'El lema'),
    contactEmail: z.union([z.literal(''), email]).optional().default(''),
    contactPhone: optionalText(30, 'El teléfono'),
    city: optionalText(80, 'La ciudad'),
    aboutText: optionalText(1000, 'El texto'),
  }),
  announcement: z.object({
    enabled: boolish,
    messages: z.array(cleanText(2, 80, 'El mensaje')).max(5),
  }),
  whatsapp: z.object({
    number: z.string().trim().regex(/^57\d{10}$/, 'Usa el formato internacional sin espacios, por ejemplo 573013223892.'),
  }),
  social: z.object({
    instagram: url('Instagram').refine((v) => v === null || v.startsWith('https://'), 'Instagram debe empezar por https://'),
    tiktok: url('TikTok').refine((v) => v === null || v.startsWith('https://'), 'TikTok debe empezar por https://'),
  }),
  home: z.object({
    heroEyebrow: optionalText(60, 'El antetítulo'),
    heroTitle: cleanText(2, 80, 'El titular'),
    heroSubtitle: optionalText(240, 'El subtítulo'),
    heroCta: cleanText(2, 40, 'El texto del botón'),
    heroCtaUrl: url('El enlace del botón'),
    heroImage: url('La imagen principal'),
    editorialTitle: optionalText(80, 'El título editorial'),
    editorialText: optionalText(800, 'El texto editorial'),
    editorialImage: url('La imagen editorial'),
    promoBanner: z.object({
      enabled: boolish,
      title: optionalText(80, 'El título del banner'),
      text: optionalText(240, 'El texto del banner'),
      ctaLabel: optionalText(40, 'El botón del banner'),
      ctaUrl: url('El enlace del banner'),
      image: url('La imagen del banner'),
    }),
    newsletterEnabled: boolish,
  }),
  checkout: z.object({
    freeShippingThreshold: z.union([z.literal(''), z.null(), money('El umbral')]).transform((v) => (v === '' ? null : v)),
    paymentMethods: z.array(z.object({
      id: z.string().regex(/^[a-z0-9_-]{2,30}$/),
      name: cleanText(2, 60, 'El método de pago'),
      enabled: boolish,
    })).max(10),
    lowStockThreshold: z.coerce.number().int().min(0).max(1000),
  }),
  policies: z.object({
    privacy: optionalText(30000, 'La política de privacidad'),
    terms: optionalText(30000, 'Los términos'),
    shipping: optionalText(30000, 'La política de envíos'),
    returns: optionalText(30000, 'La política de cambios'),
  }),
};

module.exports = {
  product, variant, variantUpdate, stockAdjust, imageMeta, imageOrder, category, collection,
  promotion, shipping, orderStatus, paymentStatus, orderNote, userStatus, promoteAdmin, settings,
};
