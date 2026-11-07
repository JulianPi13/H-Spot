import { html, setHTML, cop, fmtDate } from '/js/core/dom.js';
import { crudSection } from '../crud.js';
import { bool } from '../ui.js';

export async function render(root) {
  setHTML(root, html`<div data-ship></div><div data-promo style="margin-top:16px"></div>`);
  await crudSection(root.querySelector('[data-ship]'), {
    title: 'Métodos y tarifas de envío', singular: 'método de envío', newLabel: 'Nuevo método', endpoint: '/admin/shipping-methods',
    empty: 'No hay tarifas configuradas: el checkout mostrará "envío por confirmar" y lo acordarás por WhatsApp.',
    help: 'Usa tus tarifas reales. El umbral de envío gratis se configura en Configuración > Checkout.',
    columns: [{ label: 'Nombre', key: 'name' }, { label: 'Descripción', render: (s) => s.description || '—' }, { label: 'Tarifa', num: true, render: (s) => cop(s.price) }, { label: 'Activo', render: (s) => bool(s.active) }],
    fields: [
      { name: 'name', label: 'Nombre', required: true, placeholder: 'Envío nacional' }, { name: 'price', label: 'Tarifa (COP)', type: 'number', required: true },
      { name: 'description', label: 'Descripción', type: 'textarea', full: true, max: 200 },
      { name: 'sortOrder', label: 'Orden', type: 'number', default: 0 }, { name: 'active', label: 'Activo', type: 'checkbox' },
    ],
  });
  await crudSection(root.querySelector('[data-promo]'), {
    title: 'Códigos promocionales', singular: 'código', newLabel: 'Nuevo código', endpoint: '/admin/promotions',
    empty: 'No hay códigos promocionales.',
    columns: [
      { label: 'Código', render: (p) => html`<span class="mono">${p.code}</span>` },
      { label: 'Descuento', render: (p) => (p.type === 'PORCENTAJE' ? `${p.value}%` : cop(p.value)) },
      { label: 'Compra mín.', render: (p) => (p.minSubtotal ? cop(p.minSubtotal) : '—') },
      { label: 'Vigencia', render: (p) => `${p.startsAt ? fmtDate(p.startsAt) : '—'} a ${p.endsAt ? fmtDate(p.endsAt) : '—'}` },
      { label: 'Usos', num: true, render: (p) => `${p.usedCount}${p.maxUses ? ` / ${p.maxUses}` : ''}` },
      { label: 'Activo', render: (p) => bool(p.active) },
    ],
    fields: [
      { name: 'code', label: 'Código', required: true, placeholder: 'DROP10' },
      { name: 'type', label: 'Tipo', type: 'select', options: [['PORCENTAJE', 'Porcentaje (%)'], ['VALOR_FIJO', 'Valor fijo (COP)']], default: 'PORCENTAJE' },
      { name: 'value', label: 'Valor', type: 'number', required: true }, { name: 'minSubtotal', label: 'Compra mínima (COP)', type: 'number' },
      { name: 'startsAt', label: 'Desde', type: 'date' }, { name: 'endsAt', label: 'Hasta', type: 'date' },
      { name: 'maxUses', label: 'Máximo de usos', type: 'number' }, { name: 'description', label: 'Descripción interna' },
      { name: 'active', label: 'Activo', type: 'checkbox' },
    ],
  });
}
