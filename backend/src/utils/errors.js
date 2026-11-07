// Error "controlado": lleva un código HTTP y un mensaje que sí podemos mostrar al usuario.
class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details; // por ejemplo: errores por campo { email: '...' }
    this.expose = true;
  }
}

const badRequest = (msg, details) => new AppError(400, msg, details);
const unauthorized = (msg = 'Debes iniciar sesión.') => new AppError(401, msg);
const forbidden = (msg = 'No tienes permiso para realizar esta acción.') => new AppError(403, msg);
const notFound = (msg = 'Recurso no encontrado.') => new AppError(404, msg);
const conflict = (msg, details) => new AppError(409, msg, details);

// Envuelve funciones async para que los errores lleguen al manejador central.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { AppError, badRequest, unauthorized, forbidden, notFound, conflict, asyncHandler };
