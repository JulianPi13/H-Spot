// Página de producto: galería con zoom, selección de color y talla, stock por variante,
// cantidad limitada al inventario, añadir al carrito y comprar ahora.
import { html, raw, $, $$, setHTML, icon, cop } from '../core/dom.js';
import { api } from '../core/api.js';
import { initPage, toast, modal, openCartDrawer } from '../core/layout.js';
import { productCard, errorBox } from '../core/components.js';
import { state as store, addToCart } from '../core/store.js';

let p = null;
const sel = { color: null, size: null, qty: 1, image: 0 };

const SIZE_GUIDE = {
  top: { head: ['Talla', 'Pecho (cm)', 'Largo (cm)', 'Hombro (cm)'], rows: [['XS', '104', '68', '52'], ['S', '110', '70', '54'], ['M', '116', '72', '56'], ['L', '122', '74', '58'], ['XL', '128', '76', '60'], ['XXL', '134', '78', '62']] },
  bottom: { head: ['Talla', 'Cintura (cm)', 'Cadera (cm)', 'Largo (cm)'], rows: [['28', '72', '98', '102'], ['30', '76', '102', '103'], ['32', '81', '106', '104'], ['34', '86', '110', '105'], ['36', '91', '114', '106'], ['XS', '64', '92', '98'], ['S', '68', '96', '99'], ['M', '72', '100', '100'], ['L', '78', '106', '101']] },
};

const variantsOf = (color) => p.variants.filter((v) => v.color === color);
const current = () => p.variants.find((v) => v.color === sel.color && v.size === sel.size) || null;
const imagesFor = () => {
  const own = p.images.filter((i) => i.color === sel.color);
  const rest = p.images.filter((i) => i.color !== sel.color);
  return own.length ? [...own, ...rest] : p.images;
};

function renderGallery() {
  const imgs = imagesFor();
  if (sel.image >= imgs.length) sel.image = 0;
  const main = imgs[sel.image];
  setHTML($('[data-gallery]'), html`
    <div class="gallery-thumbs" role="list" aria-label="Fotos del producto">
      ${imgs.map((im, i) => html`<button type="button" role="listitem" data-thumb="${i}" aria-label="Ver foto ${i + 1} de ${imgs.length}" aria-current="${i === sel.image}"><img src="${im.url}" alt="" loading="lazy"></button>`)}
    </div>
    <div class="gallery-main" data-zoom role="button" tabindex="0" aria-label="Ampliar foto">
      ${main ? html`<img src="${main.url}" alt="${main.alt}" width="900" height="1125">` : ''}
      ${main && main.isDemo ? html`<span class="badge badge-demo" style="position:absolute;top:12px;left:12px">Foto provisional</span>` : ''}
      <span class="badge zoom-hint">${icon('zoom-in', 'icon-sm')} Ampliar</span>
      ${imgs.length > 1 ? html`
        <button type="button" class="icon-btn gallery-nav prev" data-step="-1" aria-label="Foto anterior">${icon('chevron-left')}</button>
        <button type="button" class="icon-btn gallery-nav next" data-step="1" aria-label="Foto siguiente">${icon('chevron-right')}</button>` : ''}
    </div>`);
}

function renderOptions() {
  const colors = [...new Map(p.variants.map((v) => [v.color, v.colorHex])).entries()];
  const sizes = p.sizes.filter((s) => variantsOf(sel.color).some((v) => v.size === s));
  const v = current();
  const max = v ? v.stock : 0;
  if (sel.qty > max) sel.qty = Math.max(1, max);
  const lowStock = v && v.stock > 0 && v.stock <= 3;

  setHTML($('[data-options]'), html`
    <div>
      <div class="option-head"><span class="label">Color: <span class="value">${sel.color}</span></span></div>
      <div class="swatches" role="radiogroup" aria-label="Color">
        ${colors.map(([name, hex]) => {
          const available = variantsOf(name).some((x) => x.stock > 0);
          return html`<button type="button" class="swatch" role="radio" data-color="${name}" aria-checked="${sel.color === name}" aria-pressed="${sel.color === name}" aria-label="${name}${available ? '' : ' (agotado)'}" title="${name}" style="background:${/^#[0-9a-f]{6}$/i.test(hex || '') ? hex : '#777'};${available ? '' : 'opacity:.35'}"></button>`;
        })}
      </div>
    </div>
    <div>
      <div class="option-head"><span class="label">Talla${sel.size ? html`: <span class="value">${sel.size}</span>` : ''}</span><button type="button" class="text-btn" data-size-guide>${icon('ruler', 'icon-sm')} Guía de tallas</button></div>
      <div class="size-grid" role="radiogroup" aria-label="Talla">
        ${sizes.map((s) => {
          const vv = variantsOf(sel.color).find((x) => x.size === s);
          const out = !vv || vv.stock <= 0;
          return html`<button type="button" class="size-btn" role="radio" data-size="${s}" aria-checked="${sel.size === s}" aria-pressed="${sel.size === s}" ${out ? raw('disabled aria-disabled="true"') : ''} aria-label="Talla ${s}${out ? ', agotada' : ''}">${s}</button>`;
        })}
      </div>
      <p class="field-error" data-size-error role="alert"></p>
    </div>
    <p class="stock-note${lowStock ? ' low' : ''}" aria-live="polite">
      ${v ? (v.stock > 0 ? html`<span class="stock-dot"></span>${lowStock ? `Últimas ${v.stock} unidades` : `Disponible (${v.stock} en stock)`}` : 'Agotado en esta combinación')
        : (p.inStock ? 'Selecciona una talla para ver disponibilidad.' : 'Producto agotado.')}
    </p>
    <div class="buy-row">
      <div class="qty qty-lg">
        <button type="button" data-qty="-1" aria-label="Disminuir cantidad" ${sel.qty <= 1 || !v ? raw('disabled') : ''}>${icon('minus', 'icon-sm')}</button>
        <input type="number" data-qty-input value="${sel.qty}" min="1" max="${max || 1}" aria-label="Cantidad" inputmode="numeric" ${!v || max === 0 ? raw('disabled') : ''}>
        <button type="button" data-qty="1" aria-label="Aumentar cantidad" ${!v || sel.qty >= max ? raw('disabled') : ''}>${icon('plus', 'icon-sm')}</button>
      </div>
      <button type="button" class="btn" data-add ${p.inStock ? '' : raw('disabled')}>${icon('shopping-bag')} ${p.inStock ? 'Añadir al carrito' : 'Agotado'}</button>
    </div>
    <button type="button" class="btn btn-outline btn-block" data-buy ${p.inStock ? '' : raw('disabled')}>Comprar ahora</button>`);
  $('.sticky-buy .price').textContent = cop(p.price);
}

function openSizeGuide() {
  const g = ['pantalones'].includes(p.category.slug) ? SIZE_GUIDE.bottom : SIZE_GUIDE.top;
  modal({
    title: 'Guía de tallas',
    body: html`
      <p class="muted small">Medidas de la prenda en centímetros (referencia de demostración: reemplázala por las medidas reales de tus prendas). Nuestro corte es amplio: si prefieres un ajuste más cercano, elige una talla menos.</p>
      <table class="size-table"><thead><tr>${g.head.map((h) => html`<th scope="col">${h}</th>`)}</tr></thead><tbody>${g.rows.filter((r) => p.sizes.includes(r[0])).map((r) => html`<tr>${r.map((c, i) => (i === 0 ? html`<th scope="row">${c}</th>` : html`<td>${c}</td>`))}</tr>`)}</tbody></table>
      ${p.sizes.includes('ÚNICA') ? html`<p class="small" style="margin-top:12px">Talla única con ajuste regulable.</p>` : ''}`,
  });
}

function openLightbox() {
  const im = imagesFor()[sel.image];
  if (!im) return;
  let lb = $('.lightbox');
  if (!lb) { lb = document.createElement('div'); lb.className = 'lightbox'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', 'Foto ampliada'); document.body.append(lb); }
  setHTML(lb, html`<button class="icon-btn" aria-label="Cerrar">${icon('x')}</button><img src="${im.url}" alt="${im.alt}">`);
  lb.classList.add('is-open');
  document.body.classList.add('no-scroll');
  const img = $('img', lb);
  // Mover la imagen siguiendo el puntero (zoom con desplazamiento)
  const move = (x, y) => {
    const r = lb.getBoundingClientRect();
    const dx = (x / r.width - 0.5) * Math.max(0, img.offsetWidth - r.width);
    const dy = (y / r.height - 0.5) * Math.max(0, img.offsetHeight - r.height);
    img.style.transform = `translate(calc(-50% - ${dx}px), calc(-50% - ${dy}px))`;
  };
  lb.onmousemove = (e) => move(e.clientX, e.clientY);
  lb.ontouchmove = (e) => { const t = e.touches[0]; move(t.clientX, t.clientY); };
  const close = () => { lb.classList.remove('is-open'); document.body.classList.remove('no-scroll'); $('[data-zoom]').focus(); document.removeEventListener('keydown', esc); };
  const esc = (e) => { if (e.key === 'Escape') close(); };
  lb.onclick = close;
  document.addEventListener('keydown', esc);
  $('button', lb).focus();
}

async function add({ goCheckout = false } = {}) {
  const v = current();
  if (!v) {
    $('[data-size-error]').textContent = 'Selecciona una talla.';
    $('.size-btn:not(:disabled)')?.focus();
    return;
  }
  const btn = goCheckout ? $('[data-buy]') : $('[data-add]');
  btn.classList.add('is-loading');
  try {
    await addToCart(v.id, sel.qty);
    const line = store.cart.lines.find((l) => l.variantId === v.id);
    if (line && line.quantity < line.requestedQuantity) toast(`Solo hay ${line.stock} unidades disponibles; ajustamos tu carrito.`);
    if (goCheckout) { location.href = '/checkout'; return; }
    toast(`${p.name} (${v.size}) añadido al carrito.`);
    openCartDrawer();
  } catch (err) {
    toast(err.message, { error: true });
  } finally { btn.classList.remove('is-loading'); }
}

function bind() {
  const root = $('#main');
  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-thumb],[data-step],[data-color],[data-size],[data-qty],[data-add],[data-buy],[data-size-guide],[data-zoom],[data-sticky-add]');
    if (!t) return;
    if (t.dataset.thumb !== undefined) { sel.image = Number(t.dataset.thumb); renderGallery(); }
    else if (t.dataset.step) { e.stopPropagation(); const n = imagesFor().length; sel.image = (sel.image + Number(t.dataset.step) + n) % n; renderGallery(); }
    else if (t.dataset.color) { sel.color = t.dataset.color; sel.image = 0; if (!variantsOf(sel.color).some((v) => v.size === sel.size && v.stock > 0)) sel.size = null; renderGallery(); renderOptions(); }
    else if (t.dataset.size) { sel.size = t.dataset.size; renderOptions(); $(`[data-size="${CSS.escape(sel.size)}"]`)?.focus(); }
    else if (t.dataset.qty) { sel.qty = Math.max(1, Math.min(current()?.stock || 1, sel.qty + Number(t.dataset.qty))); renderOptions(); }
    else if (t.dataset.add !== undefined || t.dataset.stickyAdd !== undefined) add();
    else if (t.dataset.buy !== undefined) add({ goCheckout: true });
    else if (t.dataset.sizeGuide !== undefined) openSizeGuide();
    else if (t.dataset.zoom !== undefined) openLightbox();
  });
  root.addEventListener('keydown', (e) => { if (e.target.matches('[data-zoom]') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openLightbox(); } });
  root.addEventListener('change', (e) => {
    if (e.target.matches('[data-qty-input]')) {
      const max = current()?.stock || 1;
      sel.qty = Math.max(1, Math.min(max, Math.floor(Number(e.target.value)) || 1));
      if (Number(e.target.value) > max) toast(`Solo hay ${max} unidades disponibles.`);
      renderOptions();
    }
  });
  // Barra fija de compra en móvil cuando el botón principal sale de la pantalla
  const sticky = $('.sticky-buy');
  new IntersectionObserver(([en]) => sticky.classList.toggle('is-visible', !en.isIntersecting && en.boundingClientRect.top < 0))
    .observe($('[data-options]'));
}

async function main() {
  await initPage();
  const slug = decodeURIComponent(location.pathname.split('/').pop());
  try {
    ({ product: p } = await api(`/products/${encodeURIComponent(slug)}`));
  } catch (err) {
    setHTML($('#main'), html`<div class="container" style="padding:60px 0">${errorBox(err.status === 404 ? 'Este producto no existe o ya no está disponible.' : err.message)}<p style="margin-top:16px"><a class="btn" href="/tienda">Ir a la tienda</a></p></div>`);
    return;
  }
  const firstAvailable = p.variants.find((v) => v.stock > 0) || p.variants[0];
  sel.color = firstAvailable ? firstAvailable.color : null;
  // Si solo hay una talla, se selecciona sola
  const onlySize = p.sizes.length === 1 ? p.sizes[0] : null;
  if (onlySize && variantsOf(sel.color).some((v) => v.size === onlySize && v.stock > 0)) sel.size = onlySize;

  const s = store.settings;
  setHTML($('#main'), html`
    <div class="container">
      <nav class="breadcrumbs" aria-label="Ruta"><a href="/">Inicio</a><span aria-hidden="true">/</span><a href="/tienda">Tienda</a><span aria-hidden="true">/</span><a href="/categoria/${p.category.slug}">${p.category.name}</a><span aria-hidden="true">/</span><span aria-current="page">${p.name}</span></nav>
      <div class="pdp">
        <div class="gallery" data-gallery></div>
        <div class="pdp-info">
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${p.tags.isNew ? html`<span class="badge">Nuevo</span>` : ''}${p.tags.isBestSeller ? html`<span class="badge">Best seller</span>` : ''}
            ${p.collections.map((c) => html`<a class="badge badge-muted" href="/colecciones/${c.slug}">${c.name}</a>`)}
            ${p.isDemo ? html`<span class="badge badge-demo">Producto de demostración</span>` : ''}
          </div>
          <h1 class="pdp-title">${p.name}</h1>
          <div class="pdp-price"><span class="price">${cop(p.price)}</span>${p.compareAtPrice ? html`<span class="price-old"><span class="sr-only">Precio anterior </span>${cop(p.compareAtPrice)}</span><span class="badge badge-solid">-${p.discountPercent}%</span>` : ''}</div>
          <div data-options style="display:grid;gap:22px"></div>
          <div class="pdp-perks">
            <div>${icon('truck')} <span>Envíos a toda Colombia. El costo se muestra al finalizar el pedido.</span></div>
            <div>${icon('message-circle')} <span>Confirmas tu pedido y el pago por WhatsApp con nuestro equipo.</span></div>
            <div>${icon('refresh-ccw')} <span><a class="link" href="/cambios-y-devoluciones">Cambios y devoluciones</a></span></div>
          </div>
          <div class="accordion">
            <details open><summary>Descripción ${icon('plus')}</summary><div class="acc-body">${p.description}</div></details>
            ${p.materials ? html`<details><summary>Materiales ${icon('plus')}</summary><div class="acc-body">${p.materials}</div></details>` : ''}
            ${p.care ? html`<details><summary>Cuidados ${icon('plus')}</summary><div class="acc-body">${p.care}</div></details>` : ''}
            ${s.policies.shipping ? html`<details><summary>Envíos ${icon('plus')}</summary><div class="acc-body">${s.policies.shipping.slice(0, 600)}</div></details>` : ''}
          </div>
        </div>
      </div>
      ${p.related.length ? html`
      <section class="section" aria-labelledby="rel-title">
        <div class="section-head"><div><span class="eyebrow">Combínalo con</span><h2 id="rel-title" class="h2">Productos relacionados</h2></div></div>
        <div class="grid-products">${p.related.map((r) => productCard(r))}</div>
      </section>` : ''}
    </div>
    <div class="sticky-buy" aria-hidden="true"><span class="price"></span><button type="button" class="btn" data-sticky-add tabindex="-1">Añadir al carrito</button></div>`);

  renderGallery();
  renderOptions();
  bind();
}
main();
