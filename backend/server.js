// Punto de entrada: inicia el servidor y las tareas periódicas.
const env = require('./src/config/env');
const prisma = require('./src/config/prisma');
const { createApp } = require('./src/app');
const { releaseExpiredOrders } = require('./src/services/order.service');
const { purgeExpiredSessions } = require('./src/middlewares/session');

async function main() {
  await prisma.$connect();
  const app = createApp();
  const server = app.listen(env.PORT, () => {
    console.log(`H-SPOT listo en ${env.APP_URL} (puerto ${env.PORT}, modo ${env.NODE_ENV})`);
    console.log(env.mailConfigured ? 'Correo: SMTP configurado.' : 'Correo: SMTP NO configurado (recuperación de contraseña deshabilitada).');
  });

  // Cada 10 minutos: libera reservas vencidas y limpia sesiones viejas
  const tick = async () => {
    try {
      const n = await releaseExpiredOrders();
      if (n) console.log(`[PEDIDOS] ${n} pedido(s) cancelados por reserva vencida; inventario liberado.`);
      await purgeExpiredSessions();
    } catch (err) { console.error('[TAREAS]', err.message); }
  };
  setTimeout(tick, 5000);
  const timer = setInterval(tick, 10 * 60 * 1000);

  const shutdown = async () => {
    clearInterval(timer);
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('No se pudo iniciar el servidor:', err.message);
  process.exit(1);
});
