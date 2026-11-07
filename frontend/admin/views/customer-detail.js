import { html, setHTML, icon, cop, fmtDate, $ } from '/js/core/dom.js';
import { api } from '/js/core/api.js';
import { toast } from '/js/core/layout.js';
import { st, confirmAction } from '../ui.js';

export async function render(root, { params, setTitle }) {
  const { customer: c } = await api(`/admin/customers/${params[0]}`);
  setTitle(c.fullName);
  const active = c.status === 'ACTIVE';
  setHTML(root, html`
    <p style="margin-bottom:16px"><a class="text-btn" href="#/clientes">${icon('chevron-left', 'icon-sm')} Clientes</a></p>
    <div class="grid-2">
      <section class="card-a"><h2>Historial de pedidos</h2>
        ${c.orders.length ? html`<div class="table-wrap"><table class="tbl"><thead><tr><th>Pedido</th><th>Fecha</th><th>Estado</th><th class="num">Total</th></tr></thead><tbody>${c.orders.map((o) => html`<tr><td><a class="rowlink mono" href="#/pedidos/${o.id}">${o.orderNumber}</a></td><td>${fmtDate(o.createdAt, true)}</td><td>${st(o.status, o.statusLabel)}</td><td class="num">${cop(o.total)}</td></tr>`)}</tbody></table></div>` : html`<p class="muted">Sin pedidos.</p>`}
      </section>
      <section class="card-a"><h2>Datos <span class="badge badge-muted">${icon('lock', 'icon-sm')} Restringido</span></h2>
        <dl class="dl"><dt>Nombre</dt><dd>${c.fullName}</dd><dt>Correo</dt><dd>${c.email} ${c.emailVerifiedAt ? html`<span class="badge">Verificado</span>` : ''}</dd><dt>Teléfono</dt><dd>${c.phone || '—'}</dd><dt>Rol</dt><dd>${c.role}</dd><dt>Registro</dt><dd>${fmtDate(c.createdAt, true)}</dd><dt>Último acceso</dt><dd>${c.lastLoginAt ? fmtDate(c.lastLoginAt, true) : '—'}</dd><dt>Cuenta</dt><dd>${st(c.status, active ? 'Activa' : 'Suspendida')}</dd></dl>
        <button class="btn ${active ? 'btn-danger' : 'btn-outline'} btn-sm" style="margin-top:16px" data-toggle>${active ? 'Suspender cuenta' : 'Reactivar cuenta'}</button>
      </section>
    </div>`);
  $('[data-toggle]', root).addEventListener('click', async () => {
    if (active && !(await confirmAction({ title: 'Suspender cuenta', text: 'La persona no podrá iniciar sesión y se cerrarán sus sesiones abiertas. Sus pedidos se conservan.', confirmLabel: 'Suspender', danger: true }))) return;
    try { await api(`/admin/customers/${c.id}/status`, { method: 'POST', body: { status: active ? 'SUSPENDED' : 'ACTIVE' } }); toast('Cuenta actualizada.'); render(root, { params, setTitle }); }
    catch (err) { toast(err.message, { error: true }); }
  });
}
