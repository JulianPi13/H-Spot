// Manejador central de errores. En producción nunca muestra detalles internos.
const env = require('../config/env');

function notFoundApi(req, res) {
  res.status(404).json({ error: 'Ruta de la API no encontrada.' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Errores conocidos de librerías
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: `La imagen supera el tamaño máximo de ${env.MAX_UPLOAD_MB} MB.` });
  }
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'La solicitud es demasiado grande.' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Formato de datos inválido.' });
  if (err.code === 'P2002') {
    return res.status(409).json({ error: 'Ya existe un registro con ese valor único.', fields: { [String(err.meta?.target || '_')]: 'Valor repetido' } });
  }
  if (err.code === 'P2025') return res.status(404).json({ error: 'Recurso no encontrado.' });

  const status = err.status || 500;
  if (status >= 500) {
    // Registramos solo lo necesario (sin contraseñas ni datos personales del body)
    console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, err.message);
    if (!env.isProduction) console.error(err.stack);
  }
  const body = { error: err.expose || status < 500 ? err.message : 'Ocurrió un error inesperado. Intenta de nuevo.' };
  if (err.details) body.fields = err.details;
  res.status(status).json(body);
}

module.exports = { errorHandler, notFoundApi };
