// Área del cliente: perfil, historial de pedidos, detalle y seguridad.
import { html, $, setHTML, icon, cop, fmtDate, showFieldErrors, clearFieldError, formData, setLoading } from '../core/dom.js';
import { api } from '../core/api.js';
import { initPage, toast } from '../core/layout.js';
import { field, passwordField, bindPasswordToggles, errorBox } from '../core/components.js';
import { state, setUser, clearLocalCart } from '../core/store.js';

const nav = (path) => {
  const cur = (p) => (path === p || (p !== '/cuenta' && path.startsWith(p)) ? 'page' : 'false');
  return html`<nav class="account-nav" aria-label="Mi cuenta">
    <a href="/cuenta" aria-current="${cur('/cuenta')}">${icon('user')} Perfil</a>
    <a href="/cuenta/pedidos" aria-current="${cur('/cuenta/pedidos')}">${icon('package')} Mis pedidos</a>
    <a href="/cuenta/seguridad" aria-current="${cur('/cuenta/seguridad')}">${icon('lock')} Seguridad</a>
    ${state.user.role === 'ADMIN' ? html`<a href="/admin">${icon('layout-dashboard')} Panel admin</a>` : ''}
    <button type="button" data-logout>${icon('log-out')} Cerrar sesión</button>
  </nav>`;
};

function profileView() {
  const u = state.user;
  return html`
    <div class="panel"><h2>Datos personales</h2>
      <form data-profile novalidate style="max-width:520px">
        ${field({ name: 'fullName', label: 'Nombre completo', autocomplete: 'name', value: u.fullName, maxlength: 120 })}
        ${field({ name: 'phone', label: 'Celular', type: 'tel', required: false, autocomplete: 'tel-national', value: u.phone || '', maxlength: 20, inputmode: 'tel' })}
        <div class="field"><label>Correo electrónico</label><input class="input" value="${u.email}" disabled>
          <p class="field-hint">${u.emailVerified ? 'Correo verificado.' : html`Correo sin verificar. <button type="button" class="link" data-resend>Reenviar verificación</button>`}</p></div>
        <button class="btn" type="submit">Guardar cambios</button>
      </form>
    </div>
    <div class="panel"><h2>Cliente desde</h2><p class="muted" style="margin:0">${fmtDate(u.createdAt)}</p></div>`;
}

function securityView() {
  return html`<div class="panel"><h2>Cambiar contraseña</h2>
    <form data-password novalidate style="max-width:520px">
      ${passwordField({ name: 'currentPassword', label: 'Contraseña actual', autocomplete: 'current-password' })}
      ${passwordField({ name: 'newPassword', label: 'Nueva contraseña', hint: html`<p class="field-hint">Mínimo 8 caracteres, con letras y números.</p>` })}
      ${passwordField({ name: 'confirmPassword', label: 'Confirmar nueva contraseña' })}
      <button class="btn" type="submit">Actualizar contraseña</button>
      <p class="field-hint" style="margin-top:12px">Al cambiarla se cerrarán tus sesiones en otros dispositivos.</p>
    </form></div>`;
}

async function ordersView(box) {
  const { orders } = await api('/account/orders');
  setHTML(box, orders.length ? html`<div class="panel"><h2>Mis pedidos</h2><div style="overflow-x:auto"><table class="list-table">
      <thead><tr><th scope="col">Pedido</th><th scope="col">Fecha</th><th scope="col">Estado</th><th scope="col">Total</th><th scope="col"><span class="sr-only">Ver</span></th></tr></thead>
      <tbody>${orders.map((o) => html`<tr><td class="mono">${o.orderNumber}</td><td>${fmtDate(o.createdAt)}</td><td><span class="status-pill" data-status="${o.status}">${o.statusLabel}</span></td><td class="price">${cop(o.total)}</td><td><a class="text-btn" href="/cuenta/pedidos/${o.orderNumber}">Ver ${icon('arrow-right', 'icon-sm')}</a></td></tr>`)}</tbody>
    </table></div></div>`
    : html`<div class="empty">${icon('package', 'icon-lg')}<h2 class="h3">Aún no tienes pedidos</h2><p>Los pedidos que hagas con tu cuenta aparecerán aquí.</p><a class="btn" href="/tienda">Ir a la tienda</a></div>`);
}

async function orderDetail(box, num) {
  const { order: o } = await api(`/account/orders/${encodeURIComponent(num)}`);
  setHTML(box, html`
    <a class="text-btn" href="/cuenta/pedidos">${icon('chevron-left', 'icon-sm')} Volver a mis pedidos</a>
    <div class="panel" style="margin-top:14px">
      <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:18px"><h2 style="margin:0">Pedido ${o.orderNumber}</h2><span class="status-pill" data-status="${o.status}">${o.statusLabel}</span></div>
      <p class="muted small">Creado el ${fmtDate(o.createdAt, true)}${o.paymentMethod ? ` · Pago: ${o.paymentMethod}` : ''}</p>
      <div style="overflow-x:auto"><table class="list-table"><thead><tr><th>Producto</th><th>Talla / Color</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr></thead>
        <tbody>${o.items.map((i) => html`<tr><td>${i.productName}</td><td>${i.size} / ${i.color}</td><td>${i.quantity}</td><td>${cop(i.unitPrice)}</td><td class="price">${cop(i.lineTotal)}</td></tr>`)}</tbody></table></div>
      <div style="max-width:340px;margin:18px 0 0 auto">
        <div class="totals-row"><span>Subtotal</span><span>${cop(o.subtotal)}</span></div>
        ${o.discount ? html`<div class="totals-row"><span>Descuento</span><span>-${cop(o.discount)}</span></div>` : ''}
        <div class="totals-row"><span>Envío</span><span>${o.shippingDefined ? cop(o.shippingCost) : 'Por confirmar'}</span></div>
        <div class="totals-row total"><span>Total</span><span>${cop(o.total)}</span></div>
      </div>
    </div>
    <div class="panel"><h2>Entrega</h2><p style="margin:0">${o.customerName}<br>${o.address}${o.neighborhood ? `, ${o.neighborhood}` : ''}<br>${o.city}, ${o.department}<br>${o.phone}</p></div>
    ${o.status === 'PENDIENTE_CONFIRMACION' ? html`<div class="panel"><h2>¿No enviaste el mensaje?</h2><a class="btn" href="${o.whatsapp.url}" target="_blank" rel="noopener noreferrer">${icon('message-circle')} Abrir WhatsApp</a></div>` : ''}`);
}

function bindForms(root) {
  bindPasswordToggles(root);
  root.addEventListener('input', clearFieldError);
  const profile = $('[data-profile]', root);
  if (profile) profile.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('button[type=submit]', profile); setLoading(btn, true);
    try { const r = await api('/account/profile', { method: 'PUT', body: formData(profile) }); setUser(r.user); toast('Datos actualizados.'); }
    catch (err) { if (!showFieldErrors(profile, err.fields)) toast(err.message, { error: true }); }
    setLoading(btn, false);
  });
  const resend = $('[data-resend]', root);
  if (resend) resend.addEventListener('click', async () => {
    try { const r = await api('/auth/resend-verification', { method: 'POST' }); toast(r.message); } catch (err) { toast(err.message, { error: true }); }
  });
  const pw = $('[data-password]', root);
  if (pw) pw.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = formData(pw);
    if (d.newPassword !== d.confirmPassword) { showFieldErrors(pw, { confirmPassword: 'Las contraseñas no coinciden.' }); return; }
    const btn = $('button[type=submit]', pw); setLoading(btn, true);
    try { const r = await api('/account/password', { method: 'PUT', body: d }); toast(r.message); pw.reset(); }
    catch (err) { if (!showFieldErrors(pw, err.fields)) toast(err.message, { error: true }); }
    setLoading(btn, false);
  });
}

async function main() {
  await initPage();
  if (!state.user) { location.replace(`/login?next=${encodeURIComponent(location.pathname)}`); return; }
  const path = location.pathname.replace(/\/$/, '');
  setHTML($('#main'), html`
    <div class="container">
      <div class="page-title"><div><p class="eyebrow">Mi cuenta</p><h1 class="h1">Hola, ${state.user.fullName.split(' ')[0]}</h1></div></div>
      <div class="account-layout">${nav(path)}<div data-view><div class="spinner"></div></div></div>
    </div>`);
  if (sessionStorage.getItem('hspot_merged')) { sessionStorage.removeItem('hspot_merged'); toast('Combinamos tu carrito de invitado con el de tu cuenta.'); }

  $('[data-logout]').addEventListener('click', async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* igual cerramos */ }
    clearLocalCart();
    location.href = '/';
  });

  const view = $('[data-view]');
  try {
    if (path === '/cuenta') setHTML(view, profileView());
    else if (path === '/cuenta/seguridad') setHTML(view, securityView());
    else if (path === '/cuenta/pedidos') await ordersView(view);
    else if (path.startsWith('/cuenta/pedidos/')) await orderDetail(view, decodeURIComponent(path.split('/').pop()));
    else setHTML(view, errorBox('Sección no encontrada.'));
    bindForms(view);
  } catch (err) { setHTML(view, errorBox(err.message)); }
}
main();
