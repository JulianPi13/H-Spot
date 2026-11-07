import { html, setHTML, icon, fmtDate, $ } from '/js/core/dom.js';
import { api } from '/js/core/api.js';
import { pager, qs, st } from '../ui.js';

export async function render(root, { query }) {
  const tab = query.get('tab') || 'clientes';
  const f = { q: query.get('q') || '', page: query.get('page') || 1 };
  const tabs = html`<div class="tabs" role="tablist"><a href="#/clientes" role="tab" aria-selected="${tab === 'clientes'}">Clientes registrados</a><a href="#/clientes?tab=newsletter" role="tab" aria-selected="${tab === 'newsletter'}">Suscriptores newsletter</a></div>`;

  if (tab === 'newsletter') {
    const d = await api('/admin/newsletter');
    setHTML(root, html`${tabs}
      <div class="toolbar"><span class="muted">${d.total} suscriptor(es) con consentimiento</span><a class="btn btn-outline btn-sm" href="/api/admin/newsletter?formato=csv" download>${icon('file-down', 'icon-sm')} Exportar CSV</a></div>
      ${d.items.length ? html`<div class="table-wrap"><table class="tbl"><thead><tr><th>Correo</th><th>Consentimiento</th></tr></thead><tbody>${d.items.map((s) => html`<tr><td>${s.email}</td><td>${fmtDate(s.consentAt, true)}</td></tr>`)}</tbody></table></div>` : html`<p class="muted">Aún no hay suscriptores.</p>`}`);
    return;
  }

  const d = await api('/admin/customers?' + qs(f));
  setHTML(root, html`${tabs}
    <form class="toolbar" data-filters><input class="input grow" type="search" name="q" value="${f.q}" placeholder="Buscar por nombre, correo o teléfono" aria-label="Buscar clientes"><button class="btn btn-sm" type="submit">Buscar</button></form>
    ${d.items.length ? html`<div class="table-wrap"><table class="tbl"><thead><tr><th>Cliente</th><th>Correo</th><th>Teléfono</th><th>Registro</th><th>Último acceso</th><th class="num">Pedidos</th><th>Cuenta</th></tr></thead>
      <tbody>${d.items.map((u) => html`<tr><td><a class="rowlink" href="#/clientes/${u.id}">${u.fullName}</a></td><td>${u.email}</td><td>${u.phone || '—'}</td><td>${fmtDate(u.createdAt)}</td><td>${u.lastLoginAt ? fmtDate(u.lastLoginAt, true) : '—'}</td><td class="num">${u._count.orders}</td><td>${st(u.status, u.status === 'ACTIVE' ? 'Activa' : 'Suspendida')}</td></tr>`)}</tbody></table></div>${pager(d.page, d.pages, d.total)}`
    : html`<div class="empty">${icon('users', 'icon-lg')}<h2 class="h3">Sin clientes</h2><p>Los clientes que creen cuenta aparecerán aquí. Los pedidos de invitados se ven en Pedidos.</p></div>`}`);
  $('[data-filters]', root).addEventListener('submit', (e) => { e.preventDefault(); location.hash = '#/clientes?' + qs({ q: e.target.q.value }); });
  root.querySelectorAll('[data-page]').forEach((b) => b.addEventListener('click', () => { location.hash = '#/clientes?' + qs({ ...f, page: b.dataset.page }); }));
}
