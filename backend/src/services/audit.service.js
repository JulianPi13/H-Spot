// Bitácora de auditoría: registra acciones administrativas importantes.
const prisma = require('../config/prisma');

async function audit(req, action, entity, entityId, details) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: req.user ? req.user.id : null,
        action, entity,
        entityId: entityId !== undefined && entityId !== null ? String(entityId) : null,
        details: details || undefined,
        ip: req.ip ? String(req.ip).slice(0, 64) : null,
      },
    });
  } catch (err) {
    console.error('[AUDIT] No se pudo registrar la acción:', err.message);
  }
}

module.exports = { audit };
