// Pruebas de registro, login, sesiones, recuperación de contraseña y carrito de cuenta.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

h.migrate();
const prisma = require('../src/config/prisma');
const { createApp } = require('../src/app');
const { sha256 } = require('../src/utils/tokens');

let app; let data;
before(async () => { app = createApp(); await h.resetDb(prisma); data = await h.seedCatalog(prisma); });
after(async () => { await prisma.$disconnect(); });

test('registro: valida datos, no permite duplicados ni crear administradores', async () => {
  const a = await h.agent(app);
  let r = await a.send('post', '/api/auth/register', { fullName: 'X', email: 'no', password: '123', confirmPassword: '456', acceptPolicy: false }).expect(400);
  for (const f of ['fullName', 'email', 'password', 'acceptPolicy']) assert.ok(r.body.fields[f], f);
  r = await a.send('post', '/api/auth/register', { fullName: 'Camila Ruiz', email: 'Camila@Example.com', password: 'Segura2026', confirmPassword: 'Segura2026', acceptPolicy: true, role: 'ADMIN' }).expect(201);
  assert.equal(r.body.user.role, 'CUSTOMER');
  assert.equal(r.body.user.email, 'camila@example.com');
  const u = await prisma.user.findUnique({ where: { email: 'camila@example.com' } });
  assert.match(u.passwordHash, /^\$argon2id\$/);
  const b = await h.agent(app);
  r = await b.send('post', '/api/auth/register', { fullName: 'Otra', email: 'camila@example.com', password: 'Segura2026', confirmPassword: 'Segura2026', acceptPolicy: true }).expect(409);
});

test('login: mensaje genérico, sesión segura y cierre de sesión real', async () => {
  const a = await h.agent(app);
  const bad1 = await a.send('post', '/api/auth/login', { email: 'camila@example.com', password: 'Incorrecta1' }).expect(401);
  const bad2 = await a.send('post', '/api/auth/login', { email: 'noexiste@example.com', password: 'Incorrecta1' }).expect(401);
  assert.equal(bad1.body.error, bad2.body.error);
  const r = await a.send('post', '/api/auth/login', { email: 'camila@example.com', password: 'Segura2026' }).expect(200);
  const cookie = r.headers['set-cookie'].join(';');
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
  a.csrf = r.body.csrfToken;
  await a.get('/api/account/orders').expect(200);
  await a.send('post', '/api/auth/logout').expect(200);
  await a.get('/api/account/orders').expect(401);
});

test('rutas privadas protegidas', async () => {
  const a = await h.agent(app);
  await a.get('/api/account/orders').expect(401);
  await a.get('/api/cart').expect(401);
});

test('recuperación de contraseña: sin correo configurado no se simula el envío', async () => {
  const a = await h.agent(app);
  const r = await a.send('post', '/api/auth/forgot-password', { email: 'camila@example.com' }).expect(503);
  assert.equal(r.body.code, 'MAIL_NOT_CONFIGURED');
});

test('restablecer contraseña con token de un solo uso y con vencimiento', async () => {
  const u = await prisma.user.findUnique({ where: { email: 'camila@example.com' } });
  await prisma.passwordResetToken.create({ data: { userId: u.id, tokenHash: sha256('token-de-prueba-123456789'), expiresAt: new Date(Date.now() + 60000) } });
  await prisma.passwordResetToken.create({ data: { userId: u.id, tokenHash: sha256('token-vencido-123456789000'), expiresAt: new Date(Date.now() - 1000) } });
  const a = await h.agent(app);
  await a.send('post', '/api/auth/reset-password', { token: 'token-vencido-123456789000', password: 'NuevaClave1', confirmPassword: 'NuevaClave1' }).expect(400);
  await a.send('post', '/api/auth/reset-password', { token: 'token-de-prueba-123456789', password: 'NuevaClave1', confirmPassword: 'NuevaClave1' }).expect(200);
  await a.send('post', '/api/auth/reset-password', { token: 'token-de-prueba-123456789', password: 'OtraClave22', confirmPassword: 'OtraClave22' }).expect(400);
  await h.login(app, 'camila@example.com', 'NuevaClave1');
});

test('carrito de cuenta: combina el carrito de invitado sin duplicar', async () => {
  const a = await h.login(app, 'camila@example.com', 'NuevaClave1');
  await a.send('put', `/api/cart/items/${data.v1.id}`, { quantity: 2 }).expect(200);
  const r = await a.send('post', '/api/cart/merge', { items: [{ variantId: data.v1.id, quantity: 1 }, { variantId: data.v2.id, quantity: 1 }] }).expect(200);
  const line = r.body.lines.find((l) => l.variantId === data.v1.id);
  assert.equal(line.quantity, 2); // se toma la mayor cantidad, no la suma
  assert.equal(r.body.lines.length, 2);
  // Checkout con cuenta: el pedido queda asociado y el carrito se vacía
  const o = await a.send('post', '/api/orders', h.checkoutBody([{ variantId: data.v1.id, quantity: 2 }])).expect(201);
  const saved = await prisma.order.findUnique({ where: { id: o.body.order.id } });
  assert.ok(saved.userId);
  const cart = await a.get('/api/cart').expect(200);
  assert.equal(cart.body.lines.length, 0);
  const hist = await a.get('/api/account/orders').expect(200);
  assert.equal(hist.body.orders.length, 1);
  await a.get(`/api/account/orders/${o.body.order.orderNumber}`).expect(200);
});
