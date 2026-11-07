// Pruebas del panel administrativo y sus permisos.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

h.migrate();
const prisma = require('../src/config/prisma');
const { createApp } = require('../src/app');

let app; let data; let admin;
before(async () => {
  app = createApp(); await h.resetDb(prisma); data = await h.seedCatalog(prisma);
  await h.createUser(prisma, { email: 'admin@example.com', role: 'ADMIN', fullName: 'Admin Uno' });
  await h.createUser(prisma, { email: 'cliente@example.com' });
  admin = await h.login(app, 'admin@example.com');
});
after(async () => { await prisma.$disconnect(); });

test('el panel está bloqueado para invitados y clientes', async () => {
  const anon = await h.agent(app);
  await anon.get('/api/admin/dashboard').expect(401);
  const customer = await h.login(app, 'cliente@example.com');
  await customer.get('/api/admin/dashboard').expect(403);
  await customer.send('post', '/api/admin/products', { name: 'x' }).expect(403);
  await admin.get('/api/admin/dashboard').expect(200);
});

test('crear y editar productos; el cambio de precio se refleja en la tienda', async () => {
  let r = await admin.send('post', '/api/admin/products', { name: 'Camiseta Nueva', description: 'Descripción suficiente.', price: 80000, gender: 'UNISEX', categoryId: data.cat.id }).expect(201);
  const id = r.body.product.id;
  r = await admin.send('post', `/api/admin/products/${id}/variants`, { size: 'm', color: 'Blanco', colorHex: '#ffffff', stock: 4 }).expect(201);
  assert.equal(r.body.variant.size, 'M');
  await admin.send('post', `/api/admin/products/${id}/variants`, { size: 'M', color: 'Blanco', stock: 1 }).expect(409);
  await admin.send('put', `/api/admin/products/${id}`, { name: 'Camiseta Nueva', description: 'Descripción suficiente.', price: 75000, compareAtPrice: 90000, gender: 'UNISEX', categoryId: data.cat.id }).expect(200);
  const pub = await (await h.agent(app)).get('/api/products/camiseta-nueva').expect(200);
  assert.equal(pub.body.product.price, 75000);
  assert.equal(pub.body.product.discountPercent, 17);
  await admin.send('put', `/api/admin/products/${id}`, { name: 'Camiseta Nueva', description: 'Descripción suficiente.', price: 75000, compareAtPrice: 50000, gender: 'UNISEX', categoryId: data.cat.id }).expect(400);
  assert.ok(await prisma.auditLog.findFirst({ where: { action: 'PRODUCTO_EDITADO' } }));
});

test('ajuste de inventario registrado como movimiento', async () => {
  const r = await admin.send('post', `/api/admin/variants/${data.v3.id}/stock`, { mode: 'set', value: 6, reason: 'Llegó producción' }).expect(200);
  assert.equal(r.body.variant.stock, 6);
  const mov = await prisma.inventoryMovement.findFirst({ where: { variantId: data.v3.id, type: 'AJUSTE_ADMIN' } });
  assert.equal(mov.quantity, 6);
  await admin.send('post', `/api/admin/variants/${data.v3.id}/stock`, { mode: 'add', value: -100, reason: 'Error' }).expect(400);
});

test('subir, reemplazar y rechazar archivos que no son imágenes', async () => {
  const sharp = require('sharp');
  const png = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#333' } }).png().toBuffer();
  const up = await admin.post(`/api/admin/products/${data.product.id}/images`).set('X-CSRF-Token', admin.csrf).attach('images', png, 'foto.png').expect(201);
  assert.match(up.body.images[0].url, /\.webp$/);
  await admin.put(`/api/admin/images/${up.body.images[0].id}/file`).set('X-CSRF-Token', admin.csrf).attach('image', png, 'otra.png').expect(200);
  await admin.post(`/api/admin/products/${data.product.id}/images`).set('X-CSRF-Token', admin.csrf)
    .attach('images', Buffer.from('MZ ejecutable falso'), { filename: 'virus.exe', contentType: 'application/octet-stream' }).expect(400);
  await admin.post(`/api/admin/products/${data.product.id}/images`).set('X-CSRF-Token', admin.csrf)
    .attach('images', Buffer.from('no es imagen'), { filename: 'falsa.png', contentType: 'image/png' }).expect(400);
});

test('gestión de pedidos: estados, pago, notas, historial, CSV y estadísticas', async () => {
  const a = await h.agent(app);
  const o = (await a.send('post', '/api/orders', h.checkoutBody([{ variantId: data.v1.id, quantity: 2 }])).expect(201)).body.order;
  let r = await admin.get('/api/admin/dashboard').expect(200);
  assert.equal(r.body.confirmedRevenue.today.total, 0); // pendiente no cuenta como ingreso
  assert.equal(r.body.webOrders.today.count, 1);
  await admin.send('post', `/api/admin/orders/${o.id}/status`, { status: 'CONFIRMADO' }).expect(200);
  await admin.send('post', `/api/admin/orders/${o.id}/status`, { status: 'PENDIENTE_CONFIRMACION' }).expect(400);
  await admin.send('post', `/api/admin/orders/${o.id}/payment`, { paymentStatus: 'PAGADO' }).expect(200);
  await admin.send('post', `/api/admin/orders/${o.id}/notes`, { body: 'Pago recibido por Nequi' }).expect(201);
  r = await admin.get(`/api/admin/orders/${o.id}`).expect(200);
  assert.equal(r.body.order.history.length, 2);
  assert.equal(r.body.order.accessTokenHash, undefined);
  r = await admin.get('/api/admin/dashboard').expect(200);
  assert.equal(r.body.confirmedRevenue.today.total, 300000);
  assert.equal(r.body.paidRevenue.month.total, 300000);
  assert.equal(r.body.topProducts[0].units, 2);
  const csv = await admin.get('/api/admin/orders/export.csv').expect(200);
  assert.match(csv.text, /HS-\d{6}-/);
  assert.equal((await prisma.product.findUnique({ where: { id: data.product.id } })).salesCount, 2);
});

test('ajustes de la tienda validados y públicos', async () => {
  await admin.send('put', '/api/admin/settings/whatsapp', { number: '3013223892' }).expect(400);
  await admin.send('put', '/api/admin/settings/announcement', { enabled: true, messages: ['ENVÍOS A TODO COLOMBIA'] }).expect(200);
  await admin.send('put', '/api/admin/settings/social', { instagram: 'javascript:alert(1)', tiktok: '' }).expect(400);
  const boot = await (await h.agent(app)).get('/api/bootstrap').expect(200);
  assert.deepEqual(boot.body.settings.announcement.messages, ['ENVÍOS A TODO COLOMBIA']);
});

test('promover administradores solo desde el panel y con cuenta existente', async () => {
  await admin.send('post', '/api/admin/admins', { email: 'nadie@example.com', confirm: true }).expect(404);
  await admin.send('post', '/api/admin/admins', { email: 'cliente@example.com', confirm: true }).expect(200);
  const u = await prisma.user.findUnique({ where: { email: 'cliente@example.com' } });
  assert.equal(u.role, 'ADMIN');
  const me = await prisma.user.findUnique({ where: { email: 'admin@example.com' } });
  await admin.send('delete', `/api/admin/admins/${me.id}`).expect(400); // no puede quitarse a sí mismo
});
