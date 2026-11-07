// Punto de entrada para Vercel: toda la tienda (API + páginas) corre como una función.
// Los archivos estáticos (css, js, fuentes, iconos) los sirve la CDN de Vercel desde public/.
const { createApp } = require('../backend/src/app');

module.exports = createApp();
