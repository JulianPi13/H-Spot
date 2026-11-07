// Crea el PRIMER administrador (o promueve una cuenta existente).
// Solo puede ejecutarlo alguien con acceso al servidor y a la base de datos:
// esa es la protección. El registro público nunca crea administradores.
//
// Uso interactivo:      npm run create-admin
// Uso en despliegue:    ADMIN_EMAIL=... ADMIN_NAME="..." ADMIN_PASSWORD=... npm run create-admin
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });
const readline = require('readline');
const argon2 = require('argon2');
const { PrismaClient } = require('@prisma/client');
const { HASH_OPTIONS } = require('../src/controllers/auth.controller');
const { register } = require('../src/validators/auth.validators');

const prisma = new PrismaClient();

function ask(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      rl._writeToOutput = (s) => { if (s.includes(question)) rl.output.write(s); else rl.output.write('*'); };
    }
    rl.question(question, (answer) => { rl.close(); if (hidden) process.stdout.write('\n'); resolve(answer.trim()); });
  });
}

async function main() {
  console.log('\n=== Crear administrador de H-SPOT ===\n');
  const email = (process.env.ADMIN_EMAIL || await ask('Correo: ')).toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    if (existing.role === 'ADMIN') { console.log('Esa cuenta ya es administradora.'); return; }
    const ok = process.env.ADMIN_EMAIL ? 's' : await ask(`La cuenta de ${existing.fullName} existe. ¿Convertirla en administradora? (s/n): `);
    if (ok.toLowerCase() !== 's') { console.log('Cancelado.'); return; }
    await prisma.user.update({ where: { id: existing.id }, data: { role: 'ADMIN' } });
    await prisma.auditLog.create({ data: { action: 'ADMIN_PROMOVIDO_CLI', entity: 'User', entityId: String(existing.id) } });
    console.log('Listo: la cuenta ahora es administradora.');
    return;
  }

  const fullName = process.env.ADMIN_NAME || await ask('Nombre completo: ');
  const password = process.env.ADMIN_PASSWORD || await ask('Contraseña (mín. 8, letras y números): ', true);
  const confirmPassword = process.env.ADMIN_PASSWORD || await ask('Repite la contraseña: ', true);

  const parsed = register.safeParse({ fullName, email, password, confirmPassword, acceptPolicy: true });
  if (!parsed.success) {
    console.error('\nDatos inválidos:');
    for (const i of parsed.error.issues) console.error(' -', i.message);
    process.exitCode = 1;
    return;
  }
  const user = await prisma.user.create({
    data: { fullName: parsed.data.fullName, email, passwordHash: await argon2.hash(password, HASH_OPTIONS), role: 'ADMIN', dataPolicyAcceptedAt: new Date(), emailVerifiedAt: new Date() },
  });
  await prisma.auditLog.create({ data: { action: 'ADMIN_CREADO_CLI', entity: 'User', entityId: String(user.id) } });
  console.log(`\nAdministrador creado: ${user.email}. Entra en /login y luego a /admin.`);
}

main().catch((e) => { console.error(e.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
