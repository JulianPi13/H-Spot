// Recibe imágenes subidas por el administrador (en memoria, para procesarlas con sharp).
// Solo acepta JPG, PNG, WebP y AVIF; rechaza cualquier otro tipo (ejecutables, etc.).
const multer = require('multer');
const path = require('path');
const env = require('../config/env');
const { badRequest } = require('../utils/errors');

const ALLOWED = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/avif': ['.avif'],
};

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 10 },
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const allowedExt = ALLOWED[file.mimetype];
    if (!allowedExt || !allowedExt.includes(ext)) {
      return cb(badRequest('Solo se permiten imágenes JPG, PNG, WebP o AVIF.'));
    }
    cb(null, true);
  },
});

module.exports = { imageUpload };
