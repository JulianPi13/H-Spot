const { z, email, personName, cleanText, optionalText, mustAccept, boolish } = require('./common');
const { DEPARTAMENTOS, normalizeColombianPhone } = require('../utils/colombia');

const cartItems = z.array(z.object({
  variantId: z.coerce.number().int('Producto inválido.').positive('Producto inválido.'),
  quantity: z.coerce.number().int('La cantidad debe ser un número entero.').min(1, 'La cantidad mínima es 1.').max(99, 'Cantidad demasiado alta.'),
})).max(50, 'El carrito tiene demasiados productos.');

const quote = z.object({
  items: cartItems,
  shippingMethodId: z.coerce.number().int().positive().optional().nullable(),
  promoCode: optionalText(40, 'El código'),
});

const checkout = z.object({
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/, 'Solicitud inválida. Recarga la página.'),
  items: cartItems.min(1, 'Tu carrito está vacío.'),
  fullName: personName,
  phone: z.string({ required_error: 'El teléfono es obligatorio.' }).transform((v, ctx) => {
    const n = normalizeColombianPhone(v);
    if (!n) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Escribe un celular colombiano válido, por ejemplo 3001234567.' }); return z.NEVER; }
    return n;
  }),
  email,
  department: z.string({ required_error: 'Elige un departamento.' }).refine((d) => DEPARTAMENTOS.includes(d), 'Elige un departamento de la lista.'),
  city: cleanText(2, 80, 'La ciudad o municipio'),
  address: cleanText(6, 200, 'La dirección').refine((s) => /\d/.test(s), 'La dirección debe incluir el número (por ejemplo: Calle 45 # 12-30).'),
  neighborhood: optionalText(100, 'El barrio'),
  deliveryNotes: optionalText(300, 'Las indicaciones'),
  shippingMethodId: z.coerce.number().int().positive().optional().nullable(),
  paymentMethod: optionalText(40, 'El método de pago'),
  promoCode: optionalText(40, 'El código'),
  shareAddressWhatsapp: boolish.optional().default(false),
  acceptPolicy: mustAccept('Debes aceptar la política de tratamiento de datos.'),
  confirmData: mustAccept('Confirma que tus datos son correctos.'),
});

module.exports = { quote, checkout, cartItems };
