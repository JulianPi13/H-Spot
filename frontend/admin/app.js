// Panel administrativo H-SPOT (aplicación de una sola página con rutas #/...).
// El acceso real lo controla el servidor: si el usuario no es ADMIN, la API responde 403.
import { html, $, $$, setHTML, icon } from '/js/core/dom.js';
import { api } from '/js/core/api.js';
import { boot, state } from '/js/core/store.js';
import { toast } from '/js/core/layout.js';

const ROUTES = [
  { re: /^\/$/, title: 'Dashboard', nav: '/', load: () => import('./views/dashboard.js') },
  { re: /^\/pedidos$/, title: 'Pedidos', nav: '/pedidos', load: () => import('./views/orders.js') },
  { re: /^\/pedidos\/(\d+)$/, title: 'Detalle del pedido', nav: '/pedidos', load: () => import('./views/order-detail.js') },
  { re: /^\/productos$/, title: 'Productos', nav: '/productos', load: () => import('./views/products.js') },
  { re: /^\/productos\/(nuevo|\d+)$/, title: 'Producto', nav: '/productos', load: () => import('./views/product-edit.js') },
  { re: /^\/clientes$/, title: 'Clientes', nav: '/clientes', load: () => import('./views/customers.js') },
  { re: /^\/clientes\/(\d+)$/, title: 'Cliente', nav: '/clientes', load: () => import('./views/customer-detail.js') },
  { re: /^\/catalogo$/, title: 'Categorías y colecciones', nav: '/catalogo', load: () => import('./views/catalog.js') },
  { re: /^\/comercial$/, title: 'Envíos y promociones', nav: '/comercial', load: () => import('./views/commerce.js') },
  { re: /^\/ajustes$/, title: 'Configuración de la tienda', nav: '/ajustes', load: () => import('./views/settings.js') },
  { re: /^\/equipo$/, title: 'Administradores y auditoría', nav: '/equipo', load: () => import('./views/team.js') },
];

function shell() {
  const link = (href, ic, label) => html`<a href="#${href}" data-nav="${href}">${icon(ic)} ${label}</a>`;
  setHTML($('#admin-root'), html`
    <a class="skip-link" href="#admin-content">Saltar al contenido</a>
    <div class="admin-shell">
      <aside class="admin-side" id="admin-side" aria-label="Menú del panel">
        <div class="admin-brand"><a class="logo" href="/" title="Ver tienda">${state.settings.brand.name}<span class="logo-mark" aria-hidden="true"></span></a><span class="badge">Admin</span></div>
        <nav class="admin-nav">
          ${link('/', 'layout-dashboard', 'Dashboard')}
          ${link('/pedidos', 'package', 'Pedidos')}
          ${link('/productos', 'tag', 'Productos')}
          ${link('/clientes', 'users', 'Clientes')}
          <span class="sep">Tienda</span>
          ${link('/catalogo', 'layers', 'Categorías y colecciones')}
          ${link('/comercial', 'truck', 'Envíos y promociones')}
          ${link('/ajustes', 'settings', 'Configuración')}
          ${link('/equipo', 'shield-check', 'Equipo y auditoría')}
        </nav>
        <div class="admin-user"><strong>${state.user.fullName}</strong><span class="muted">${state.user.email}</span>
          <div style="display:flex;gap:6px"><a class="btn btn-outline btn-sm" href="/" target="_blank" rel="noopener">${icon('store', 'icon-sm')} Tienda</a><button class="btn btn-outline btn-sm" data-logout>${icon('log-out', 'icon-sm')} Salir</button></div>
        </div>
      </aside>
      <div class="admin-main">
        <header class="admin-top"><div style="display:flex;gap:8px;align-items:center"><button class="icon-btn admin-menu-btn" data-side aria-label="Abrir menú" aria-controls="admin-side">${icon('menu')}</button><h1 data-title>Panel</h1></div><div data-top-actions></div></header>
        <main class="admin-content" id="admin-content" tabindex="-1"></main>
      </div>
    </div>`);
  $('[data-logout]').addEventListener('click', async () => { await api('/auth/logout', { method: 'POST' }).catch(() => {}); location.href = '/login'; });
  $('[data-side]').addEventListener('click', () => $('#admin-side').classList.toggle('is-open'));
}

let navToken = 0;
async function route() {
  const path = (location.hash.replace(/^#/, '') || '/').split('?')[0];
  const r = ROUTES.find((x) => x.re.test(path));
  const content = $('#admin-content');
  $('#admin-side').classList.remove('is-open');
  setHTML($('[data-top-actions]'), '');
  if (!r) { setHTML(content, html`<div class="empty"><h2 class="h3">Sección no encontrada</h2><p><a class="link" href="#/">Ir al dashboard</a></p></div>`); return; }
  $$('[data-nav]').forEach((a) => a.setAttribute('aria-current', a.dataset.nav === r.nav ? 'page' : 'false'));
  $('[data-title]').textContent = r.title;
  document.title = `${r.title} | Panel ${state.settings.brand.name}`;
  setHTML(content, html`<div class="spinner"></div>`);
  const token = ++navToken;
  try {
    const mod = await r.load();
    if (token !== navToken) return;
    await mod.render(content, { params: path.match(r.re).slice(1), query: new URLSearchParams(location.hash.split('?')[1] || ''), setTitle: (t) => { $('[data-title]').textContent = t; }, topActions: $('[data-top-actions]') });
  } catch (err) {
    if (err.status === 401 || err.status === 403) { location.href = '/login?next=/admin'; return; }
    setHTML(content, html`<div class="alert alert-error">${icon('circle-alert')}<span>${err.message}</span></div>`);
  }
}

async function main() {
  try { await boot(); } catch (err) { setHTML($('#admin-root'), html`<div class="denied"><p>${err.message}</p></div>`); return; }
  if (!state.user) { location.replace('/login?next=/admin'); return; }
  if (state.user.role !== 'ADMIN') {
    setHTML($('#admin-root'), html`<div class="denied">${icon('lock', 'icon-lg')}<h1 class="h2">Acceso restringido</h1><p class="muted">Tu cuenta no tiene permisos de administración.</p><a class="btn" href="/">Volver a la tienda</a></div>`);
    return;
  }
  shell();
  window.addEventListener('hashchange', route);
  route();
}
main();

export { toast };
