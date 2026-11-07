// Utilidades para dinero en COP. Prisma devuelve Decimal; aquí convertimos con cuidado.
const { Prisma } = require('@prisma/client');

const D = (v) => new Prisma.Decimal(v ?? 0);

// Convierte un Decimal a número entero de pesos para enviarlo al frontend.
// En COP no se usan centavos en la práctica, así que redondeamos a pesos.
const toNumber = (v) => (v === null || v === undefined ? null : Math.round(Number(new Prisma.Decimal(v).toFixed(2))));

const formatCOP = (v) =>
  '$' + new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(toNumber(v) || 0);

module.exports = { D, toNumber, formatCOP };
