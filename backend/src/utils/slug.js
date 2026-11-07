// Convierte "Hoodie Oversize Ñandú" en "hoodie-oversize-nandu"
function slugify(text) {
  return String(text)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}
module.exports = { slugify };
