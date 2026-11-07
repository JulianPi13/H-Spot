// Página del carrito: cantidades, eliminar, vaciar, código promocional, envío y total.
// Todos los valores mostrados vienen del servidor.
import { html, raw, $, setHTML, icon, cop } from '../core/dom.js';
import { initPage, toast, bindQtyControls } from '../core/layout.js';
import { lineThumb, errorBox } from '../core/components.js';
import { state, loadCart, clearCart } from '../core/store.js';


const extra = state.cartExtra;

function render() {
  const cart = state.cart;
  const lines = cart ? cart.lines.filter((l) => l.quantity > 0) : [];
  const main = $('#main');
  if (!lines.length) {
    setHTML(main, html`<div class="container"><div class="page-title"><h1 class="h1">Carrito</h1></div>
      <div class="empty">${icon('shopping-bag', 'icon-lg')}<h2 class="h3">Tu carrito está vacío</h2><p>Cuando añadas prendas, aparecerán aquí.</p><a class="btn" href="/tienda">Explorar la tienda</a></div></div>`);
    return;
  }
  setHTML(main, html`
    <div class="container">
      <div class="page-title"><h1 class="h1">Carrito</h1><a class="text-btn" href="/tienda">${icon('chevron-left', 'icon-sm')} Continuar comprando</a></div>
      ${cart.issues.length ? html`<div class="alert alert-warning" style="margin-bottom:20px">${icon('circle-alert')}<span>${cart.issues.map((i) => i.message).join(' ')}</span></div>` : ''}
      <div class="two-col">
        <div>
          <table class="cart-table">
            <thead><tr><th scope="col">Producto</th><th scope="col" class="hide-sm">Precio</th><th scope="col">Cantidad</th><th scope="col" class="num">Subtotal</th></tr></thead>
            <tbody>
              ${lines.map((l) => html`<tr>
                <td><div class="cart-item"><a href="/producto/${l.slug}">${lineThumb(l)}</a><div><h3><a href="/producto/${l.slug}">${l.name}</a></h3><p class="mini-meta">Color: ${l.color}<br>Talla: ${l.size}</p>
                  ${l.stock <= 3 ? html`<p class="small" style="color:var(--warning);margin:6px 0 0">Quedan ${l.stock}</p>` : ''}
                  <button class="text-btn" style="margin-top:10px" data-remove="${l.variantId}">${icon('trash-2', 'icon-sm')} Eliminar</button></div></div></td>
                <td class="hide-sm"><span class="price">${cop(l.unitPrice)}</span></td>
                <td><div class="qty" data-variant="${l.variantId}">
                  <button type="button" data-dec aria-label="Quitar una unidad" ${l.quantity <= 1 ? raw('disabled') : ''}>${icon('minus', 'icon-sm')}</button>
                  <input type="number" value="${l.quantity}" min="1" max="${l.stock}" aria-label="Cantidad de ${l.name}" inputmode="numeric">
                  <button type="button" data-inc aria-label="Agregar una unidad" ${l.quantity >= l.stock ? raw('disabled') : ''}>${icon('plus', 'icon-sm')}</button>
                </div></td>
                <td class="num"><span class="price">${cop(l.lineTotal)}</span></td>
              </tr>`)}
            </tbody>
          </table>
          <div style="margin-top:20px"><button class="btn btn-danger btn-sm" data-clear-cart>${icon('trash-2')} Vaciar carrito</button></div>
        </div>
        <aside class="summary" aria-label="Resumen">
          <h2>Resumen</h2>
          <form class="promo-form" data-promo novalidate>
            <label class="sr-only" for="promo">Código promocional</label>
            <input class="input" id="promo" name="promo" placeholder="Código promocional" maxlength="40" value="${extra.promoCode || ''}">
            <button class="btn btn-outline btn-sm" type="submit">Aplicar</button>
          </form>
          <p class="field-error" data-promo-error role="alert"></p>
          ${cart.shippingMethods.length > 1 ? html`
            <fieldset style="border:0;padding:0;margin:0"><legend class="label" style="margin-bottom:8px">Entrega</legend><div class="radio-cards">
              ${cart.shippingMethods.map((m) => html`<label class="radio-card"><span class="check"><input type="radio" name="ship" value="${m.id}" ${cart.shippingMethod?.id === m.id ? raw('checked') : ''}> ${m.name}</span><span class="price">${cop(m.price)}</span></label>`)}
            </div></fieldset>` : ''}
          <div>
            <div class="totals-row"><span>Subtotal</span><span class="price">${cop(cart.subtotal)}</span></div>
            ${cart.discount ? html`<div class="totals-row"><span>Descuento ${cart.promoCode ? `(${cart.promoCode})` : ''}</span><span class="price">-${cop(cart.discount)}</span></div>` : ''}
            <div class="totals-row"><span>Envío</span><span>${cart.shippingDefined ? (cart.freeShipping ? 'Gratis' : cop(cart.shippingCost)) : html`<span class="muted">${cart.shippingMethods.length ? 'Elige un método' : 'Por confirmar'}</span>`}</span></div>
            <div class="totals-row total"><span>Total estimado</span><span>${cop(cart.total)}</span></div>
            ${cart.shippingDefined ? '' : html`<p class="small muted" style="margin-top:8px">El costo de envío se confirma por WhatsApp antes del pago.</p>`}
          </div>
          <a class="btn btn-block" href="/checkout">Proceder al checkout ${icon('arrow-right')}</a>
          <a class="btn btn-outline btn-block" href="/tienda">Continuar comprando</a>
        </aside>
      </div>
    </div>`);
  bindQtyControls(main);
  $('[data-clear-cart]').addEventListener('click', async () => {
    if (!confirmClear()) return;
    try { await clearCart(); toast('Carrito vaciado.'); } catch (err) { toast(err.message, { error: true }); }
  });
  $('[data-promo]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = e.target.promo.value.trim();
    extra.promoCode = code || null;
    await refresh(true);
  });
  main.querySelectorAll('input[name="ship"]').forEach((r) => r.addEventListener('change', () => { extra.shippingMethodId = Number(r.value); refresh(); }));
}

// Confirmación en la propia página (sin alertas del navegador)
let clearArmed = false;
function confirmClear() {
  const btn = $('[data-clear-cart]');
  if (clearArmed) return true;
  clearArmed = true;
  btn.lastChild.textContent = ' Confirmar: vaciar todo';
  setTimeout(() => { clearArmed = false; if (btn.isConnected) btn.lastChild.textContent = ' Vaciar carrito'; }, 4000);
  return false;
}

async function refresh(fromPromo = false) {
  try {
    await loadCart(extra);
    if (fromPromo && extra.promoCode) toast('Código aplicado.');
  } catch (err) {
    if (fromPromo) { extra.promoCode = null; await loadCart(extra).catch(() => {}); const box = $('[data-promo-error]'); if (box) box.textContent = err.fields?.promoCode || err.message; }
    else setHTML($('#main'), html`<div class="container" style="padding:40px 0">${errorBox(err.message)}</div>`);
  }
}

async function main() {
  await initPage();
  document.addEventListener('cart:change', () => { const err = $('[data-promo-error]')?.textContent; render(); if (err) $('[data-promo-error]').textContent = err; });
  await refresh();
}
main();
