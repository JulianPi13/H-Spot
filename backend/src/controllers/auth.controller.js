// Registro, inicio y cierre de sesión, recuperación de contraseña y verificación de correo.
const argon2 = require('argon2');
const prisma = require('../config/prisma');
const env = require('../config/env');
const { randomToken, sha256 } = require('../utils/tokens');
const { badRequest, conflict, unauthorized } = require('../utils/errors');
const { sendMail, isMailConfigured } = require('../services/mail.service');
const { ensureCsrfToken } = require('../middlewares/csrf');
const { destroyUserSessions } = require('../middlewares/session');

const HASH_OPTIONS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };
const RESET_MINUTES = 30;

// Hash "señuelo" para que un correo inexistente tarde lo mismo que uno real
let dummyHash = null;
const getDummyHash = async () => (dummyHash ||= await argon2.hash('contraseña-señuelo-hspot', HASH_OPTIONS));

const publicUser = (u) => u && ({
  id: u.id, email: u.email, fullName: u.fullName, phone: u.phone, role: u.role,
  emailVerified: Boolean(u.emailVerifiedAt), createdAt: u.createdAt,
});

// Crea una sesión NUEVA (nuevo identificador) para evitar "fijación de sesión"
function startSession(req, userId) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.userId = userId;
      ensureCsrfToken(req);
      req.session.save((err2) => (err2 ? reject(err2) : resolve()));
    });
  });
}

async function sendVerificationEmail(user) {
  if (!isMailConfigured() && !env.DEV_PRINT_EMAIL_LINKS) return { sent: false };
  const token = randomToken(32);
  await prisma.emailVerificationToken.create({
    data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 24 * 3600 * 1000) },
  });
  const link = `${env.APP_URL}/verificar-correo?token=${token}`;
  return sendMail({
    to: user.email,
    subject: 'Confirma tu correo en H-SPOT',
    text: `Hola ${user.fullName},\n\nConfirma tu correo abriendo este enlace (válido por 24 horas):\n${link}\n\nSi no creaste una cuenta en H-SPOT, ignora este mensaje.`,
    devLink: link,
  });
}

async function register(req, res) {
  const { fullName, email, password } = req.valid.body;
  const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (exists) throw conflict('Ya existe una cuenta con ese correo.', { email: 'Ya existe una cuenta con ese correo. ¿Quieres iniciar sesión?' });

  const passwordHash = await argon2.hash(password, HASH_OPTIONS);
  let user;
  try {
    user = await prisma.user.create({
      // El registro público SIEMPRE crea clientes, nunca administradores
      data: { fullName, email, passwordHash, role: 'CUSTOMER', dataPolicyAcceptedAt: new Date() },
    });
  } catch (err) {
    if (err.code === 'P2002') throw conflict('Ya existe una cuenta con ese correo.', { email: 'Ya existe una cuenta con ese correo.' });
    throw err;
  }
  const mail = await sendVerificationEmail(user);
  await startSession(req, user.id);
  res.status(201).json({
    user: publicUser(user),
    csrfToken: req.session.csrfToken,
    emailVerification: mail.sent ? 'ENVIADO' : 'NO_DISPONIBLE',
  });
}

async function login(req, res) {
  const { email, password } = req.valid.body;
  const user = await prisma.user.findUnique({ where: { email } });
  // Mismo mensaje si el correo no existe o la contraseña falla (no revelamos cuál)
  const generic = 'Correo o contraseña incorrectos.';
  if (!user) {
    await argon2.verify(await getDummyHash(), password).catch(() => false);
    throw unauthorized(generic);
  }
  const ok = await argon2.verify(user.passwordHash, password).catch(() => false);
  if (!ok) throw unauthorized(generic);
  if (user.status !== 'ACTIVE') throw unauthorized('Tu cuenta está suspendida. Escríbenos para más información.');

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await startSession(req, user.id);
  res.json({ user: publicUser(user), csrfToken: req.session.csrfToken });
}

async function logout(req, res) {
  await new Promise((resolve) => req.session.destroy(() => resolve()));
  res.clearCookie('hspot.sid', { path: '/' });
  res.json({ ok: true });
}

async function me(req, res) {
  res.json({ user: publicUser(req.user) });
}

async function forgotPassword(req, res) {
  const { email } = req.valid.body;
  const mailAvailable = isMailConfigured() || env.DEV_PRINT_EMAIL_LINKS;
  if (!mailAvailable) {
    // No fingimos que se envió un correo
    return res.status(503).json({
      error: 'La recuperación de contraseña por correo aún no está habilitada en esta tienda. Escríbenos por WhatsApp para ayudarte.',
      code: 'MAIL_NOT_CONFIGURED',
    });
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (user && user.status === 'ACTIVE') {
    // Invalida tokens anteriores sin usar
    await prisma.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
    const token = randomToken(32);
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + RESET_MINUTES * 60 * 1000) },
    });
    const link = `${env.APP_URL}/restablecer?token=${token}`;
    await sendMail({
      to: user.email,
      subject: 'Restablece tu contraseña de H-SPOT',
      text: `Hola ${user.fullName},\n\nPara crear una nueva contraseña abre este enlace (válido por ${RESET_MINUTES} minutos y un solo uso):\n${link}\n\nSi no lo solicitaste, ignora este mensaje: tu contraseña no cambiará.`,
      devLink: link,
    });
  }
  // Respuesta idéntica exista o no la cuenta
  res.json({ message: 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.' });
}

async function resetPassword(req, res) {
  const { token, password } = req.valid.body;
  const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.usedAt || row.expiresAt < new Date()) {
    throw badRequest('El enlace no es válido o ya venció. Solicita uno nuevo.');
  }
  const passwordHash = await argon2.hash(password, HASH_OPTIONS);
  await prisma.$transaction([
    prisma.user.update({ where: { id: row.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
  ]);
  // Cierra todas las sesiones abiertas de ese usuario
  await destroyUserSessions(row.userId);
  res.json({ message: 'Tu contraseña se actualizó. Ya puedes iniciar sesión.' });
}

async function verifyEmail(req, res) {
  const { token } = req.valid.body;
  const row = await prisma.emailVerificationToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.usedAt || row.expiresAt < new Date()) throw badRequest('El enlace de verificación no es válido o ya venció.');
  await prisma.$transaction([
    prisma.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: new Date() } }),
    prisma.emailVerificationToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
  ]);
  res.json({ message: 'Tu correo quedó verificado.' });
}

async function resendVerification(req, res) {
  if (req.user.emailVerifiedAt) return res.json({ message: 'Tu correo ya está verificado.' });
  const r = await sendVerificationEmail(req.user);
  if (!r.sent && !env.DEV_PRINT_EMAIL_LINKS) {
    return res.status(503).json({ error: 'El envío de correos aún no está configurado en esta tienda.', code: 'MAIL_NOT_CONFIGURED' });
  }
  res.json({ message: 'Te enviamos un nuevo enlace de verificación.' });
}

module.exports = { register, login, logout, me, forgotPassword, resetPassword, verifyEmail, resendVerification, HASH_OPTIONS, publicUser };
