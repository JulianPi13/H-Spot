// Checkout: formulario validado, resumen con precios del servidor, creación del pedido
// y apertura de WhatsApp con el mensaje generado por el backend.
import { html, raw, $, setHTML, icon, cop, uid, showFieldErrors, clearFieldError, formData, setLoading } from '../core/dom.js';
import { api } from '../core/api.js';
import { initPage, toast } from '../core/layout.js';
import { field, lineThumb, errorBox } from '../core/components.js';
import { state, loadCart, itemsFromQuote, clearLocalCart } from '../core/store.js';

const KEY = 'hspot_checkout_key';
// Clave única por intento de compra: si se pulsa dos veces, el servidor no duplica el pedido
function idempotencyKey() {
  let k = sessionStorage.getItem(KEY);
  if (!k) { k = uid(); sessionStorage.setItem(KEY, k); }
  return k;
}

// Validación en el navegador (el servidor vuelve a validar todo)
function validate(d, needShipping, payments) {
  const e = {};
  if (!d.fullName || d.fullName.trim().length < 3) e.fullName = 'Escribe tu nombre completo.';
  else if (!/^[\p{L}][\p{L} .'-]*$/u.test(d.fullName.trim())) e.fullName = 'El nombre solo puede contener letras y espacios.';
  const phone = (d.phone || '').replace(/\D/g, '').replace(/^57(?=\d{10}$)/, '');
  if (!/^3\d{9}$/.test(phone) && !/^60\d{8}$/.test(phone)) e.phone = 'Escribe un celular colombiano válido, por ejemplo 3001234567.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((d.email || '').trim())) e.email = 'Escribe un correo válido.';
  if (!d.department) e.department = 'Elige un departamento.';
  if (!d.city || d.city.trim().length < 2) e.city = 'Escribe tu ciudad o municipio.';
  if (!d.address || d.address.trim().length < 6) e.address = 'Escribe la dirección completa.';
  else if (!/\d/.test(d.address)) e.address = 'Incluye el número de la dirección (por ejemplo: Calle 45 # 12-30).';
  if (needShipping && !d.shippingMethodId) e.shippingMethodId = 'Elige un método de entrega.';
  if (payments.length && !d.paymentMethod) e.paymentMethod = 'Elige un método de pago.';
  if (!d.acceptPolicy) e.acceptPolicy = 'Debes aceptar la política de tratamiento de datos.';
  if (!d.confirmData) e.confirmData = 'Confirma que tus datos son correctos.';
  return e;
}

function summary(cart) {
  const lines = cart.lines.filter((l) => l.quantity > 0);
  return html`
    <h2>Resumen del pedido</h2>
    <div class="summary-lines">${lines.map((l) => html`<div class="summary-line">${lineThumb(l)}<div><strong>${l.name}</strong><br><span class="muted">${l.color} / ${l.size} · ${l.quantity} x ${cop(l.unitPrice)}</span></div><span class="price">${cop(l.lineTotal)}</span></div>`)}</div>
    <div>
      <div class="totals-row"><span>Subtotal</span><span class="price">${cop(cart.subtotal)}</span></div>
      ${cart.discount ? html`<div class="totals-row"><span>Descuento (${cart.promoCode})</span><span class="price">-${cop(cart.discount)}</span></div>` : ''}
      <div class="totals-row"><span>Envío${cart.shippingMethod ? ` (${cart.shippingMethod.name})` : ''}</span><span>${cart.shippingDefined ? (cart.freeShipping ? 'Gratis' : cop(cart.shippingCost)) : html`<span class="muted">Por confirmar</span>`}</span></div>
      <div class="totals-row total"><span>Total</span><span>${cop(cart.total)}${cart.shippingDefined ? '' : html`<span class="muted small" style="font-weight:400"> + envío</span>`}</span></div>
    </div>
    <a class="text-btn" href="/carrito">${icon('pencil', 'icon-sm')} Editar carrito</a>`;
}

async function main() {
  await initPage();
  const cart = await loadCart().catch((err) => { setHTML($('#main'), html`<div class="container" style="padding:40px 0">${errorBox(err.message)}</div>`); return null; });
  if (!cart) return;
  if (!cart.lines.some((l) => l.quantity > 0)) {
    setHTML($('#main'), html`<div class="container"><div class="page-title"><h1 class="h1">Finalizar pedido</h1></div><div class="empty">${icon('shopping-bag', 'icon-lg')}<h2 class="h3">Tu carrito está vacío</h2><p>Añade productos antes de finalizar el pedido.</p><a class="btn" href="/tienda">Ir a la tienda</a></div></div>`);
    return;
  }
  const u = state.user;
  const s = state.settings;
  const payments = s.checkout.paymentMethods.filter((p) => p.enabled);
  const ships = cart.shippingMethods;

  setHTML($('#main'), html`
    <div class="container">
      <div class="page-title"><div><p class="eyebrow">Paso final</p><h1 class="h1">Finalizar pedido</h1></div>
        ${u ? html`<p class="muted small">Comprando como <strong>${u.email}</strong></p>` : html`<p class="muted small">Compras como invitado. ¿Tienes cuenta? <a class="link" href="/login?next=/checkout">Inicia sesión</a></p>`}
      </div>
      <div class="two-col">
        <form data-checkout novalidate aria-describedby="checkout-help">
          <p id="checkout-help" class="sr-only">Los campos marcados con asterisco son obligatorios.</p>
          <div class="alert alert-error" data-form-error hidden role="alert"></div>
          ${cart.issues.length ? html`<div class="alert alert-warning" style="margin-bottom:20px">${icon('circle-alert')}<span>${cart.issues.map((i) => i.message).join(' ')} Revisa el resumen antes de continuar.</span></div>` : ''}

          <section class="checkout-section"><h2><span class="step-num">1</span> Datos de contacto</h2>
            ${field({ name: 'fullName', label: 'Nombre completo', autocomplete: 'name', value: u?.fullName || '', maxlength: 120 })}
            <div class="form-row">
              ${field({ name: 'phone', label: 'Celular', type: 'tel', autocomplete: 'tel-national', value: u?.phone || '', placeholder: '300 123 4567', maxlength: 20, inputmode: 'tel', hint: 'Te contactaremos por WhatsApp a este número.' })}
              ${field({ name: 'email', label: 'Correo electrónico', type: 'email', autocomplete: 'email', value: u?.email || '', maxlength: 191 })}
            </div>
          </section>

          <section class="checkout-section"><h2><span class="step-num">2</span> Entrega</h2>
            <div class="form-row">
              <div class="field"><label for="f-department">Departamento <span class="req" aria-hidden="true">*</span></label>
                <select class="select" id="f-department" name="department" required autocomplete="address-level1" aria-describedby="e-department"><option value="">Selecciona...</option>${state.boot.departamentos.map((d) => html`<option>${d}</option>`)}</select>
                <p class="field-error" id="e-department"></p></div>
              ${field({ name: 'city', label: 'Ciudad o municipio', autocomplete: 'address-level2', maxlength: 80 })}
            </div>
            ${field({ name: 'address', label: 'Dirección de entrega', autocomplete: 'street-address', placeholder: 'Calle 45 # 12-30, apto 301', maxlength: 200 })}
            ${field({ name: 'neighborhood', label: 'Barrio', required: false, maxlength: 100 })}
            <div class="field"><label for="f-deliveryNotes">Indicaciones de entrega <span class="muted">(opcional)</span></label>
              <textarea class="textarea" id="f-deliveryNotes" name="deliveryNotes" maxlength="300" placeholder="Torre, portería, horario preferido..."></textarea><p class="field-error"></p></div>
            ${ships.length ? html`
              <div class="field"><span class="field-label" id="l-ship">Método de entrega <span class="req">*</span></span>
                <div class="radio-cards" role="radiogroup" aria-labelledby="l-ship">
                  ${ships.map((m) => html`<label class="radio-card"><span class="check"><input type="radio" name="shippingMethodId" value="${m.id}" ${ships.length === 1 || cart.shippingMethod?.id === m.id ? raw('checked') : ''}> <span><strong>${m.name}</strong>${m.description ? html`<br><span class="muted small">${m.description}</span>` : ''}</span></span><span class="price">${cop(m.price)}</span></label>`)}
                </div><p class="field-error"></p></div>` : html`<div class="alert">${icon('info')}<span>El costo de envío a tu ciudad se confirma por WhatsApp antes del pago.</span></div>`}
          </section>

          <section class="checkout-section"><h2><span class="step-num">3</span> Pago</h2>
            ${payments.length ? html`
              <div class="field"><span class="field-label" id="l-pay">Método de pago preferido <span class="req">*</span></span>
                <div class="radio-cards" role="radiogroup" aria-labelledby="l-pay">${payments.map((p) => html`<label class="radio-card"><span class="check"><input type="radio" name="paymentMethod" value="${p.id}" ${payments.length === 1 ? raw('checked') : ''}> ${p.name}</span></label>`)}</div>
                <p class="field-error"></p></div>` : ''}
            <div class="alert">${icon('lock')}<span>No pedimos datos de tarjeta en la web. Después de enviar tu pedido, coordinamos el pago contigo por WhatsApp.</span></div>
            <div class="field" style="margin-top:18px"><label for="f-promoCode">Código promocional <span class="muted">(opcional)</span></label>
              <input class="input" id="f-promoCode" name="promoCode" maxlength="40" value="${state.cartExtra.promoCode || ''}" style="text-transform:uppercase"><p class="field-error"></p></div>
          </section>

          <section class="checkout-section" style="border:0">
            <div class="field"><label class="check"><input type="checkbox" name="shareAddressWhatsapp"> <span>Incluir mi dirección en el mensaje de WhatsApp.</span></label></div>
            <div class="field"><label class="check"><input type="checkbox" name="acceptPolicy" required> <span>He leído y acepto la <a class="link" href="/politica-de-datos" target="_blank" rel="noopener">política de tratamiento de datos personales</a> y los <a class="link" href="/terminos" target="_blank" rel="noopener">términos y condiciones</a>. <span class="req">*</span></span></label><p class="field-error"></p></div>
            <div class="field"><label class="check"><input type="checkbox" name="confirmData" required> <span>Confirmo que mis datos son correctos. <span class="req">*</span></span></label><p class="field-error"></p></div>
            <button class="btn btn-block" type="submit" data-submit>Finalizar pedido ${icon('arrow-right')}</button>
            <p class="small muted" style="margin-top:12px">Al finalizar se guarda tu pedido y se abre WhatsApp con el resumen para que lo envíes. Tu pedido queda <strong>pendiente de confirmación</strong> hasta que H-SPOT confirme disponibilidad y pago.</p>
          </section>
        </form>
        <aside class="summary" data-summary aria-label="Resumen del pedido">${summary(cart)}</aside>
      </div>
    </div>`);

  const form = $('[data-checkout]');
  form.addEventListener('input', clearFieldError);
  form.addEventListener('change', async (e) => {
    clearFieldError(e);
    if (e.target.name === 'shippingMethodId' || e.target.name === 'promoCode') {
      try {
        const c = await loadCart({ shippingMethodId: Number(form.querySelector('input[name=shippingMethodId]:checked')?.value) || null, promoCode: form.promoCode.value.trim() || null });
        setHTML($('[data-summary]'), summary(c));
      } catch (err) {
        if (e.target.name === 'promoCode') { showFieldErrors(form, { promoCode: err.fields?.promoCode || err.message }); await loadCart({ promoCode: null }).then((c) => setHTML($('[data-summary]'), summary(c))).catch(() => {}); }
      }
    }
  });

  let sending = false;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sending) return; // evita doble envío
    const errBox = $('[data-form-error]');
    errBox.hidden = true;
    const d = formData(form);
    const errors = validate(d, ships.length > 1, payments);
    if (Object.keys(errors).length) { showFieldErrors(form, errors); return; }

    sending = true;
    const btn = $('[data-submit]');
    setLoading(btn, true);
    // Abrimos la pestaña de inmediato (dentro del clic) para que el navegador no la bloquee
    let waWindow = null;
    try { waWindow = window.open('', '_blank'); if (waWindow) waWindow.document.write('<p style="font-family:sans-serif;padding:24px">Abriendo WhatsApp...</p>'); } catch { waWindow = null; }

    try {
      const res = await api('/orders', {
        method: 'POST',
        body: {
          idempotencyKey: idempotencyKey(),
          items: itemsFromQuote(state.cart),
          fullName: d.fullName, phone: d.phone, email: d.email,
          department: d.department, city: d.city, address: d.address,
          neighborhood: d.neighborhood, deliveryNotes: d.deliveryNotes,
          shippingMethodId: d.shippingMethodId ? Number(d.shippingMethodId) : null,
          paymentMethod: d.paymentMethod || null,
          promoCode: d.promoCode || null,
          shareAddressWhatsapp: d.shareAddressWhatsapp,
          acceptPolicy: d.acceptPolicy, confirmData: d.confirmData,
        },
      });
      sessionStorage.removeItem(KEY);
      if (!state.user) clearLocalCart();
      const o = res.order;
      if (waWindow && !waWindow.closed) waWindow.location.href = o.whatsapp.url;
      const q = res.accessToken ? `?token=${encodeURIComponent(res.accessToken)}&nuevo=1` : '?nuevo=1';
      location.href = `/pedido/${encodeURIComponent(o.orderNumber)}${q}${waWindow ? '' : '&abrir=1'}`;
    } catch (err) {
      if (waWindow) waWindow.close();
      sending = false;
      setLoading(btn, false);
      if (err.fields && Object.keys(err.fields).length && !err.fields.items) showFieldErrors(form, err.fields);
      setHTML(errBox, html`${icon('circle-alert')}<span>${err.message}${err.fields?.items ? ' ' + err.fields.items : ''}</span>`);
      errBox.hidden = false;
      errBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (err.status === 409) { const c = await loadCart().catch(() => null); if (c) setHTML($('[data-summary]'), summary(c)); }
      toast(err.message, { error: true });
    }
  });
}
main();
