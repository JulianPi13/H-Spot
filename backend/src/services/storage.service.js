// Almacenamiento de imágenes. Funciona de dos formas, sin cambiar nada más del código:
//  - En Vercel (o donde exista BLOB_READ_WRITE_TOKEN): Vercel Blob, un servicio de archivos
//    permanente. Necesario porque Vercel borra los archivos del disco del servidor.
//  - En tu computador o en un VPS: carpeta backend/uploads, servida en /uploads.
const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');
const { UPLOADS } = require('../config/paths');
const { randomToken } = require('../utils/tokens');
const { badRequest } = require('../utils/errors');

const useBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

// Comprueba que el archivo de verdad sea una imagen, la reduce (máx. 1600 px) y la pasa a WebP
async function toWebp(buffer) {
  let meta;
  try {
    meta = await sharp(buffer).metadata();
  } catch {
    throw badRequest('El archivo no es una imagen válida.');
  }
  if (!['jpeg', 'png', 'webp', 'avif', 'heif'].includes(meta.format)) {
    throw badRequest('Formato de imagen no permitido.');
  }
  return sharp(buffer)
    .rotate()
    .resize({ width: 1600, height: 2000, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
}

// Guarda un WebP ya procesado. Devuelve la URL pública y la clave para borrarlo luego.
async function storeWebp(webpBuffer, folder, fileName) {
  const name = fileName || `${Date.now()}-${randomToken(8)}.webp`;
  if (useBlob()) {
    const { put } = require('@vercel/blob');
    const blob = await put(`${folder}/${name}`, webpBuffer, {
      access: 'public', contentType: 'image/webp', addRandomSuffix: !fileName, allowOverwrite: Boolean(fileName),
    });
    return { url: blob.url, storageKey: blob.url };
  }
  const dir = path.join(UPLOADS, folder);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), webpBuffer);
  const storageKey = `${folder}/${name}`;
  return { url: `/uploads/${storageKey}`, storageKey };
}

async function saveImage(buffer, folder = 'products') {
  return storeWebp(await toWebp(buffer), folder);
}

async function deleteImage(storageKey) {
  if (!storageKey) return;
  try {
    if (/^https:\/\//.test(storageKey)) {
      if (!useBlob()) return;
      const { del } = require('@vercel/blob');
      await del(storageKey);
      return;
    }
    if (storageKey.includes('..')) return;
    await fs.unlink(path.join(UPLOADS, storageKey));
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('[STORAGE] No se pudo borrar la imagen:', err.message);
  }
}

module.exports = { saveImage, deleteImage, storeWebp, toWebp, useBlob };
