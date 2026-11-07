// Preparación de las pruebas automáticas.
// Usan una base de datos SEPARADA (por defecto: el nombre de tu base + "_test"),
// para no tocar los datos reales. Puedes fijarla con TEST_DATABASE_URL en .env.
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const dotenv = require('dotenv');

const envFile = path.join(__dirname, '..', '..', '.env');
const fileEnv = fs.existsSync(envFile) ? dotenv.parse(fs.readFileSync(envFile)) : {};
const baseUrl = process.env.TEST_DATABASE_URL || fileEnv.TEST_DATABASE_URL
  || (fileEnv.DATABASE_URL || process.env.DATABASE_URL || '').replace(/\/([^/?]+)(\?|$)/, (m, db, q) => `/${db}_test${q}`);
if (!baseUrl || !/_test/.test(baseUrl)) throw new Error('Configura TEST_DATABASE_URL (debe contener "_test").');

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = baseUrl;
// Para probar con un "pooler" (como Supabase) puedes separar la conexión de migraciones
process.env.DIRECT_URL = process.env.TEST_DIRECT_URL || fileEnv.TEST_DIRECT_URL || baseUrl;
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test_secret_' + 'x'.repeat(40);
process.env.SMTP_HOST = '';
process.env.DEV_PRINT_EMAIL_LINKS = 'false';
process.env.APP_URL = 'http://localhost:3000';
process.env.CORS_ORIGINS = 'http://localhost:3000';

let migrated = false;
function migrate() {
  if (migrated) return;
  execSync('npx prisma migrate deploy', { cwd: path.join(__dirname, '..', '..'), env: process.env, stdio: 'pipe' });
  migrated = true;
}

const request = require('supertest');
const argon2 = require('argon2');

async function resetDb(prisma) {
  const tables = await prisma.$queryRawUnsafe("SELECT tablename AS t FROM pg_tables WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations'");
  if (tables.length) await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map(({ t }) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`);
}

// Catálogo mínimo para las pruebas
async function seedCatalog(prisma) {
  const cat = await prisma.category.create({ data: { name: 'Hoodies', slug: 'hoodies' } });
  const product = await prisma.product.create({
    data: { name: 'Hoodie Prueba', slug: 'hoodie-prueba', description: 'Hoodie de prueba para tests.', price: 150000, categoryId: cat.id, isNew: true },
  });
  const v1 = await prisma.productVariant.create({ data: { productId: product.id, sku: 'T-NEG-M', size: 'M', color: 'Negro', colorHex: '#000000', stock: 5 } });
  const v2 = await prisma.productVariant.create({ data: { productId: product.id, sku: 'T-NEG-L', size: 'L', color: 'Negro', colorHex: '#000000', stock: 1 } });
  const v3 = await prisma.productVariant.create({ data: { productId: product.id, sku: 'T-NEG-XL', size: 'XL', color: 'Negro', colorHex: '#000000', stock: 0 } });
  return { cat, product, v1, v2, v3 };
}

// Agente con cookies + token CSRF (simula un navegador)
async function agent(app) {
  const a = request.agent(app);
  const boot = await a.get('/api/bootstrap').expect(200);
  a.csrf = boot.body.csrfToken;
  a.send = (method, url, body) => a[method](url).set('X-CSRF-Token', a.csrf).send(body);
  return a;
}

async function createUser(prisma, { email, password = 'Clave12345', role = 'CUSTOMER', fullName = 'Usuario Prueba' }) {
  return prisma.user.create({ data: { email, fullName, role, passwordHash: await argon2.hash(password), dataPolicyAcceptedAt: new Date() } });
}

async function login(app, email, password = 'Clave12345') {
  const a = await agent(app);
  const r = await a.send('post', '/api/auth/login', { email, password }).expect(200);
  a.csrf = r.body.csrfToken;
  return a;
}

let counter = 0;
const key = () => `testkey${Date.now()}${(counter++).toString().padStart(6, '0')}`;

const checkoutBody = (items, extra = {}) => ({
  idempotencyKey: key(), items,
  fullName: 'Cliente Prueba', phone: '3001234567', email: 'cliente@example.com',
  department: 'Santander', city: 'Bucaramanga', address: 'Calle 1 # 2-3',
  acceptPolicy: true, confirmData: true, ...extra,
});

module.exports = { migrate, resetDb, seedCatalog, agent, createUser, login, checkoutBody, key };
