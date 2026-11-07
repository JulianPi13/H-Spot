const { z, boolish } = require('./common');

const list = (v) => (v === undefined || v === '' ? undefined : String(v).split(',').map((s) => s.trim()).filter(Boolean).slice(0, 20));

const catalogQuery = z.object({
  q: z.string().trim().max(80).optional().transform((v) => v || undefined),
  categoria: z.string().trim().max(100).optional().transform((v) => v || undefined),
  coleccion: z.string().trim().max(100).optional().transform((v) => v || undefined),
  genero: z.enum(['HOMBRE', 'MUJER', 'UNISEX']).optional().or(z.literal('').transform(() => undefined)),
  tallas: z.any().optional().transform(list),
  colores: z.any().optional().transform(list),
  min: z.coerce.number().min(0).optional().or(z.literal('').transform(() => undefined)),
  max: z.coerce.number().min(0).optional().or(z.literal('').transform(() => undefined)),
  disponible: boolish.optional(),
  oferta: boolish.optional(),
  nuevo: boolish.optional(),
  destacado: boolish.optional(),
  masVendido: boolish.optional(),
  orden: z.enum(['novedades', 'precio_asc', 'precio_desc', 'populares']).optional().default('novedades'),
  page: z.coerce.number().int().min(1).max(1000).optional().default(1),
  limit: z.coerce.number().int().min(1).max(48).optional().default(12),
});

module.exports = { catalogQuery };
