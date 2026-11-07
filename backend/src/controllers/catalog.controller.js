const catalog = require('../services/catalog.service');
const { notFound } = require('../utils/errors');

async function list(req, res) {
  res.json(await catalog.listProducts(req.valid.query));
}
async function detail(req, res) {
  const product = await catalog.getProductBySlug(String(req.params.slug).slice(0, 140));
  if (!product) throw notFound('Producto no encontrado.');
  res.json({ product });
}
async function facets(req, res) {
  res.json(await catalog.getFacets());
}
async function home(req, res) {
  res.json(await catalog.getHomeData());
}
module.exports = { list, detail, facets, home };
