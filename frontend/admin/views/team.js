import { html, setHTML, icon, fmtDate, $ } from '/js/core/dom.js';
import { api } from '/js/core/api.js';
import { toast } from '/js/core/layout.js';
import { pager, confirmAction, qs, st } from '../ui.js';
import { state } from '/js/core/store.js';

export async function render(root, { query }) {
  const page = Number(query.get('page')) || 1;
  const [admins, logs] = await Promise.all([api('/admin/admins'), api('/admin/audit-logs?' + qs({ page }))]);
  setHTML(root, html`
    <div class="grid-2">
      <section class="card-a"><h2>Administradores</h2>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>Nombre</th><th>Correo</th><th>Estado</th><th>Último acceso</th><th></th></tr></thead>
        <tbody>${admins.items.map((a) => html`<tr><td>${a.fullName}${a.id === state.user.id ? html` <span class="badge">Tú</span>` : ''}</td><td>${a.email}</td><td>${st(a.status, a.status === 'ACTIVE' ? 'Activa' : 'Suspendida')}</td><td>${a.lastLoginAt ? fmtDate(a.lastLoginAt, true) : '—'}</td>
          <td class="num">${a.id === state.user.id ? '' : html`<button class="btn btn-danger btn-sm" data-demote="${a.id}" data-name="${a.fullName}">Quitar permisos</button>`}</td></tr>`)}</tbody></table></div>
      </section>
      <section class="card-a"><h2>Agregar administrador</h2>
        <p class="small muted">La persona debe crear primero una cuenta normal en la tienda. Luego escribe aquí su correo. Tendrá acceso total al panel, incluidos datos personales de clientes.</p>
        <form data-promote novalidate>
          <div class="field"><label for="p-email">Correo de la cuenta</label><input class="input" id="p-email" name="email" type="email" required maxlength="191"><p class="field-error"></p></div>
          <div class="field"><label class="check"><input type="checkbox" name="confirm"> Confirmo que esta persona debe administrar la tienda.</label><p class="field-error"></p></div>
          <button class="btn btn-sm" type="submit">${icon('shield-check', 'icon-sm')} Dar permisos de administrador</button>
        </form>
      </section>
    </div>
    <section class="card-a"><h2>Bitácora de auditoría <span class="muted small">acciones administrativas importantes</span></h2>
      ${logs.items.length ? html`<div class="table-wrap"><table class="tbl"><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Elemento</th><th>Detalle</th><th>IP</th></tr></thead>
      <tbody>${logs.items.map((l) => html`<tr><td class="small">${fmtDate(l.createdAt, true)}</td><td>${l.user ? l.user.fullName : 'Sistema'}</td><td class="mono small">${l.action}</td><td class="small">${l.entity}${l.entityId ? ` #${l.entityId}` : ''}</td><td class="small muted" style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${l.details ? JSON.stringify(l.details) : ''}</td><td class="small muted">${l.ip || ''}</td></tr>`)}</tbody></table></div>${pager(logs.page, logs.pages, logs.total)}` : html`<p class="muted">Sin registros.</p>`}
    </section>`);

  $('[data-promote]', root).addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    try { const r = await api('/admin/admins', { method: 'POST', body: { email: f.email.value, confirm: f.confirm.checked } }); toast(r.message); render(root, { query }); }
    catch (err) { const fieldsShown = err.fields && Object.keys(err.fields).length; if (fieldsShown) { const { showFieldErrors } = await import('/js/core/dom.js'); showFieldErrors(f, err.fields); } else toast(err.message, { error: true }); }
  });
  root.querySelectorAll('[data-demote]').forEach((b) => b.addEventListener('click', async () => {
    if (!(await confirmAction({ title: 'Quitar permisos', text: `${b.dataset.name} dejará de ser administrador y se cerrarán sus sesiones.`, confirmLabel: 'Quitar permisos', danger: true }))) return;
    try { const r = await api(`/admin/admins/${b.dataset.demote}`, { method: 'DELETE' }); toast(r.message); render(root, { query }); } catch (err) { toast(err.message, { error: true }); }
  }));
  root.querySelectorAll('[data-page]').forEach((b) => b.addEventListener('click', () => { location.hash = '#/equipo?' + qs({ page: b.dataset.page }); }));
}
