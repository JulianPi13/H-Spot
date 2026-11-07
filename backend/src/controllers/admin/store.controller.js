// Configuración de la tienda: categorías, colecciones, promociones, envíos, ajustes,
// administradores, bitácora de auditoría y suscriptores.
const prisma = require('../../config/prisma');
const { slugify } = require('../../utils/slug');
const { toNumber } = require('../../utils/money');
const { notFound, badRequest, conflict } = require('../../utils/errors');
const { audit } = require('../../services/audit.service');
const { getAllSettings, setSetting } = require('../../services/settings.service');
const { settings: settingsSchemas } = require('../../validators/admin.validators');
const { zodToFieldErrors } = require('../../middlewares/validate');
const { saveImage } = require('../../services/storage.service');
const { destroyUserSessions } = require('../../middlewares/session');
const { csvCell } = require('./orders.controller');

const num = (v) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw badRequest('Identificador inválido.');
  return n;
};

// Fábrica de CRUD sencillo para tablas pequeñas (categorías, colecciones, envíos, promociones)
function crud(model, { entity, withSlug = false, moneyFields = [], beforeDelete } = {}) {
  const ser = (row) => {
    const out = { ...row };
    for (const f of moneyFields) out[f] = toNumber(row[f]);
    return out;
  };
  return {
    async list(req, res) {
      const rows = await prisma[model].findMany({ orderBy: { id: 'asc' }, ...(model === 'category' || model === 'collection' ? { include: { _count: { select: { products: true } } } } : {}) });
      res.json({ items: rows.map(ser) });
    },
    async create(req, res) {
      const data = { ...req.valid.body };
      if (withSlug) data.slug = slugify(data.slug || data.name);
      try {
        const row = await prisma[model].create({ data });
        await audit(req, `${entity.toUpperCase()}_CREADO`, entity, row.id, { name: data.name || data.code });
        res.status(201).json({ item: ser(row) });
      } catch (err) {
        if (err.code === 'P2002') throw conflict('Ya existe un registro con ese nombre de enlace o código.');
        throw err;
      }
    },
    async update(req, res) {
      const id = num(req.params.id);
      const data = { ...req.valid.body };
      if (withSlug) data.slug = slugify(data.slug || data.name);
      try {
        const row = await prisma[model].update({ where: { id }, data });
        await audit(req, `${entity.toUpperCase()}_EDITADO`, entity, id, data);
        res.json({ item: ser(row) });
      } catch (err) {
        if (err.code === 'P2002') throw conflict('Ya existe un registro con ese nombre de enlace o código.');
        throw err;
      }
    },
    async remove(req, res) {
      const id = num(req.params.id);
      if (beforeDelete) await beforeDelete(id);
      await prisma[model].delete({ where: { id } });
      await audit(req, `${entity.toUpperCase()}_ELIMINADO`, entity, id);
      res.json({ ok: true });
    },
  };
}

const categories = crud('category', {
  entity: 'Category', withSlug: true,
  async beforeDelete(id) {
    const count = await prisma.product.count({ where: { categoryId: id } });
    if (count) throw badRequest(`La categoría tiene ${count} productos. Muévelos a otra categoría o desactívala.`);
  },
});
const collections = crud('collection', { entity: 'Collection', withSlug: true });
const shipping = crud('shippingMethod', { entity: 'ShippingMethod', moneyFields: ['price'] });
const promotions = crud('promotion', { entity: 'Promotion', moneyFields: ['value', 'minSubtotal'] });

// ---------- Ajustes ----------
async function getSettings(req, res) {
  res.json({ settings: await getAllSettings() });
}

async function updateSetting(req, res) {
  const key = req.params.key;
  const schema = settingsSchemas[key];
  if (!schema) throw notFound('Ajuste desconocido.');
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw badRequest('Revisa los datos marcados.', zodToFieldErrors(parsed.error));
  await setSetting(key, parsed.data);
  await audit(req, 'AJUSTE_EDITADO', 'StoreSetting', key);
  res.json({ settings: await getAllSettings() });
}

// Sube una imagen para banners, hero, logotipo, categorías...
async function uploadSiteImage(req, res) {
  if (!req.file) throw badRequest('Selecciona una imagen.');
  const saved = await saveImage(req.file.buffer, 'site');
  await audit(req, 'IMAGEN_SITIO_SUBIDA', 'Site', saved.storageKey);
  res.status(201).json({ url: saved.url });
}

// ---------- Administradores ----------
async function listAdmins(req, res) {
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true, fullName: true, email: true, status: true, createdAt: true, lastLoginAt: true } });
  res.json({ items: admins });
}

// Solo un administrador puede promover a otro, y el usuario ya debe tener cuenta.
async function promoteAdmin(req, res) {
  const { email } = req.valid.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw notFound('No existe una cuenta con ese correo. La persona debe registrarse primero.');
  if (user.role === 'ADMIN') return res.json({ message: 'Esa cuenta ya es administradora.' });
  await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });
  await destroyUserSessions(user.id); // debe volver a iniciar sesión con sus nuevos permisos
  await audit(req, 'ADMIN_PROMOVIDO', 'User', user.id, { email });
  res.json({ message: `${user.fullName} ahora es administrador.` });
}

async function demoteAdmin(req, res) {
  const id = num(req.params.id);
  if (id === req.user.id) throw badRequest('No puedes quitarte el rol de administrador a ti mismo.');
  const admins = await prisma.user.count({ where: { role: 'ADMIN', status: 'ACTIVE' } });
  if (admins <= 1) throw badRequest('Debe quedar al menos un administrador activo.');
  const user = await prisma.user.update({ where: { id }, data: { role: 'CUSTOMER' } });
  await destroyUserSessions(id);
  await audit(req, 'ADMIN_REVOCADO', 'User', id, { email: user.email });
  res.json({ message: 'Permisos de administrador retirados.' });
}

// ---------- Auditoría y newsletter ----------
async function auditLogs(req, res) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = 50;
  const [total, rows] = await Promise.all([
    prisma.auditLog.count(),
    prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit, include: { user: { select: { fullName: true, email: true } } } }),
  ]);
  res.json({ items: rows, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
}

async function newsletter(req, res) {
  const rows = await prisma.newsletterSubscriber.findMany({ orderBy: { createdAt: 'desc' } });
  if (req.query.formato === 'csv') {
    await audit(req, 'NEWSLETTER_EXPORTADO', 'NewsletterSubscriber', null, { count: rows.length });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="suscriptores-hspot.csv"');
    return res.send('﻿' + [['Correo', 'Consentimiento'].map(csvCell).join(','), ...rows.map((r) => [r.email, r.consentAt.toISOString()].map(csvCell).join(','))].join('\r\n'));
  }
  res.json({ items: rows, total: rows.length });
}

module.exports = {
  categories, collections, shipping, promotions,
  getSettings, updateSetting, uploadSiteImage,
  listAdmins, promoteAdmin, demoteAdmin, auditLogs, newsletter,
};
