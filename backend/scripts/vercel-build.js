// Se ejecuta automáticamente en Vercel cada vez que se publica (npm run vercel-build):
// 1. Copia los archivos estáticos de frontend/ a public/ (Vercel los sirve por su CDN).
// 2. Aplica las migraciones de la base de datos (crea o actualiza las tablas).
// 3. Carga los datos base y, si SEED_DEMO no es "false", los productos de demostración
//    (solo la primera vez: si ya hay productos, no crea nada).
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true }); // solo en tu PC; en Vercel no existe .env

const ROOT = path.join(__dirname, '..', '..');
const FRONT = path.join(ROOT, 'frontend');
const OUT = path.join(ROOT, 'public');

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const dir of ['css', 'js', 'assets']) fs.cpSync(path.join(FRONT, dir), path.join(OUT, dir), { recursive: true });
fs.cpSync(path.join(FRONT, 'admin'), path.join(OUT, 'admin-assets'), { recursive: true, filter: (src) => !src.endsWith('index.html') });
console.log('Archivos estáticos copiados a public/.');

if (!process.env.DATABASE_URL) {
  console.error('\nFALTA DATABASE_URL: configúrala en Vercel > Settings > Environment Variables.\n');
  process.exit(1);
}
const run = (cmd) => execSync(cmd, { cwd: ROOT, stdio: 'inherit', env: process.env });
run('npx prisma migrate deploy');
run('node backend/prisma/seed.js');
console.log('Build de H-SPOT listo.');
