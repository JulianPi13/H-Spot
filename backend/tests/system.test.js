// Pruebas de las rutas pensadas para Vercel: configuración inicial y tarea programada.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

process.env.SETUP_TOKEN = 'clave-setup-de-prueba-muy-larga-123';
process.env.CRON_SECRET = 'cron-secreto-de-prueba';
h.migrate();
const prisma = require('../src/config/prisma');
const { createApp } = require('../src/app');

let app;
before(async () => { app = createApp(); await h.resetDb(prisma); });
after(async () => { await prisma.$disconnect(); });

test('primer administrador desde /configuracion-inicial: clave obligatoria y un solo uso', async () => {
  const a = await h.agent(app);
  assert.equal((await a.get('/api/setup/status').expect(200)).body.enabled, true);
  const body = { fullName: 'Dueño Tienda', email: 'dueno@example.com', password: 'Clave12345', confirmPassword: 'Clave12345' };
  await a.send('post', '/api/setup/admin', { ...body, setupToken: 'incorrecta' }).expect(403);
  await a.send('post', '/api/setup/admin', { ...body, setupToken: process.env.SETUP_TOKEN }).expect(201);
  const u = await prisma.user.findUnique({ where: { email: 'dueno@example.com' } });
  assert.equal(u.role, 'ADMIN');
  assert.equal((await a.get('/api/setup/status').expect(200)).body.enabled, false);
  await a.send('post', '/api/setup/admin', { ...body, email: 'otro@example.com', setupToken: process.env.SETUP_TOKEN }).expect(404);
});

test('tarea programada: exige la clave y libera reservas vencidas', async () => {
  const a = await h.agent(app);
  await a.get('/api/cron/release-expired').expect(403);
  await a.get('/api/cron/release-expired').set('Authorization', 'Bearer otra').expect(403);
  const r = await a.get('/api/cron/release-expired').set('Authorization', `Bearer ${process.env.CRON_SECRET}`).expect(200);
  assert.equal(r.body.ok, true);
});
