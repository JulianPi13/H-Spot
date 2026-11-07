// Estructura común de todas las páginas: anuncio, header, menú móvil, buscador,
// carrito lateral, footer, avisos (toasts) y ventanas modales.
import { html, raw, $, $$, setHTML, icon, cop, debounce } from './dom.js';
import { api } from './api.js';
import { state, boot, loadCart, cartCount, setQuantity } from './store.js';
import { lineThumb } from './components.js';

// ---------- Avisos ----------
export function toast(message, { error = false, timeout = 3200 } = {}) {
  let box = $('.toasts');
  if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite'); document.body.append(box); }
  const el = document.createElement('div');
  el.className = 'toast' + (error ? ' is-error' : '');
  setHTML(el, html`${icon(error ? 'circle-alert' : 'circle-check')}<span>${message}</span>`);
  box.append(el);
  setTimeout(() => { el.classList.add('is-leaving'); setTimeout(() => el.remove(), 300); }, timeout);
}

// ---------- Paneles y modales accesibles ----------
let lastFocus = null;
const overlay = () => {
  let o = $('#overlay');
  if (!o) { o = document.createElement('div'); o.id = 'overlay'; o.className = 'overlay'; document.body.append(o); o.addEventListener('click', closeAll); }
  return o;
};

function trapFocus(container, e) {
  const nodes = $$('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])', container).filter((n) => n.offsetParent !== null);
  if (!nodes.length) return;
  const first = nodes[0]; const last = nodes[nodes.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

export function openPanel(panel) {
  closeAll(false);
  lastFocus = document.activeElement;
  panel.classList.add('is-open');
  panel.setAttribute('aria-hidden', 'false');
  if (!panel.classList.contains('modal') && !panel.classList.contains('search-panel')) overlay().classList.add('is-open');
  if (panel.classList.contains('search-panel')) overlay().classList.add('is-open');
  document.body.classList.add('no-scroll');
  const focusable = panel.querySelector('[data-autofocus]') || panel.querySelector('button, a, input');
  setTimeout(() => focusable && focusable.focus(), 60);
  panel._trap = (e) => { if (e.key === 'Tab') trapFocus(panel, e); };
  panel.addEventListener('keydown', panel._trap);
}

export function closeAll(restoreFocus = true) {
  $$('.drawer.is-open, .modal.is-open, .search-panel.is-open').forEach((p) => {
    p.classList.remove('is-open'); p.setAttribute('aria-hidden', 'true');
    if (p._trap) p.removeEventListener('keydown', p._trap);
  });
  const o = $('#overlay'); if (o) o.classList.remove('is-open');
  document.body.classList.remove('no-scroll');
  $$('[data-menu-toggle]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  if (restoreFocus && lastFocus && lastFocus.focus) lastFocus.focus();
}

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });

export function modal({ title, body, id = 'modal' }) {
  let m = document.getElementById(id);
  if (!m) {
    m = document.createElement('div');
    m.id = id; m.className = 'modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-hidden', 'true');
    m.addEventListener('click', (e) => { if (e.target === m) closeAll(); });
    document.body.append(m);
  }
  m.setAttribute('aria-label', title);
  setHTML(m, html`<div class="modal-box"><div class="modal-head"><h2>${title}</h2><button class="icon-btn" data-close aria-label="Cerrar">${icon('x')}</button></div><div class="modal-body">${body}</div></div>`);
  $('[data-close]', m).addEventListener('click', () => closeAll());
  openPanel(m);
  return m;
}

// ---------- Header ----------
function navLinks(path) {
  const cur = (href) => (path === href ? raw(' aria-current="page"') : '');
  const collections = state.boot.collections || [];
  return html`
    <a class="nav-link" href="/"${cur('/')}>Inicio</a>
    <a class="nav-link" href="/tienda"${cur('/tienda')}>Tienda</a>
    <a class="nav-link" href="/hombre"${cur('/hombre')}>Hombre</a>
    <a class="nav-link" href="/mujer"${cur('/mujer')}>Mujer</a>
    <a class="nav-link" href="/unisex"${cur('/unisex')}>Unisex</a>
    <div class="nav-item" data-dropdown>
      <button class="nav-link" aria-expanded="false" aria-haspopup="true" ${path.startsWith('/colecciones') ? raw('aria-current="page"') : ''}>Colecciones ${icon('chevron-down', 'icon-sm')}</button>
      <div class="dropdown" role="menu">
        ${collections.map((c) => html`<a role="menuitem" href="/colecciones/${c.slug}">${c.name}${c.isDrop ? html`<span class="badge">Drop</span>` : ''}</a>`)}
        <a role="menuitem" href="/colecciones">Ver todas ${icon('arrow-right', 'icon-sm')}</a>
      </div>
    </div>
    <a class="nav-link" href="/ofertas"${cur('/ofertas')}>Ofertas</a>`;
}

function renderHeader() {
  const s = state.settings;
  const path = location.pathname;
  const ann = s.announcement;
  const header = document.getElementById('site-header');
  const logo = s.brand.logoUrl
    ? html`<img src="${s.brand.logoUrl}" alt="${s.brand.name}" width="120" height="28">`
    : html`${s.brand.name}<span class="logo-mark" aria-hidden="true"></span>`;

  setHTML(header, html`
    <a class="skip-link" href="#main">Saltar al contenido</a>
    ${ann.enabled && ann.messages.length ? html`<div class="announce" role="region" aria-label="Anuncios"><div class="announce-track">${ann.messages.map((m, i) => html`<p class="announce-item${i === 0 ? ' is-active' : ''}">${m}</p>`)}</div></div>` : ''}
    <header class="site-header">
      <div class="container header-inner">
        <button class="icon-btn menu-toggle" data-menu-toggle aria-label="Abrir menú" aria-expanded="false" aria-controls="mobile-menu">${icon('menu')}</button>
        <a class="logo" href="/" aria-label="${s.brand.name}, ir al inicio">${logo}</a>
        <nav class="nav-main" aria-label="Principal">${navLinks(path)}</nav>
        <div class="header-actions">
          <button class="icon-btn" data-search-open aria-label="Buscar productos">${icon('search')}</button>
          <a class="icon-btn hide-mobile" href="${state.user ? '/cuenta' : '/login'}" aria-label="${state.user ? 'Mi cuenta' : 'Iniciar sesión'}">${icon('user')}</a>
          <button class="icon-btn cart-btn" data-cart-open aria-label="Abrir carrito">${icon('shopping-bag')}<span class="cart-count" hidden>0</span></button>
        </div>
      </div>
    </header>`);

  // Rotación de anuncios
  const items = $$('.announce-item', header);
  if (items.length > 1 && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let i = 0;
    setInterval(() => { items[i].classList.remove('is-active'); i = (i + 1) % items.length; items[i].classList.add('is-active'); }, 4200);
  }

  // Menú desplegable (clic y teclado)
  $$('[data-dropdown]', header).forEach((dd) => {
    const btn = $('button', dd);
    const set = (open) => { dd.dataset.open = String(open); btn.setAttribute('aria-expanded', String(open)); };
    btn.addEventListener('click', () => set(dd.dataset.open !== 'true'));
    dd.addEventListener('mouseenter', () => set(true));
    dd.addEventListener('mouseleave', () => set(false));
    dd.addEventListener('focusout', (e) => { if (!dd.contains(e.relatedTarget)) set(false); });
    dd.addEventListener('keydown', (e) => { if (e.key === 'Escape') { set(false); btn.focus(); } });
  });

  $('[data-menu-toggle]', header).addEventListener('click', (e) => { e.currentTarget.setAttribute('aria-expanded', 'true'); openPanel($('#mobile-menu')); });
  $('[data-search-open]', header).addEventListener('click', () => openPanel($('#search-panel')));
  $('[data-cart-open]', header).addEventListener('click', openCartDrawer);
}

function renderPanels() {
  const s = state.settings;
  const wrap = document.createElement('div');
  setHTML(wrap, html`
    <aside id="mobile-menu" class="drawer from-left" aria-hidden="true" aria-label="Menú">
      <div class="drawer-head"><span class="logo">${s.brand.name}<span class="logo-mark" aria-hidden="true"></span></span><button class="icon-btn" data-close aria-label="Cerrar menú">${icon('x')}</button></div>
      <div class="drawer-body">
        <nav class="mobile-nav" aria-label="Menú móvil">
          <a href="/">Inicio ${icon('arrow-right')}</a>
          <a href="/tienda">Tienda ${icon('arrow-right')}</a>
          <a href="/hombre">Hombre ${icon('arrow-right')}</a>
          <a href="/mujer">Mujer ${icon('arrow-right')}</a>
          <a href="/unisex">Unisex ${icon('arrow-right')}</a>
          <button class="mobile-sub-toggle" aria-expanded="false" aria-controls="m-collections">Colecciones ${icon('chevron-down')}</button>
          <div class="mobile-sub" id="m-collections" hidden>
            ${(state.boot.collections || []).map((c) => html`<a href="/colecciones/${c.slug}">${c.name}</a>`)}
            <a href="/colecciones">Ver todas</a>
          </div>
          <a href="/ofertas">Ofertas ${icon('arrow-right')}</a>
        </nav>
        <div class="mobile-nav-foot">
          <a class="btn btn-outline btn-block" href="${state.user ? '/cuenta' : '/login'}">${icon('user')} ${state.user ? 'Mi cuenta' : 'Iniciar sesión'}</a>
        </div>
      </div>
    </aside>

    <div id="search-panel" class="search-panel" role="dialog" aria-modal="true" aria-label="Buscar" aria-hidden="true">
      <div class="container">
        <form class="search-bar" role="search" action="/tienda">
          ${icon('search', 'icon-lg')}
          <label class="sr-only" for="search-input">Buscar productos</label>
          <input id="search-input" name="q" type="search" placeholder="Buscar hoodies, cargos, camisetas..." autocomplete="off" data-autofocus maxlength="80">
          <button type="button" class="icon-btn" data-close aria-label="Cerrar buscador">${icon('x')}</button>
        </form>
        <div class="search-results" aria-live="polite"></div>
      </div>
    </div>

    <aside id="cart-drawer" class="drawer from-right" aria-hidden="true" aria-label="Carrito">
      <div class="drawer-head"><h2>Tu carrito <span class="muted" data-cart-n></span></h2><button class="icon-btn" data-close aria-label="Cerrar carrito">${icon('x')}</button></div>
      <div class="drawer-body" data-cart-body><div class="spinner"></div></div>
      <div class="drawer-foot" data-cart-foot hidden></div>
    </aside>`);
  document.body.append(...wrap.children);

  $$('[data-close]').forEach((b) => b.addEventListener('click', () => closeAll()));
  const sub = $('.mobile-sub-toggle');
  sub.addEventListener('click', () => { const open = sub.getAttribute('aria-expanded') !== 'true'; sub.setAttribute('aria-expanded', String(open)); $('#m-collections').hidden = !open; });

  // Búsqueda en vivo
  const input = $('#search-input');
  const results = $('.search-results');
  const run = debounce(async () => {
    const q = input.value.trim();
    if (q.length < 2) { setHTML(results, ''); return; }
    setHTML(results, html`<div class="spinner"></div>`);
    try {
      const data = await api(`/products?q=${encodeURIComponent(q)}&limit=8`);
      if (!data.items.length) { setHTML(results, html`<p class="muted">No encontramos productos para "${q}".</p>`); return; }
      setHTML(results, html`
        <p class="eyebrow" style="margin-bottom:16px">${data.total} resultado${data.total === 1 ? '' : 's'}</p>
        <div class="search-grid">${data.items.map((p) => html`<a class="search-hit" href="/producto/${p.slug}"><img src="${p.images[0]?.url || ''}" alt="${p.images[0]?.alt || p.name}" loading="lazy"><span>${p.name}</span><span class="price">${cop(p.price)}</span></a>`)}</div>
        <p style="margin-top:22px"><a class="btn btn-outline btn-sm" href="/tienda?q=${encodeURIComponent(q)}">Ver todos los resultados ${icon('arrow-right')}</a></p>`);
    } catch (err) { setHTML(results, html`<p class="field-error">${err.message}</p>`); }
  }, 280);
  input.addEventListener('input', run);
}

// ---------- Carrito lateral ----------
export async function openCartDrawer() {
  const drawer = $('#cart-drawer');
  openPanel(drawer);
  try { await loadCart(); } catch (err) { setHTML($('[data-cart-body]'), html`<div class="alert alert-error">${icon('circle-alert')}<span>${err.message}</span></div>`); }
}

function renderCartDrawer() {
  const cart = state.cart;
  const body = $('[data-cart-body]');
  const foot = $('[data-cart-foot]');
  if (!body || !cart) return;
  const lines = cart.lines.filter((l) => l.quantity > 0);
  $('[data-cart-n]').textContent = lines.length ? `(${cartCount()})` : '';
  if (!lines.length) {
    setHTML(body, html`<div class="empty">${icon('shopping-bag', 'icon-lg')}<h3 class="h3">Tu carrito está vacío</h3><p>Explora la tienda y encuentra tu próxima prenda.</p><a class="btn" href="/tienda">Ir a la tienda</a></div>`);
    foot.hidden = true;
    return;
  }
  setHTML(body, html`
    ${cart.issues.length ? html`<div class="alert alert-warning" style="margin-bottom:12px">${icon('circle-alert')}<span>${cart.issues.map((i) => i.message).join(' ')}</span></div>` : ''}
    ${lines.map((l) => html`
      <div class="mini-line">
        <a href="/producto/${l.slug}">${lineThumb(l)}</a>
        <div>
          <h3><a href="/producto/${l.slug}">${l.name}</a></h3>
          <p class="mini-meta">${l.color} / Talla ${l.size}</p>
          <div class="mini-row">
            <div class="qty" data-variant="${l.variantId}">
              <button type="button" data-dec aria-label="Quitar una unidad de ${l.name}" ${l.quantity <= 1 ? raw('disabled') : ''}>${icon('minus', 'icon-sm')}</button>
              <input type="number" value="${l.quantity}" min="1" max="${l.stock}" aria-label="Cantidad de ${l.name}" inputmode="numeric">
              <button type="button" data-inc aria-label="Agregar una unidad de ${l.name}" ${l.quantity >= l.stock ? raw('disabled') : ''}>${icon('plus', 'icon-sm')}</button>
            </div>
            <span class="price">${cop(l.lineTotal)}</span>
          </div>
          <button class="text-btn" style="margin-top:10px" data-remove="${l.variantId}">${icon('trash-2', 'icon-sm')} Eliminar</button>
        </div>
      </div>`)}`);
  foot.hidden = false;
  setHTML(foot, html`
    <div class="totals-row"><span>Subtotal</span><span class="price">${cop(cart.subtotal)}</span></div>
    <div class="totals-row"><span class="muted">Envío</span><span class="muted">Se calcula en el checkout</span></div>
    <div style="display:grid;gap:8px;margin-top:14px">
      <a class="btn btn-block" href="/checkout">Finalizar pedido ${icon('arrow-right')}</a>
      <a class="btn btn-outline btn-block" href="/carrito">Ver carrito</a>
    </div>`);
  bindQtyControls(body);
}

// Controles de cantidad reutilizables (carrito lateral y página de carrito)
export function bindQtyControls(root) {
  $$('.qty[data-variant]', root).forEach((box) => {
    const id = Number(box.dataset.variant);
    const input = $('input', box);
    const max = Number(input.max) || 99;
    const update = async (q) => {
      q = Math.max(1, Math.min(max, Math.floor(q) || 1));
      $$('button', box).forEach((b) => { b.disabled = true; });
      try { await setQuantity(id, q); } catch (err) { toast(err.message, { error: true }); await loadCart(); }
    };
    $('[data-dec]', box).addEventListener('click', () => update(Number(input.value) - 1));
    $('[data-inc]', box).addEventListener('click', () => update(Number(input.value) + 1));
    input.addEventListener('change', () => update(Number(input.value)));
  });
  $$('[data-remove]', root).forEach((b) => b.addEventListener('click', async () => {
    try { await setQuantity(Number(b.dataset.remove), 0); toast('Producto eliminado del carrito.'); } catch (err) { toast(err.message, { error: true }); }
  }));
}

function updateCount() {
  const n = cartCount();
  $$('.cart-count').forEach((c) => {
    const changed = c.textContent !== String(n);
    c.textContent = n > 99 ? '99+' : String(n);
    c.hidden = n === 0;
    if (changed && n > 0) { c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); }
  });
  $$('[data-cart-open]').forEach((b) => b.setAttribute('aria-label', `Abrir carrito, ${n} producto${n === 1 ? '' : 's'}`));
}

// ---------- Footer ----------
function renderFooter() {
  const s = state.settings;
  const footer = document.getElementById('site-footer');
  const social = [
    s.social.instagram && html`<a class="icon-btn" href="${s.social.instagram}" target="_blank" rel="noopener noreferrer" aria-label="Instagram de ${s.brand.name}">${icon('social-ig')}</a>`,
    s.social.tiktok && html`<a class="icon-btn" href="${s.social.tiktok}" target="_blank" rel="noopener noreferrer" aria-label="TikTok de ${s.brand.name}">${icon('social-tt')}</a>`,
  ].filter(Boolean);
  setHTML(footer, html`
    <footer class="site-footer">
      <div class="container">
        <div class="footer-top">
          <div class="footer-brand">
            <a class="logo" href="/">${s.brand.name}<span class="logo-mark" aria-hidden="true"></span></a>
            <p>${s.brand.tagline}</p>
            ${social.length ? html`<div class="footer-social">${social}</div>` : ''}
          </div>
          <div class="footer-col"><h3>Tienda</h3><a href="/tienda">Todo</a><a href="/hombre">Hombre</a><a href="/mujer">Mujer</a><a href="/unisex">Unisex</a><a href="/ofertas">Ofertas</a><a href="/colecciones">Colecciones</a></div>
          <div class="footer-col"><h3>Ayuda</h3><a href="/envios">Envíos</a><a href="/cambios-y-devoluciones">Cambios y devoluciones</a><a href="/terminos">Términos y condiciones</a><a href="/politica-de-datos">Tratamiento de datos</a></div>
          <div class="footer-col"><h3>Contacto</h3>
            <a href="https://wa.me/${s.whatsapp.number}" target="_blank" rel="noopener noreferrer">WhatsApp ${s.brand.contactPhone}</a>
            ${s.brand.contactEmail ? html`<a href="mailto:${s.brand.contactEmail}">${s.brand.contactEmail}</a>` : ''}
            ${s.brand.city ? html`<p class="muted small" style="margin-top:6px">${s.brand.city}</p>` : ''}
            <a href="${state.user ? '/cuenta' : '/login'}">${state.user ? 'Mi cuenta' : 'Iniciar sesión'}</a>
          </div>
        </div>
      </div>
      <div class="footer-wordmark" aria-hidden="true">${s.brand.name}</div>
      <div class="container footer-bottom"><span>© ${new Date().getFullYear()} ${s.brand.name}. Todos los derechos reservados.</span><span>Precios en COP</span></div>
    </footer>`);
}

// ---------- Inicio de cada página ----------
export async function initPage() {
  try {
    await boot();
  } catch (err) {
    const main = document.getElementById('main');
    if (main) setHTML(main, html`<div class="container" style="padding:80px 0"><div class="alert alert-error">${icon('circle-alert')}<span>${err.message}</span></div></div>`);
    throw err;
  }
  renderHeader();
  renderPanels();
  renderFooter();
  document.addEventListener('cart:change', () => { updateCount(); renderCartDrawer(); });
  updateCount();
  loadCart().catch(() => {});
  return state;
}
