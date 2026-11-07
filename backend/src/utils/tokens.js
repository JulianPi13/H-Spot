const crypto = require('crypto');

// Token aleatorio seguro (se entrega al usuario) y su hash (se guarda en la base de datos).
const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

// Comparación en tiempo constante para evitar ataques de temporización.
function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

// Número de pedido legible: HS-261107-7K3Q9
function orderNumber() {
  const d = new Date();
  const ymd = d.toISOString().slice(2, 10).replace(/-/g, '');
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  const bytes = crypto.randomBytes(5);
  for (const b of bytes) code += alphabet[b % alphabet.length];
  return `HS-${ymd}-${code}`;
}

module.exports = { randomToken, sha256, safeEqual, orderNumber };
