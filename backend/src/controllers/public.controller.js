// Información pública de la tienda: ajustes, departamentos, newsletter, CSRF.
const prisma = require('../config/prisma');
const { getAllSettings } = require('../services/settings.service');
const { DEPARTAMENTOS } = require('../utils/colombia');
const { ensureCsrfToken } = require('../middlewares/csrf');
const { publicUser } = require('./auth.controller');

async function bootstrap(req, res) {
  const csrfToken = ensureCsrfToken(req);
  const [settings, categories, collections] = await Promise.all([
    getAllSettings(),
    prisma.category.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' }, select: { name: true, slug: true, imageUrl: true, description: true } }),
    prisma.collection.findMany({ where: { active: true }, orderBy: { createdAt: 'desc' }, select: { name: true, slug: true, isDrop: true } }),
  ]);
  res.json({ csrfToken, user: publicUser(req.user), settings, categories, collections, departamentos: DEPARTAMENTOS });
}

async function subscribe(req, res) {
  const { email } = req.valid.body;
  await prisma.newsletterSubscriber.upsert({ where: { email }, update: {}, create: { email, consentAt: new Date() } });
  res.json({ message: 'Gracias. Te avisaremos de los próximos lanzamientos.' });
}

module.exports = { bootstrap, subscribe };
