// Página del pedido creado: estado, resumen, botón para (re)abrir WhatsApp y copiar el resumen.
import { html, $, setHTML, icon, cop, fmtDate } from '../core/dom.js';
import { api } from '../core/api.js';
import { initPage, toast } from '../core/layout.js';
import { errorBox } from '../core/components.js';

async function main() {
  await initPage();
  const num = decodeURIComponent(location.pathname.split('/').pop());
  const params = new URLSearchParams(location.search);
  const token = params.get('token');
  const isNew = params.get('nuevo') === '1';
  let o;
  try {
    ({ order: o } = await api(`/orders/${encodeURIComponent(num)}${token ? `?token=${encodeURIComponent(token)}` : ''}`));
  } catch (err) {
    setHTML($('#main'), html`<div class="container" style="padding:60px 0">${errorBox(err.status === 404 ? 'No encontramos este pedido o no tienes permiso para verlo. Si lo hiciste con una cuenta, inicia sesión.' : err.message)}<p style="margin-top:16px"><a class="btn" href="/login">Iniciar sesión</a></p></div>`);
    return;
  }
  // Quitamos los parámetros "nuevo/abrir" para que al recargar no se repita el mensaje
  if (isNew) history.replaceState(null, '', location.pathname + (token ? `?token=${encodeURIComponent(token)}` : ''));

  const pending = o.status === 'PENDIENTE_CONFIRMACION';
  setHTML($('#main'), html`
    <div class="container">
      <section class="order-hero">
        <span class="status-pill" data-status="${o.status}">${o.statusLabel}</span>
        <h1 class="h1">${isNew ? 'Pedido creado' : 'Pedido'} ${o.orderNumber}</h1>
        <p class="muted" style="max-width:640px;margin:0">${isNew ? `Gracias, ${o.customerName.split(' ')[0]}. ` : ''}${pending
          ? 'Tu pedido quedó guardado pero aún NO está confirmado. Envíanos el mensaje por WhatsApp: allí confirmamos disponibilidad, costo de envío y forma de pago.'
          : `Estado actual: ${o.statusLabel}.`}</p>
      </section>
      <div class="two-col">
        <div style="display:grid;gap:24px">
          ${pending ? html`
          <div class="wa-box">
            <h2 class="h3">Envía tu pedido por WhatsApp</h2>
            <ol class="steps-list"><li>Abre WhatsApp con el botón de abajo. El mensaje ya está escrito.</li><li>Revísalo y pulsa enviar.</li><li>Te respondemos para confirmar el pedido y el pago.</li></ol>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <a class="btn" href="${o.whatsapp.url}" target="_blank" rel="noopener noreferrer" data-wa>${icon('message-circle')} Abrir WhatsApp</a>
              <button class="btn btn-outline" data-copy>${icon('copy')} Copiar resumen</button>
            </div>
            <details><summary class="text-btn" style="cursor:pointer">Ver el mensaje</summary><pre class="wa-preview" data-msg>${o.whatsapp.message}</pre></details>
            ${o.reservationExpiresAt ? html`<p class="small muted">Reservamos tus prendas hasta el ${fmtDate(o.reservationExpiresAt, true)}. Si no confirmamos antes, la reserva se libera.</p>` : ''}
          </div>` : ''}
          <div class="panel">
            <h2>Entrega</h2>
            <p>${o.customerName}<br>${o.phone} · ${o.email}<br>${o.address}${o.neighborhood ? `, ${o.neighborhood}` : ''}<br>${o.city}, ${o.department}</p>
            ${o.deliveryNotes ? html`<p class="muted small">${o.deliveryNotes}</p>` : ''}
            <p class="small muted" style="margin:0">Creado el ${fmtDate(o.createdAt, true)}${o.paymentMethod ? ` · Pago preferido: ${o.paymentMethod}` : ''}${o.shippingMethodName ? ` · Entrega: ${o.shippingMethodName}` : ''}</p>
          </div>
        </div>
        <aside class="summary">
          <h2>Resumen</h2>
          <div class="summary-lines">${o.items.map((i) => html`<div class="summary-line">${i.imageUrl ? html`<img src="${i.imageUrl}" alt="" loading="lazy">` : html`<span></span>`}<div><strong>${i.productName}</strong><br><span class="muted">${i.color} / ${i.size} · ${i.quantity} x ${cop(i.unitPrice)}</span></div><span class="price">${cop(i.lineTotal)}</span></div>`)}</div>
          <div>
            <div class="totals-row"><span>Subtotal</span><span>${cop(o.subtotal)}</span></div>
            ${o.discount ? html`<div class="totals-row"><span>Descuento</span><span>-${cop(o.discount)}</span></div>` : ''}
            <div class="totals-row"><span>Envío</span><span>${o.shippingDefined ? (o.shippingCost ? cop(o.shippingCost) : 'Gratis') : 'Por confirmar'}</span></div>
            <div class="totals-row total"><span>Total</span><span>${cop(o.total)}</span></div>
          </div>
          <a class="btn btn-outline btn-block" href="/tienda">Seguir comprando</a>
        </aside>
      </div>
    </div>`);

  const copy = $('[data-copy]');
  if (copy) copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(o.whatsapp.message); toast('Resumen copiado. Pégalo en nuestro chat de WhatsApp.'); }
    catch {
      const range = document.createRange(); range.selectNodeContents($('[data-msg]'));
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
      $('[data-msg]').closest('details').open = true;
      toast('Selecciona y copia el texto del mensaje.');
    }
  });
  // Si el navegador bloqueó la ventana nueva, mostramos el botón destacado
  if (params.get('abrir') === '1' && $('[data-wa]')) { $('[data-wa]').focus(); toast('Pulsa "Abrir WhatsApp" para enviar tu pedido.'); }
}
main();
