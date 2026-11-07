import { html, setHTML, icon, cop, fmtDate, $ } from '/js/core/dom.js';
import { api } from '/js/core/api.js';
import { st, pager, qs, STATUS, PAY } from '../ui.js';

export async function render(root, { query }) {
  const f = { q: query.get('q') || '', estado: query.get('estado') || '', pago: query.get('pago') || '', desde: query.get('desde') || '', hasta: query.get('hasta') || '', page: query.get('page') || 1 };
  const data = await api('/admin/orders?' + qs(f));
  const exportUrl = '/api/admin/orders/export.csv?' + qs({ ...f, page: '' });
  setHTML(root, html`
    <form class="toolbar" data-filters>
      <input class="input grow" type="search" name="q" value="${f.q}" placeholder="Buscar por número, cliente, correo o teléfono" aria-label="Buscar pedidos">
      <select class="select" name="estado" aria-label="Estado"><option value="">Todos los estados</option>${Object.entries(STATUS).map(([k, v]) => html`<option value="${k}" ${f.estado === k ? html`selected` : ''}>${v}</option>`)}</select>
      <select class="select" name="pago" aria-label="Pago"><option value="">Pago: todos</option>${Object.entries(PAY).map(([k, v]) => html`<option value="${k}" ${f.pago === k ? html`selected` : ''}>${v}</option>`)}</select>
      <input class="input" type="date" name="desde" value="${f.desde}" aria-label="Desde">
      <input class="input" type="date" name="hasta" value="${f.hasta}" aria-label="Hasta">
      <button class="btn btn-sm" type="submit">${icon('search', 'icon-sm')} Filtrar</button>
      <a class="btn btn-outline btn-sm" href="${exportUrl}" download>${icon('file-down', 'icon-sm')} Exportar CSV</a>
    </form>
    ${data.items.length ? html`<div class="table-wrap"><table class="tbl">
      <thead><tr><th>Pedido</th><th>Fecha</th><th>Cliente</th><th>Ciudad</th><th>Estado</th><th>Pago preferido</th><th>Estado de pago</th><th class="num">Total</th></tr></thead>
      <tbody>${data.items.map((o) => html`<tr>
        <td><a class="rowlink mono" href="#/pedidos/${o.id}">${o.orderNumber}</a></td><td>${fmtDate(o.createdAt, true)}</td>
        <td>${o.customerName}${o.userId ? html` <span class="badge badge-muted">Cuenta</span>` : ''}</td><td>${o.city}</td>
        <td>${st(o.status, o.statusLabel)}</td><td>${o.paymentMethod || html`<span class="muted">—</span>`}</td><td>${st(o.paymentStatus, PAY[o.paymentStatus])}</td><td class="num">${cop(o.total)}</td></tr>`)}
      </tbody></table></div>${pager(data.page, data.pages, data.total)}` : html`<div class="empty">${icon('package', 'icon-lg')}<h2 class="h3">Sin pedidos</h2><p>No hay pedidos con estos filtros.</p></div>`}`);

  $('[data-filters]', root).addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    location.hash = '#/pedidos?' + qs(fd);
  });
  root.querySelectorAll('[data-page]').forEach((b) => b.addEventListener('click', () => { location.hash = '#/pedidos?' + qs({ ...f, page: b.dataset.page }); }));
}
