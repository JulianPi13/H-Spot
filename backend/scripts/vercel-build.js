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

const missing = ['DATABASE_URL', 'DIRECT_URL'].filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`\nFALTA ${missing.join(' y ')}: configúrala(s) en Vercel > Settings > Environment Variables (ver docs/PUBLICAR-EN-VERCEL.md, Paso 1).\n`);
  process.exit(1);
}
// Revisión de las direcciones de Supabase para fallar rápido y con un mensaje claro
function check(name, url) {
  let u;
  try { u = new URL(url); } catch { return `${name} no es una dirección válida. Cópiala de nuevo desde Supabase > Connect.`; }
  if (!/^postgres(ql)?:$/.test(u.protocol)) return `${name} debe empezar por postgresql://`;
  if (/\[YOUR-PASSWORD\]/i.test(url) || /YOUR-PASSWORD/i.test(decodeURIComponent(u.password || ''))) return `${name} todavía tiene [YOUR-PASSWORD]: cámbialo por tu contraseña de Supabase.`;
  if (/^db\..+\.supabase\.co$/.test(u.hostname)) return `${name} usa la conexión directa (db....supabase.co), que no funciona en Vercel. Usa la del "pooler" (contiene pooler.supabase.com).`;
  if (name === 'DIRECT_URL' && (u.port === '6543' || u.searchParams.has('pgbouncer'))) return 'DIRECT_URL debe ser la del "Session pooler" (puerto 5432) y sin ?pgbouncer=true. Con el puerto 6543 la creación de tablas se queda esperando para siempre.';
  if (name === 'DATABASE_URL' && u.port === '6543' && u.searchParams.get('pgbouncer') !== 'true') return 'A DATABASE_URL (puerto 6543) le falta ?pgbouncer=true&connection_limit=1 al final.';
  return null;
}
const problems = [check('DATABASE_URL', process.env.DATABASE_URL), check('DIRECT_URL', process.env.DIRECT_URL)].filter(Boolean);
if (problems.length) {
  console.error('\nREVISA LAS VARIABLES EN VERCEL (Settings > Environment Variables):');
  for (const p of problems) console.error(' - ' + p);
  console.error('');
  process.exit(1);
}

// Cada paso tiene tiempo máximo: si la base de datos no responde, el deploy falla en vez de quedarse esperando
const run = (cmd, label, minutes = 3) => {
  try {
    execSync(cmd, { cwd: ROOT, stdio: 'inherit', env: process.env, timeout: minutes * 60 * 1000 });
  } catch (err) {
    if (err.code === 'ETIMEDOUT' || err.signal === 'SIGTERM') {
      console.error(`\n${label} tardó más de ${minutes} minutos. Revisa DIRECT_URL (Session pooler, puerto 5432) y que el proyecto de Supabase no esté pausado.\n`);
    }
    process.exit(1);
  }
};
// Se genera aquí también por si el instalador de npm omitió el paso automático de Prisma
run('npx prisma generate', 'Generar Prisma', 3);
run('npx prisma migrate deploy', 'Crear/actualizar las tablas', 3);
run('node backend/prisma/seed.js', 'Cargar datos iniciales', 5);
console.log('Build de H-SPOT listo.');
