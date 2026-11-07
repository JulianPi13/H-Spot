// Rutas públicas de la API (no requieren iniciar sesión)
const express = require('express');
const { asyncHandler: h } = require('../utils/errors');
const { validate } = require('../middlewares/validate');
const { checkoutLimiter, sensitiveLimiter } = require('../middlewares/rateLimits');
const { requireAuth } = require('../middlewares/auth');
const { z, email } = require('../validators/common');
const catalogV = require('../validators/catalog.validators');
const checkoutV = require('../validators/checkout.validators');
const pub = require('../controllers/public.controller');
const catalog = require('../controllers/catalog.controller');
const cart = require('../controllers/cart.controller');
const order = require('../controllers/order.controller');

const r = express.Router();

r.get('/bootstrap', h(pub.bootstrap));
r.post('/newsletter', sensitiveLimiter, validate(z.object({ email, consent: z.literal(true, { errorMap: () => ({ message: 'Debes aceptar recibir comunicaciones.' }) }) })), h(pub.subscribe));

r.get('/home', h(catalog.home));
r.get('/products', validate(catalogV.catalogQuery, 'query'), h(catalog.list));
r.get('/products/facets', h(catalog.facets));
r.get('/products/:slug', h(catalog.detail));

// Carrito
r.post('/cart/quote', validate(checkoutV.quote), h(cart.quote));
r.get('/cart', requireAuth, h(cart.getCart));
r.put('/cart/items/:variantId', requireAuth, h(cart.setItem));
r.delete('/cart', requireAuth, h(cart.clear));
r.post('/cart/merge', requireAuth, validate(z.object({ items: checkoutV.cartItems })), h(cart.merge));

// Pedidos
r.post('/orders', checkoutLimiter, validate(checkoutV.checkout), h(order.checkout));
r.get('/orders/:orderNumber', h(order.view));

module.exports = r;
