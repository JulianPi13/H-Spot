import { html, setHTML, icon, cop, fmtDate, $ } from '/js/core/dom.js';
import { api } from '/js/core/api.js';
import { toast } from '/js/core/layout.js';
import { st, PAY, confirmAction } from '../ui.js';

export async function render(root, { params, setTitle }) {
  const id = params[0];
  const { order: o } = await api(`/admin/orders/${id}`);
  setTitle(`Pedido ${o.orderNumber}`);

  setHTML(root, html`
    <p style="margin-bottom:16px"><a class="text-btn" href="#/pedidos">${icon('chevron-left', 'icon-sm')} Volver a pedidos</a></p>
    <div class="grid-2">
      <div>
        <section class="card-a"><h2>Productos <span>${st(o.status, o.statusLabel)}</span></h2>
          <div class="table-wrap"><table class="tbl"><thead><tr><th></th><th>Producto</th><th>SKU</th><th>Talla</th><th>Color</th><th class="num">Cant.</th><th class="num">Precio</th><th class="num">Subtotal</th></tr></thead>
          <tbody>${o.items.map((i) => html`<tr><td>${i.imageUrl ? html`<img src="${i.imageUrl}" alt="">` : ''}</td><td>${i.productId ? html`<a class="rowlink" href="#/productos/${i.productId}">${i.productName}</a>` : i.productName}</td><td class="mono small">${i.sku}</td><td>${i.size}</td><td>${i.color}</td><td class="num">${i.quantity}</td><td class="num">${cop(i.unitPrice)}</td><td class="num">${cop(i.lineTotal)}</td></tr>`)}</tbody></table></div>
          <dl class="dl" style="max-width:360px;margin:16px 0 0 auto">
            <dt>Subtotal</dt><dd class="num">${cop(o.subtotal)}</dd>
            ${o.discount ? html`<dt>Descuento ${o.promotionCode ? `(${o.promotionCode})` : ''}</dt><dd>-${cop(o.discount)}</dd>` : ''}
            <dt>Envío ${o.shippingMethodName ? `(${o.shippingMethodName})` : ''}</dt><dd>${o.shippingDefined ? cop(o.shippingCost) : 'Por confirmar'}</dd>
            <dt><strong>Total</strong></dt><dd><strong>${cop(o.total)}</strong></dd>
          </dl>
          <p class="small muted" style="margin-top:12px">Los precios quedaron guardados al momento del pedido: los cambios futuros del catálogo no los modifican.</p>
        </section>
        <section class="card-a"><h2>Notas internas</h2>
          <form class="inline-form" data-note style="margin-bottom:14px"><div class="field" style="flex:1"><label class="sr-only" for="note">Nueva nota</label><input class="input" id="note" name="body" maxlength="1000" placeholder="Ej.: cliente pagó por Nequi, comprobante recibido"></div><button class="btn btn-sm" type="submit">Agregar nota</button></form>
          ${o.notes.length ? html`<ul class="timeline">${o.notes.map((n) => html`<li><span>${n.body}</span><span class="muted">${n.author?.fullName || 'Sistema'} · ${fmtDate(n.createdAt, true)}</span></li>`)}</ul>` : html`<p class="muted small">Sin notas.</p>`}
        </section>
      </div>
      <div>
        <section class="card-a"><h2>Estado del pedido</h2>
          ${o.allowedTransitions.length ? html`<form data-status>
            <div class="field"><label for="st">Cambiar a</label><select class="select" id="st" name="status">${o.allowedTransitions.map((t) => html`<option value="${t.value}">${t.label}</option>`)}</select></div>
            <div class="field"><label for="stn">Nota (opcional)</label><input class="input" id="stn" name="note" maxlength="300"></div>
            <button class="btn btn-sm btn-block" type="submit">Actualizar estado</button>
            <p class="field-hint" style="margin-top:8px">Cancelar devuelve automáticamente las unidades al inventario.</p>
          </form>` : html`<p class="muted small">Este pedido está en un estado final.</p>`}
          <hr style="border:0;border-top:1px solid var(--line);margin:18px 0">
          <form data-payment class="inline-form"><div class="field" style="flex:1"><label for="pay">Estado de pago</label><select class="select" id="pay" name="paymentStatus">${Object.entries(PAY).map(([k, v]) => html`<option value="${k}" ${o.paymentStatus === k ? html`selected` : ''}>${v}</option>`)}</select></div><button class="btn btn-outline btn-sm" type="submit">Guardar</button></form>
          <p class="field-hint" style="margin-top:8px">Marca "Pagado" solo cuando hayas verificado el pago. Abrir WhatsApp no significa que el cliente pagó.</p>
        </section>
        <section class="card-a"><h2>Cliente y entrega <span class="badge badge-muted">${icon('lock', 'icon-sm')} Datos personales</span></h2>
          <dl class="dl">
            <dt>Nombre</dt><dd>${o.customerName}${o.user ? html` <a class="badge" href="#/clientes/${o.user.id}">Con cuenta</a>` : html` <span class="badge badge-muted">Invitado</span>`}</dd>
            <dt>Teléfono</dt><dd>${o.phone}</dd><dt>Correo</dt><dd>${o.email}</dd>
            <dt>Dirección</dt><dd>${o.address}${o.neighborhood ? `, ${o.neighborhood}` : ''}</dd>
            <dt>Ciudad</dt><dd>${o.city}, ${o.department}</dd>
            ${o.deliveryNotes ? html`<dt>Indicaciones</dt><dd>${o.deliveryNotes}</dd>` : ''}
            <dt>Pago preferido</dt><dd>${o.paymentMethod || '—'}</dd>
            <dt>Creado</dt><dd>${fmtDate(o.createdAt, true)}</dd>
            ${o.reservationExpiresAt ? html`<dt>Reserva vence</dt><dd>${fmtDate(o.reservationExpiresAt, true)}</dd>` : ''}
          </dl>
          <a class="btn btn-outline btn-sm" style="margin-top:16px" href="${o.customerWhatsappUrl}" target="_blank" rel="noopener noreferrer">${icon('message-circle', 'icon-sm')} Escribir al cliente por WhatsApp</a>
        </section>
        <section class="card-a"><h2>Historial de cambios</h2>
          <ul class="timeline">${o.history.map((h) => html`<li><span>${h.fromStatus ? `${h.fromStatus} → ` : ''}<strong>${h.toStatus}</strong>${h.note ? ` — ${h.note}` : ''}</span><span class="muted">${h.changedBy?.fullName || 'Sistema / cliente'} · ${fmtDate(h.createdAt, true)}</span></li>`)}</ul>
        </section>
      </div>
    </div>`);

  const reload = () => render(root, { params, setTitle });
  const sf = $('[data-status]', root);
  if (sf) sf.addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = sf.status.value;
    if (status === 'CANCELADO' && !(await confirmAction({ title: 'Cancelar pedido', text: 'El pedido quedará cancelado y sus unidades volverán al inventario. Esta acción no se puede deshacer.', confirmLabel: 'Cancelar pedido', danger: true }))) return;
    try { await api(`/admin/orders/${id}/status`, { method: 'POST', body: { status, note: sf.note.value } }); toast('Estado actualizado.'); reload(); }
    catch (err) { toast(err.message, { error: true }); }
  });
  $('[data-payment]', root).addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api(`/admin/orders/${id}/payment`, { method: 'POST', body: { paymentStatus: e.target.paymentStatus.value } }); toast('Estado de pago actualizado.'); reload(); }
    catch (err) { toast(err.message, { error: true }); }
  });
  $('[data-note]', root).addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api(`/admin/orders/${id}/notes`, { method: 'POST', body: { body: e.target.body.value } }); reload(); }
    catch (err) { toast(err.fields?.body || err.message, { error: true }); }
  });
}
