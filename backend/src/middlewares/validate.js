// Valida req.body / req.query con un esquema Zod y devuelve errores por campo.
const { badRequest } = require('../utils/errors');

function zodToFieldErrors(error) {
  const fields = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    return next(badRequest('Revisa los datos marcados.', zodToFieldErrors(result.error)));
  }
  req.valid = req.valid || {};
  req.valid[source] = result.data;
  next();
};

module.exports = { validate, zodToFieldErrors };
