// Construye la aplicación Express (separada de server.js para poder probarla).
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const env = require('./config/env');
const { FRONTEND, UPLOADS } = require('./config/paths');
const { sessionMiddleware } = require('./middlewares/session');
const { csrfProtection } = require('./middlewares/csrf');
const { loadUser } = require('./middlewares/auth');
const { apiLimiter } = require('./middlewares/rateLimits');
const { errorHandler, notFoundApi } = require('./middlewares/errorHandler');
const pages = require('./pages');

function mountStatic(app) {
  app.use('/uploads', express.static(UPLOADS, { maxAge: '30d', immutable: true, index: false, dotfiles: 'deny' }));
  app.use('/assets', express.static(path.join(FRONTEND, 'assets'), { maxAge: env.isProduction ? '7d' : 0, index: false }));
  app.use('/css', express.static(path.join(FRONTEND, 'css'), { maxAge: env.isProduction ? '1d' : 0, index: false }));
  app.use('/js', express.static(path.join(FRONTEND, 'js'), { maxAge: env.isProduction ? '1d' : 0, index: false }));
  app.use('/admin-assets', express.static(path.join(FRONTEND, 'admin'), { maxAge: 0, index: false }));

}

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (env.isProduction || env.isVercel) app.set('trust proxy', 1); // detrás de Nginx / Vercel con HTTPS

  // Cabeceras de seguridad (incluye una política de contenido estricta)
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'"],
        // Permite atributos style="" (colores de muestras, etc.). No permite <style> ni scripts en línea.
        'style-src-attr': ["'unsafe-inline'"],
        // *.public.blob.vercel-storage.com = fotos guardadas en Vercel Blob
        'img-src': ["'self'", 'data:', 'blob:', 'https://*.public.blob.vercel-storage.com'],
        'font-src': ["'self'"],
        'connect-src': ["'self'"],
        'frame-ancestors': ["'none'"],
        'form-action': ["'self'"],
        'upgrade-insecure-requests': env.isProduction ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: env.isProduction ? { maxAge: 15552000, includeSubDomains: true } : false,
  }));

  // CORS restrictivo: solo los orígenes de .env pueden llamar a la API con cookies
  app.use('/api', cors({
    origin(origin, cb) {
      if (!origin || env.CORS_ORIGINS.includes(origin)) return cb(null, true);
      cb(null, false);
    },
    credentials: true,
  }));

  app.use(express.json({ limit: '200kb' }));
  app.use(express.urlencoded({ extended: false, limit: '50kb' }));

  // Archivos estáticos (en Vercel los sirve su CDN desde public/, y express.static no se usa)
  if (!env.isVercel) mountStatic(app);

  // API
  app.use('/api', apiLimiter, sessionMiddleware, loadUser, csrfProtection);
  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.use('/api', require('./routes/public.routes'));
  app.use('/api', require('./routes/auth.routes'));
  app.use('/api', require('./routes/system.routes'));
  app.use('/api/admin', require('./routes/admin.routes'));
  app.use('/api', notFoundApi);

  // Páginas HTML (URLs bonitas, SEO, sitemap, 404)
  app.use(pages);

  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
