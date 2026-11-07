const express = require('express');
const { asyncHandler: h } = require('../utils/errors');
const { validate } = require('../middlewares/validate');
const { loginLimiter, sensitiveLimiter } = require('../middlewares/rateLimits');
const { requireAuth } = require('../middlewares/auth');
const v = require('../validators/auth.validators');
const auth = require('../controllers/auth.controller');
const account = require('../controllers/account.controller');

const r = express.Router();

r.post('/auth/register', sensitiveLimiter, validate(v.register), h(auth.register));
r.post('/auth/login', loginLimiter, validate(v.login), h(auth.login));
r.post('/auth/logout', h(auth.logout));
r.get('/auth/me', h(auth.me));
r.post('/auth/forgot-password', sensitiveLimiter, validate(v.forgot), h(auth.forgotPassword));
r.post('/auth/reset-password', sensitiveLimiter, validate(v.reset), h(auth.resetPassword));
r.post('/auth/verify-email', validate(v.verifyEmail), h(auth.verifyEmail));
r.post('/auth/resend-verification', requireAuth, sensitiveLimiter, h(auth.resendVerification));

// Cuenta del cliente
r.put('/account/profile', requireAuth, validate(v.profile), h(account.updateProfile));
r.put('/account/password', requireAuth, validate(v.changePassword), h(account.changePassword));
r.get('/account/orders', requireAuth, h(account.listOrders));
r.get('/account/orders/:orderNumber', requireAuth, h(account.getOrder));

module.exports = r;
