// Cancela pedidos pendientes con reserva vencida y devuelve el inventario.
// El servidor ya lo hace cada 10 minutos; este comando sirve para ejecutarlo a mano o con cron.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });
const prisma = require('../src/config/prisma');
const { releaseExpiredOrders } = require('../src/services/order.service');

releaseExpiredOrders()
  .then((n) => console.log(`Pedidos liberados: ${n}`))
  .catch((e) => { console.error(e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
