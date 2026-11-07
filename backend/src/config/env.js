// Lee y valida las variables de entorno (.env) al arrancar.
// Si falta algo importante, el servidor se detiene con un mensaje claro.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '.env'), quiet: true });

function required(name) {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Falta la variable de entorno ${name}. Revisa el archivo backend/.env (usa .env.example como guía).`);
  }
  return value.trim();
}

const NODE_ENV = process.env.NODE_ENV || 'development';
// Vercel define VERCEL=1 y la dirección del sitio automáticamente
const isVercel = Boolean(process.env.VERCEL);
const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '';
const isProduction = NODE_ENV === 'production';

const env = {
  NODE_ENV,
  isProduction,
  isTest: NODE_ENV === 'test',
  PORT: Number(process.env.PORT || 3000),
  isVercel,
  APP_URL: (process.env.APP_URL || vercelUrl || 'http://localhost:3000').replace(/\/$/, ''),
  DATABASE_URL: required('DATABASE_URL'),
  SESSION_SECRET: required('SESSION_SECRET'),
  CORS_ORIGINS: (process.env.CORS_ORIGINS || process.env.APP_URL || vercelUrl || 'http://localhost:3000')
    .split(',').map((s) => s.trim()).filter(Boolean),
  ORDER_RESERVATION_HOURS: Number(process.env.ORDER_RESERVATION_HOURS || 48),
  // Vercel acepta como máximo 4,5 MB por solicitud: por eso el valor por defecto es 4
  MAX_UPLOAD_MB: Math.min(Number(process.env.MAX_UPLOAD_MB || 4), isVercel ? 4 : 50),
  CRON_SECRET: process.env.CRON_SECRET || '',
  SETUP_TOKEN: process.env.SETUP_TOKEN || '',
  SMTP: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'H-SPOT <no-reply@localhost>',
  },
  DEV_PRINT_EMAIL_LINKS: !isProduction && process.env.DEV_PRINT_EMAIL_LINKS === 'true',
};

if (isProduction && env.SESSION_SECRET.length < 32) {
  throw new Error('SESSION_SECRET debe tener al menos 32 caracteres en producción.');
}

env.mailConfigured = Boolean(env.SMTP.host && env.SMTP.user && env.SMTP.pass);

module.exports = env;
