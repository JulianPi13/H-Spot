// Pruebas de catálogo, carrito, checkout, inventario y WhatsApp.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

h.migrate();
const prisma = require('../src/config/prisma');
const { createApp } = require('../src/app');
const { changeStatus, releaseExpiredOrders } = require('../src/services/order.service');

let app; let data;
before(async () => { app = createApp(); await h.resetDb(prisma); data = await h.seedCatalog(prisma); });
after(async () => { await prisma.$disconnect(); });

test('catálogo público: lista, búsqueda y filtros', async () => {
  const a = await h.agent(app);
  let r = await a.get('/api/products').expect(200);
  assert.equal(r.body.total, 1);
  r = await a.get('/api/products?q=Hoodie&tallas=M&disponible=1').expect(200);
  assert.equal(r.body.total, 1);
  r = await a.get('/api/products?tallas=XS').expect(200);
  assert.equal(r.body.total, 0);
  r = await a.get('/api/products/hoodie-prueba').expect(200);
  assert.equal(r.body.product.variants.length, 3);
  await a.get('/api/products/no-existe').expect(404);
});

test('el precio lo calcula el servidor (ignora precios enviados por el navegador)', async () => {
  const a = await h.agent(app);
  const r = await a.send('post', '/api/cart/quote', { items: [{ variantId: data.v1.id, quantity: 2, price: 1 }] }).expect(200);
  assert.equal(r.body.lines[0].unitPrice, 150000);
  assert.equal(r.body.subtotal, 300000);
});

test('sin token CSRF se rechaza la solicitud', async () => {
  const a = await h.agent(app);
  await a.post('/api/cart/quote').send({ items: [] }).expect(403);
});

test('checkout como invitado: crea pedido, descuenta stock y genera WhatsApp', async () => {
  const a = await h.agent(app);
  const body = h.checkoutBody([{ variantId: data.v1.id, quantity: 2 }], { shareAddressWhatsapp: true });
  const r = await a.send('post', '/api/orders', body).expect(201);
  const o = r.body.order;
  assert.equal(o.status, 'PENDIENTE_CONFIRMACION');
  assert.equal(o.total, 300000);
  assert.match(o.whatsapp.url, /^https:\/\/wa\.me\/573013223892\?text=/);
  assert.match(o.whatsapp.message, /Hoodie Prueba \| Talla M \| Color Negro \| Cant\. 2/);
  assert.match(o.whatsapp.message, /Calle 1 # 2-3/);
  const v = await prisma.productVariant.findUnique({ where: { id: data.v1.id } });
  assert.equal(v.stock, 3);
  const mov = await prisma.inventoryMovement.findFirst({ where: { orderId: o.id } });
  assert.equal(mov.quantity, -2);
  const saved = await prisma.order.findUnique({ where: { id: o.id }, include: { items: true } });
  assert.equal(saved.items[0].productName, 'Hoodie Prueba');
  assert.equal(saved.paymentStatus, 'PENDIENTE'); // abrir WhatsApp no marca pagado

  // Repetir el mismo envío (doble clic) devuelve el mismo pedido, sin duplicar
  const again = await a.send('post', '/api/orders', body).expect(200);
  assert.equal(again.body.order.id, o.id);
  assert.equal(await prisma.order.count({ where: { idempotencyKey: body.idempotencyKey } }), 1);
  assert.equal((await prisma.productVariant.findUnique({ where: { id: data.v1.id } })).stock, 3);

  // El mismo navegador puede ver su pedido; otro navegador no
  await a.get(`/api/orders/${o.orderNumber}`).expect(200);
  const other = await h.agent(app);
  await other.get(`/api/orders/${o.orderNumber}`).expect(404);
  await other.get(`/api/orders/${o.orderNumber}?token=${r.body.accessToken}`).expect(200);
});

test('no permite comprar más unidades que el stock ni variantes agotadas', async () => {
  const a = await h.agent(app);
  let r = await a.send('post', '/api/orders', h.checkoutBody([{ variantId: data.v1.id, quantity: 50 }])).expect(409);
  assert.match(r.body.error, /disponibilidad/);
  r = await a.send('post', '/api/orders', h.checkoutBody([{ variantId: data.v3.id, quantity: 1 }])).expect(409);
});

test('validaciones del checkout con mensajes por campo', async () => {
  const a = await h.agent(app);
  const r = await a.send('post', '/api/orders', h.checkoutBody([{ variantId: data.v1.id, quantity: 1 }], {
    phone: '123', email: 'malo', department: 'Narnia', address: 'sin numero', acceptPolicy: false, fullName: 'A',
  })).expect(400);
  for (const f of ['phone', 'email', 'department', 'address', 'acceptPolicy', 'fullName']) assert.ok(r.body.fields[f], `falta error en ${f}`);
  await a.send('post', '/api/orders', h.checkoutBody([{ variantId: data.v1.id, quantity: 1.5 }])).expect(400);
});

test('dos clientes simultáneos por la última unidad: solo uno la obtiene', async () => {
  const [a, b] = await Promise.all([h.agent(app), h.agent(app)]);
  const results = await Promise.all([
    a.send('post', '/api/orders', h.checkoutBody([{ variantId: data.v2.id, quantity: 1 }])),
    b.send('post', '/api/orders', h.checkoutBody([{ variantId: data.v2.id, quantity: 1 }])),
  ]);
  const codes = results.map((r) => r.status).sort();
  assert.deepEqual(codes, [201, 409]);
  assert.equal((await prisma.productVariant.findUnique({ where: { id: data.v2.id } })).stock, 0);
});

test('cancelar un pedido devuelve el inventario; transiciones inválidas se rechazan', async () => {
  const a = await h.agent(app);
  const r = await a.send('post', '/api/orders', h.checkoutBody([{ variantId: data.v1.id, quantity: 1 }])).expect(201);
  const before = (await prisma.productVariant.findUnique({ where: { id: data.v1.id } })).stock;
  await assert.rejects(changeStatus(r.body.order.id, 'ENTREGADO'), /No se puede pasar/);
  await changeStatus(r.body.order.id, 'CANCELADO', { note: 'prueba' });
  assert.equal((await prisma.productVariant.findUnique({ where: { id: data.v1.id } })).stock, before + 1);
  // Cancelar dos veces no devuelve stock dos veces
  await changeStatus(r.body.order.id, 'CANCELADO');
  assert.equal((await prisma.productVariant.findUnique({ where: { id: data.v1.id } })).stock, before + 1);
});

test('las reservas vencidas se liberan automáticamente', async () => {
  const a = await h.agent(app);
  const r = await a.send('post', '/api/orders', h.checkoutBody([{ variantId: data.v1.id, quantity: 1 }])).expect(201);
  const stockAfterOrder = (await prisma.productVariant.findUnique({ where: { id: data.v1.id } })).stock;
  await prisma.order.update({ where: { id: r.body.order.id }, data: { reservationExpiresAt: new Date(Date.now() - 1000) } });
  const n = await releaseExpiredOrders();
  assert.ok(n >= 1);
  const o = await prisma.order.findUnique({ where: { id: r.body.order.id } });
  assert.equal(o.status, 'CANCELADO');
  assert.equal((await prisma.productVariant.findUnique({ where: { id: data.v1.id } })).stock, stockAfterOrder + 1);
});

test('envío y promociones configurables se aplican en el servidor', async () => {
  await prisma.shippingMethod.create({ data: { name: 'Nacional', price: 15000 } });
  await prisma.promotion.create({ data: { code: 'TEST10', type: 'PORCENTAJE', value: 10, maxUses: 1 } });
  const a = await h.agent(app);
  let r = await a.send('post', '/api/cart/quote', { items: [{ variantId: data.v1.id, quantity: 1 }], promoCode: 'test10' }).expect(200);
  assert.equal(r.body.discount, 15000);
  assert.equal(r.body.shippingCost, 15000);
  assert.equal(r.body.total, 150000);
  r = await a.send('post', '/api/orders', h.checkoutBody([{ variantId: data.v1.id, quantity: 1 }], { promoCode: 'TEST10' })).expect(201);
  assert.equal(r.body.order.total, 150000);
  // El código llegó a su límite de usos
  await a.send('post', '/api/cart/quote', { items: [{ variantId: data.v1.id, quantity: 1 }], promoCode: 'TEST10' }).expect(400);
  await prisma.shippingMethod.deleteMany();
});

test('los pedidos persisten en MySQL (sobreviven a un "reinicio" de la app)', async () => {
  const count = await prisma.order.count();
  createApp(); // nueva instancia, mismos datos
  assert.equal(await prisma.order.count(), count);
  assert.ok(count >= 4);
});
