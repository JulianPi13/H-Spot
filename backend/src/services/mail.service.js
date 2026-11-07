// Envío de correos. Si no hay servidor SMTP configurado en .env, NO se simula:
// la función responde { sent: false } y el resto del sistema lo informa.
const nodemailer = require('nodemailer');
const env = require('../config/env');

let transporter = null;
if (env.mailConfigured) {
  transporter = nodemailer.createTransport({
    host: env.SMTP.host, port: env.SMTP.port, secure: env.SMTP.secure,
    auth: { user: env.SMTP.user, pass: env.SMTP.pass },
  });
}

async function sendMail({ to, subject, text, devLink }) {
  if (!transporter) {
    if (env.DEV_PRINT_EMAIL_LINKS && devLink) {
      console.log(`\n[DESARROLLO] Correo NO enviado (SMTP sin configurar). Enlace para "${subject}":\n${devLink}\n`);
    }
    return { sent: false, reason: 'SMTP_NOT_CONFIGURED' };
  }
  await transporter.sendMail({ from: env.SMTP.from, to, subject, text });
  return { sent: true };
}

module.exports = { sendMail, isMailConfigured: () => Boolean(transporter) };
