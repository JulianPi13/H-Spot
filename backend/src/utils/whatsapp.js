// Construye el mensaje y el enlace oficial de WhatsApp (https://wa.me/NUMERO?text=...)
// SIEMPRE a partir del pedido guardado en la base de datos, nunca con datos del navegador.
const { formatCOP } = require('./money');

function buildOrderMessage(order, items) {
  const lines = [];
  lines.push('Hola H-SPOT, acabo de hacer un pedido en la tienda web.');
  lines.push('');
  lines.push(`Pedido: ${order.orderNumber}`);
  lines.push(`Cliente: ${order.customerName}`);
  lines.push('');
  lines.push('Productos:');
  for (const it of items) {
    lines.push(`- ${it.productName} | Talla ${it.size} | Color ${it.color} | Cant. ${it.quantity} x ${formatCOP(it.unitPrice)} = ${formatCOP(it.lineTotal)}`);
  }
  lines.push('');
  lines.push(`Subtotal: ${formatCOP(order.subtotal)}`);
  if (Number(order.discount) > 0) lines.push(`Descuento${order.promotionCode ? ' (' + order.promotionCode + ')' : ''}: -${formatCOP(order.discount)}`);
  if (order.shippingDefined) {
    lines.push(`Envío${order.shippingMethodName ? ' (' + order.shippingMethodName + ')' : ''}: ${Number(order.shippingCost) === 0 ? 'Gratis' : formatCOP(order.shippingCost)}`);
  } else {
    lines.push('Envío: por confirmar');
  }
  lines.push(`Total: ${formatCOP(order.total)}${order.shippingDefined ? '' : ' + envío'}`);
  lines.push('');
  lines.push(`Ciudad de entrega: ${order.city}, ${order.department}`);
  if (order.shareAddressWhatsapp) {
    lines.push(`Dirección: ${order.address}${order.neighborhood ? ', barrio ' + order.neighborhood : ''}`);
  }
  if (order.paymentMethod) lines.push(`Método de pago preferido: ${order.paymentMethod}`);
  lines.push('');
  lines.push('Quedo atento a la confirmación. Gracias.');
  return lines.join('\n');
}

function whatsappUrl(number, text) {
  const clean = String(number).replace(/\D/g, '');
  return `https://wa.me/${clean}${text ? '?text=' + encodeURIComponent(text) : ''}`;
}

module.exports = { buildOrderMessage, whatsappUrl };
