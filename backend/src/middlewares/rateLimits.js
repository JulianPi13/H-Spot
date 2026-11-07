// Limita la cantidad de solicitudes para frenar abusos y ataques de fuerza bruta.
const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const message = (msg) => ({ error: msg });
const skip = () => env.isTest; // en pruebas automáticas no limitamos

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false, skip,
  message: message('Demasiadas solicitudes. Espera un momento.'),
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, skip,
  skipSuccessfulRequests: true,
  message: message('Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos.'),
});

const sensitiveLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, skip,
  message: message('Demasiadas solicitudes. Intenta de nuevo más tarde.'),
});

const checkoutLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, limit: 15, standardHeaders: 'draft-7', legacyHeaders: false, skip,
  message: message('Demasiados pedidos en poco tiempo. Espera unos minutos.'),
});

module.exports = { apiLimiter, loginLimiter, sensitiveLimiter, checkoutLimiter };
