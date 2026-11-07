// Piezas reutilizables para validar datos con Zod.
const { z } = require('zod');

// Mensajes por defecto en español (para los casos sin mensaje propio)
z.setErrorMap((issue, ctx) => {
  switch (issue.code) {
    case 'invalid_type': return { message: issue.received === 'undefined' || issue.received === 'null' ? 'Este campo es obligatorio.' : 'El valor no es válido.' };
    case 'too_small': return { message: issue.type === 'number' ? `Debe ser mayor${issue.inclusive ? ' o igual' : ''} a ${issue.minimum}.` : issue.type === 'array' ? 'Selecciona al menos una opción.' : `Debe tener al menos ${issue.minimum} caracteres.` };
    case 'too_big': return { message: issue.type === 'number' ? `Debe ser menor${issue.inclusive ? ' o igual' : ''} a ${issue.maximum}.` : `Máximo ${issue.maximum} ${issue.type === 'array' ? 'elementos' : 'caracteres'}.` };
    case 'invalid_enum_value': return { message: 'Elige una opción válida.' };
    case 'invalid_string': return { message: 'Formato no válido.' };
    case 'invalid_date': return { message: 'Fecha inválida.' };
    default: return { message: ctx.defaultError };
  }
});

// Texto limpio: quita espacios extra y caracteres de control invisibles
const cleanText = (min, max, label) =>
  z.string({ required_error: `${label} es obligatorio.`, invalid_type_error: `${label} no es válido.` })
    .transform((s) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/[ \t]+/g, ' ').trim())
    .pipe(z.string()
      .min(min, min <= 1 ? `${label} es obligatorio.` : `${label} debe tener al menos ${min} caracteres.`)
      .max(max, `${label} no puede tener más de ${max} caracteres.`));

const optionalText = (max, label) =>
  z.union([z.literal(''), z.null(), z.undefined(), cleanText(0, max, label)])
    .transform((v) => (v === '' || v === null || v === undefined ? null : v));

const email = z.string({ required_error: 'El correo es obligatorio.' })
  .trim().toLowerCase()
  .max(191, 'El correo es demasiado largo.')
  .email('Escribe un correo válido, por ejemplo nombre@correo.com.');

const personName = cleanText(3, 120, 'El nombre')
  .refine((s) => /^[\p{L}][\p{L} .'-]*$/u.test(s), 'El nombre solo puede contener letras, espacios, puntos y guiones.');

const password = z.string({ required_error: 'La contraseña es obligatoria.' })
  .min(8, 'La contraseña debe tener al menos 8 caracteres.')
  .max(128, 'La contraseña no puede tener más de 128 caracteres.')
  .refine((s) => /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(s) && /\d/.test(s), 'La contraseña debe incluir letras y números.');

const mustAccept = (msg) => z.literal(true, { errorMap: () => ({ message: msg }) });

const intId = z.coerce.number().int().positive();

const boolish = z.union([z.boolean(), z.literal('true'), z.literal('false'), z.literal('1'), z.literal('0'), z.literal('on')])
  .transform((v) => v === true || v === 'true' || v === '1' || v === 'on');

module.exports = { z, cleanText, optionalText, email, personName, password, mustAccept, intId, boolish };
