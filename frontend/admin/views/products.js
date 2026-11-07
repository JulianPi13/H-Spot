import { html, setHTML, icon, cop, fmtDate, $ } from '/js/core/dom.js';
import { api } from '/js/core/api.js';
import { pager, qs, bool } from '../ui.js';

export async function render(root, { query, topActions }) {
  const f = { q: query.get('q') || '', estado: query.get('estado') || '', stock: query.get('stock') || '', categoria: query.get('categoria') || '', page: query.get('page') || 1 };
  const [data, cats] = await Promise.all([api('/admin/products?' + qs(f)), api('/admin/categories')]);
  setHTML(topActions, html`<a class="btn btn-sm" href="#/productos/nuevo">${icon('plus', 'icon-sm')} Nuevo producto</a>`);
  setHTML(root, html`
    <form class="toolbar" data-filters>
      <input class="input grow" type="search" name="q" value="${f.q}" placeholder="Buscar por nombre o SKU" aria-label="Buscar productos">
      <select class="select" name="categoria" aria-label="Categoría"><option value="">Todas las categorías</option>${cats.items.map((c) => html`<option value="${c.id}" ${String(c.id) === f.categoria ? html`selected` : ''}>${c.name}</option>`)}</select>
      <select class="select" name="estado" aria-label="Estado"><option value="">Activos e inactivos</option><option value="activos" ${f.estado === 'activos' ? html`selected` : ''}>Activos</option><option value="inactivos" ${f.estado === 'inactivos' ? html`selected` : ''}>Inactivos</option></select>
      <select class="select" name="stock" aria-label="Inventario"><option value="">Todo el inventario</option><option value="bajo" ${f.stock === 'bajo' ? html`selected` : ''}>Stock bajo</option><option value="agotados" ${f.stock === 'agotados' ? html`selected` : ''}>Agotados</option></select>
      <button class="btn btn-sm" type="submit">Filtrar</button>
    </form>
    ${data.items.length ? html`<div class="table-wrap"><table class="tbl">
      <thead><tr><th></th><th>Producto</th><th>Categoría</th><th class="num">Precio</th><th class="num">Stock total</th><th>Activo</th><th>Etiquetas</th><th>Modificado</th></tr></thead>
      <tbody>${data.items.map((p) => html`<tr>
        <td>${p.images[0] ? html`<img src="${p.images[0].url}" alt="">` : ''}</td>
        <td><a class="rowlink" href="#/productos/${p.id}">${p.name}</a>${p.isDemo ? html` <span class="badge badge-demo">Demo</span>` : ''}</td>
        <td>${p.category.name}</td>
        <td class="num">${cop(p.price)}${p.compareAtPrice ? html`<br><span class="price-old" style="margin:0">${cop(p.compareAtPrice)}</span>` : ''}</td>
        <td class="num">${p.totalStock === 0 ? html`<span style="color:var(--danger)">Agotado</span>` : p.totalStock}</td>
        <td>${bool(p.active)}</td>
        <td>${p.featured ? html`<span class="badge">Destacado</span> ` : ''}${p.isNew ? html`<span class="badge">Nuevo</span> ` : ''}${p.isBestSeller ? html`<span class="badge">Best seller</span>` : ''}</td>
        <td class="small muted">${fmtDate(p.updatedAt)}</td></tr>`)}
      </tbody></table></div>${pager(data.page, data.pages, data.total)}`
    : html`<div class="empty">${icon('tag', 'icon-lg')}<h2 class="h3">Sin productos</h2><p>No hay productos con estos filtros.</p><a class="btn" href="#/productos/nuevo">Crear producto</a></div>`}`);
  $('[data-filters]', root).addEventListener('submit', (e) => { e.preventDefault(); location.hash = '#/productos?' + qs(Object.fromEntries(new FormData(e.target))); });
  root.querySelectorAll('[data-page]').forEach((b) => b.addEventListener('click', () => { location.hash = '#/productos?' + qs({ ...f, page: b.dataset.page }); }));
}
