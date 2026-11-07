// Rutas del panel administrativo. TODAS pasan por requireAdmin (verificado en el servidor).
const express = require('express');
const { asyncHandler: h } = require('../utils/errors');
const { validate } = require('../middlewares/validate');
const { requireAdmin } = require('../middlewares/auth');
const { imageUpload } = require('../middlewares/upload');
const v = require('../validators/admin.validators');
const products = require('../controllers/admin/products.controller');
const orders = require('../controllers/admin/orders.controller');
const dashboard = require('../controllers/admin/dashboard.controller');
const customers = require('../controllers/admin/customers.controller');
const store = require('../controllers/admin/store.controller');

const r = express.Router();
r.use(requireAdmin);

r.get('/dashboard', h(dashboard.stats));

// Productos
r.get('/products', h(products.list));
r.post('/products', validate(v.product), h(products.create));
r.get('/products/:id', h(products.get));
r.put('/products/:id', validate(v.product), h(products.update));
r.delete('/products/:id', h(products.remove));
r.get('/products/:id/movements', h(products.movements));
r.post('/products/:id/variants', validate(v.variant), h(products.addVariant));
r.patch('/variants/:variantId', validate(v.variantUpdate), h(products.updateVariant));
r.delete('/variants/:variantId', h(products.deleteVariant));
r.post('/variants/:variantId/stock', validate(v.stockAdjust), h(products.adjustStock));
r.post('/products/:id/images', imageUpload.array('images', 10), h(products.uploadImages));
r.put('/products/:id/images/order', validate(v.imageOrder), h(products.reorderImages));
r.put('/images/:imageId/file', imageUpload.single('image'), h(products.replaceImage));
r.patch('/images/:imageId', validate(v.imageMeta), h(products.updateImage));
r.delete('/images/:imageId', h(products.deleteImage));

// Pedidos
r.get('/orders', h(orders.list));
r.get('/orders/export.csv', h(orders.exportCsv));
r.get('/orders/:id', h(orders.get));
r.post('/orders/:id/status', validate(v.orderStatus), h(orders.updateStatus));
r.post('/orders/:id/payment', validate(v.paymentStatus), h(orders.updatePayment));
r.post('/orders/:id/notes', validate(v.orderNote), h(orders.addNote));

// Clientes
r.get('/customers', h(customers.list));
r.get('/customers/:id', h(customers.get));
r.post('/customers/:id/status', validate(v.userStatus), h(customers.setStatus));

// Catálogo y comercio
const mount = (path, ctrl, schema) => {
  r.get(path, h(ctrl.list));
  r.post(path, validate(schema), h(ctrl.create));
  r.put(`${path}/:id`, validate(schema), h(ctrl.update));
  r.delete(`${path}/:id`, h(ctrl.remove));
};
mount('/categories', store.categories, v.category);
mount('/collections', store.collections, v.collection);
mount('/shipping-methods', store.shipping, v.shipping);
mount('/promotions', store.promotions, v.promotion);

// Ajustes de la tienda
r.get('/settings', h(store.getSettings));
r.put('/settings/:key', h(store.updateSetting));
r.post('/uploads/site-image', imageUpload.single('image'), h(store.uploadSiteImage));

// Administradores, auditoría y newsletter
r.get('/admins', h(store.listAdmins));
r.post('/admins', validate(v.promoteAdmin), h(store.promoteAdmin));
r.delete('/admins/:id', h(store.demoteAdmin));
r.get('/audit-logs', h(store.auditLogs));
r.get('/newsletter', h(store.newsletter));

module.exports = r;
