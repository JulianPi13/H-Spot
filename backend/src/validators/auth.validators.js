const { z, email, personName, password, mustAccept, cleanText } = require('./common');
const { normalizeColombianPhone } = require('../utils/colombia');

const register = z.object({
  fullName: personName,
  email,
  password,
  confirmPassword: z.string({ required_error: 'Confirma tu contraseña.' }),
  acceptPolicy: mustAccept('Debes aceptar la política de tratamiento de datos.'),
}).refine((d) => d.password === d.confirmPassword, { path: ['confirmPassword'], message: 'Las contraseñas no coinciden.' });

const login = z.object({
  email: z.string().trim().toLowerCase().min(1, 'Escribe tu correo.').max(191),
  password: z.string().min(1, 'Escribe tu contraseña.').max(128),
});

const forgot = z.object({ email });

const reset = z.object({
  token: z.string().min(20).max(100),
  password,
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, { path: ['confirmPassword'], message: 'Las contraseñas no coinciden.' });

const phoneOptional = z.union([z.literal(''), z.null(), z.undefined(), z.string()])
  .transform((v, ctx) => {
    if (!v) return null;
    const n = normalizeColombianPhone(v);
    if (!n) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Escribe un número colombiano válido (10 dígitos).' }); return z.NEVER; }
    return n;
  });

const profile = z.object({ fullName: personName, phone: phoneOptional });

const changePassword = z.object({
  currentPassword: z.string().min(1, 'Escribe tu contraseña actual.'),
  newPassword: password,
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, { path: ['confirmPassword'], message: 'Las contraseñas no coinciden.' });

const verifyEmail = z.object({ token: cleanText(20, 100, 'El código') });

module.exports = { register, login, forgot, reset, profile, changePassword, verifyEmail, phoneOptional };
