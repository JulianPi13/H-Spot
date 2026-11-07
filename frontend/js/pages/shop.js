// Catálogo: búsqueda, filtros reales (consultados al servidor), orden y carga progresiva.
import { html, $, $$, setHTML, icon, cop, debounce } from '../core/dom.js';
import { api } from '../core/api.js';
import { initPage, openPanel, closeAll } from '../core/layout.js';
import { productCard, skeletonCards, errorBox } from '../core/components.js';
import { state } from '../core/store.js';

const PRESETS = {
  '/tienda': { title: 'Tienda', text: 'Todas las prendas disponibles.' },
  '/hombre': { title: 'Hombre', text: 'Prendas para hombre y unisex.', f: { genero: 'HOMBRE' } },
  '/mujer': { title: 'Mujer', text: 'Prendas para mujer y unisex.', f: { genero: 'MUJER' } },
  '/unisex': { title: 'Unisex', text: 'Siluetas pensadas para cualquier persona.', f: { genero: 'UNISEX' } },
  '/ofertas': { title: 'Ofertas', text: 'Precios especiales mientras haya existencias.', f: { oferta: true } },
  '/novedades': { title: 'Novedades', text: 'Lo último que llegó a la tienda.', f: { nuevo: true } },
};
const SORTS = [['novedades', 'Novedades'], ['populares', 'Más populares'], ['precio_asc', 'Precio: menor a mayor'], ['precio_desc', 'Precio: mayor a menor']];
const LIMIT = 12;

let facets = null;
let preset = {};
let f = {};
let page = 1;
let loaded = [];
let requestId = 0;

function readUrl() {
  const p = new URLSearchParams(location.search);
  const list = (k) => (p.get(k) ? p.get(k).split(',').filter(Boolean) : []);
  return {
    q: p.get('q') || '', categoria: p.get('categoria') || '', coleccion: p.get('coleccion') || '', genero: p.get('genero') || '',
    tallas: list('tallas'), colores: list('colores'), min: p.get('min') || '', max: p.get('max') || '',
    disponible: p.get('disponible') === '1', oferta: p.get('oferta') === '1', nuevo: p.get('nuevo') === '1',
    destacado: p.get('destacado') === '1', orden: p.get('orden') || 'novedades',
  };
}

function toQuery(obj, withPreset = true) {
  const merged = withPreset ? { ...obj, ...preset } : obj;
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v === '' || v === false || v === undefined || v === null || (Array.isArray(v) && !v.length)) continue;
    if (k === 'orden' && v === 'novedades') continue;
    p.set(k, Array.isArray(v) ? v.join(',') : v === true ? '1' : String(v));
  }
  return p;
}

function syncUrl() {
  const own = { ...f };
  for (const k of Object.keys(preset)) delete own[k];
  const qs = toQuery(own, false).toString();
  history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
}

function activeCount() {
  let n = 0;
  if (f.q) n++; if (f.categoria && !preset.categoria) n++; if (f.coleccion && !preset.coleccion) n++;
  if (f.genero && !preset.genero) n++; n += f.tallas.length + f.colores.length;
  if (f.min || f.max) n++; if (f.disponible) n++; if (f.oferta && !preset.oferta) n++; if (f.nuevo && !preset.nuevo) n++; if (f.destacado) n++;
  return n;
}

function filtersForm() {
  const chip = (group, value, label = value) => html`<button type="button" class="chip" data-group="${group}" data-value="${value}" aria-pressed="${f[group].includes(value)}">${label}</button>`;
  return html`
    <form class="filters-form" data-filters novalidate>
      ${preset.categoria ? '' : html`
      <div class="filter-group"><fieldset><legend>Categoría</legend>
        <label class="check"><input type="radio" name="categoria" value="" ${!f.categoria ? html`checked` : ''}> Todas</label>
        ${facets.categories.map((c) => html`<label class="check"><input type="radio" name="categoria" value="${c.slug}" ${f.categoria === c.slug ? html`checked` : ''}> ${c.name}</label>`)}
      </fieldset></div>`}
      ${preset.genero ? '' : html`
      <div class="filter-group"><fieldset><legend>Género</legend>
        ${[['', 'Todos'], ['HOMBRE', 'Hombre'], ['MUJER', 'Mujer'], ['UNISEX', 'Unisex']].map(([v, l]) => html`<label class="check"><input type="radio" name="genero" value="${v}" ${f.genero === v ? html`checked` : ''}> ${l}</label>`)}
      </fieldset></div>`}
      <div class="filter-group"><p class="filter-title" id="t-tallas">Talla</p><div class="chips" role="group" aria-labelledby="t-tallas">${facets.sizes.map((s) => chip('tallas', s))}</div></div>
      <div class="filter-group"><p class="filter-title" id="t-colores">Color</p><div class="swatches" role="group" aria-labelledby="t-colores">
        ${facets.colors.map((c) => html`<button type="button" class="swatch" data-group="colores" data-value="${c.name}" aria-pressed="${f.colores.includes(c.name)}" aria-label="${c.name}" title="${c.name}" style="background:${/^#[0-9a-f]{6}$/i.test(c.hex || '') ? c.hex : '#777'}"></button>`)}
      </div></div>
      <div class="filter-group"><fieldset><legend>Precio (COP)</legend>
        <div class="price-inputs">
          <label><span class="sr-only">Precio mínimo</span><input class="input" name="min" type="number" inputmode="numeric" min="0" step="1000" placeholder="Mín. ${cop(facets.price.min)}" value="${f.min}"></label>
          <label><span class="sr-only">Precio máximo</span><input class="input" name="max" type="number" inputmode="numeric" min="0" step="1000" placeholder="Máx. ${cop(facets.price.max)}" value="${f.max}"></label>
        </div>
      </fieldset></div>
      ${preset.coleccion || !facets.collections.length ? '' : html`
      <div class="filter-group"><label class="filter-title" for="f-coleccion">Colección</label>
        <select class="select" id="f-coleccion" name="coleccion"><option value="">Todas</option>${facets.collections.map((c) => html`<option value="${c.slug}" ${f.coleccion === c.slug ? html`selected` : ''}>${c.name}</option>`)}</select>
      </div>`}
      <div class="filter-group"><fieldset><legend>Mostrar</legend>
        <label class="check"><input type="checkbox" name="disponible" ${f.disponible ? html`checked` : ''}> Solo disponibles</label>
        ${preset.oferta ? '' : html`<label class="check"><input type="checkbox" name="oferta" ${f.oferta ? html`checked` : ''}> En oferta</label>`}
        ${preset.nuevo ? '' : html`<label class="check"><input type="checkbox" name="nuevo" ${f.nuevo ? html`checked` : ''}> Novedades</label>`}
      </fieldset></div>
      <div class="filter-group"><button type="button" class="btn btn-outline btn-block btn-sm" data-clear>${icon('x', 'icon-sm')} Limpiar filtros</button></div>
    </form>`;
}

function activePills() {
  const pills = [];
  const pill = (label, clear) => pills.push(html`<button type="button" class="filter-pill" data-clear-one="${clear}">${label} ${icon('x', 'icon-sm')}</button>`);
  if (f.q) pill(`Búsqueda: "${f.q}"`, 'q');
  if (f.categoria && !preset.categoria) pill(facets.categories.find((c) => c.slug === f.categoria)?.name || f.categoria, 'categoria');
  if (f.genero && !preset.genero) pill(f.genero.charAt(0) + f.genero.slice(1).toLowerCase(), 'genero');
  f.tallas.forEach((t) => pill(`Talla ${t}`, `tallas:${t}`));
  f.colores.forEach((c) => pill(c, `colores:${c}`));
  if (f.min || f.max) pill(`${f.min ? cop(Number(f.min)) : '$0'} – ${f.max ? cop(Number(f.max)) : 'máx.'}`, 'precio');
  if (f.coleccion && !preset.coleccion) pill(facets.collections.find((c) => c.slug === f.coleccion)?.name || f.coleccion, 'coleccion');
  if (f.disponible) pill('Disponibles', 'disponible');
  if (f.oferta && !preset.oferta) pill('En oferta', 'oferta');
  if (f.nuevo && !preset.nuevo) pill('Novedades', 'nuevo');
  if (f.destacado) pill('Destacados', 'destacado');
  return pills;
}

async function load(reset = true) {
  const id = ++requestId;
  if (reset) { page = 1; loaded = []; setHTML($('[data-grid]'), skeletonCards(8)); }
  syncUrl();
  setHTML($('[data-active]'), activePills());
  const count = activeCount();
  $$('[data-filter-count]').forEach((e) => { e.textContent = count ? `(${count})` : ''; });
  const q = toQuery(f);
  q.set('page', page); q.set('limit', LIMIT);
  try {
    const data = await api('/products?' + q.toString());
    if (id !== requestId) return; // llegó una respuesta más nueva
    loaded = loaded.concat(data.items);
    $('[data-count]').textContent = `${data.total} producto${data.total === 1 ? '' : 's'}`;
    $$('[data-apply-count]').forEach((b) => { b.textContent = `Ver ${data.total} resultado${data.total === 1 ? '' : 's'}`; });
    if (!loaded.length) {
      setHTML($('[data-grid]'), '');
      setHTML($('[data-results]'), html`<div class="empty">${icon('search', 'icon-lg')}<h3 class="h3">Sin resultados</h3><p>No encontramos prendas con estos filtros. Prueba quitando alguno.</p><button class="btn btn-outline" data-clear>Limpiar filtros</button></div>`);
    } else {
      setHTML($('[data-results]'), '');
      setHTML($('[data-grid]'), loaded.map((p, i) => productCard(p, { eager: i < 4 })));
    }
    const more = $('[data-more]');
    if (loaded.length < data.total) {
      setHTML(more, html`<p>Mostrando ${loaded.length} de ${data.total}</p><div class="progress" aria-hidden="true"><span style="width:${Math.round((loaded.length / data.total) * 100)}%"></span></div><button class="btn btn-outline" data-load-more>Cargar más</button>`);
    } else setHTML(more, loaded.length > LIMIT ? html`<p>Has visto los ${data.total} productos</p>` : '');
  } catch (err) {
    if (id !== requestId) return;
    setHTML($('[data-grid]'), '');
    setHTML($('[data-results]'), html`${errorBox(err.message)}<p style="margin-top:12px"><button class="btn btn-outline btn-sm" data-retry>Reintentar</button></p>`);
  }
}

const reload = debounce(() => load(true), 200);

function bindFilters(root) {
  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-group]');
    if (t) {
      const g = t.dataset.group; const v = t.dataset.value;
      f[g] = f[g].includes(v) ? f[g].filter((x) => x !== v) : [...f[g], v];
      $$(`[data-group="${g}"][data-value="${CSS.escape(v)}"]`).forEach((b) => b.setAttribute('aria-pressed', String(f[g].includes(v))));
      reload();
    }
  });
  root.addEventListener('change', (e) => {
    const el = e.target;
    if (!el.name) return;
    if (el.type === 'checkbox') f[el.name] = el.checked;
    else if (el.name === 'min' || el.name === 'max') f[el.name] = el.value && Number(el.value) >= 0 ? String(Math.floor(Number(el.value))) : '';
    else f[el.name] = el.value;
    reload();
  });
}

function rerenderFilters() {
  setHTML($('[data-filters-slot]'), filtersForm());
}

async function main() {
  await initPage();
  const path = location.pathname;
  let head = PRESETS[path] || PRESETS['/tienda'];
  preset = { ...(head.f || {}) };

  facets = await api('/products/facets').catch(() => ({ categories: [], collections: [], sizes: [], colors: [], price: { min: 0, max: 0 } }));
  const m = path.match(/^\/(colecciones|categoria)\/([^/]+)$/);
  if (m) {
    const isCol = m[1] === 'colecciones';
    const item = (isCol ? facets.collections : facets.categories).find((c) => c.slug === decodeURIComponent(m[2]));
    preset = isCol ? { coleccion: decodeURIComponent(m[2]) } : { categoria: decodeURIComponent(m[2]) };
    head = { title: item ? item.name : 'Tienda', text: item?.description || '', eyebrow: isCol ? (item?.isDrop ? 'Drop' : 'Colección') : 'Categoría' };
  }
  f = { ...readUrl(), ...preset };

  setHTML($('#main'), html`
    <div class="container">
      <nav class="breadcrumbs" aria-label="Ruta"><a href="/">Inicio</a><span aria-hidden="true">/</span>${path !== '/tienda' ? html`<a href="/tienda">Tienda</a><span aria-hidden="true">/</span>` : ''}<span aria-current="page">${head.title}</span></nav>
      <header class="shop-head">
        <div>${head.eyebrow ? html`<p class="eyebrow">${head.eyebrow}</p>` : ''}<h1 class="h1">${head.title}</h1>${head.text ? html`<p>${head.text}</p>` : ''}</div>
      </header>
      <div class="shop-layout">
        <aside class="filters filters-desktop" aria-label="Filtros" data-filters-home><div data-filters-slot></div></aside>
        <section aria-label="Productos">
          <div class="shop-toolbar">
            <div style="display:flex;gap:10px;align-items:center">
              <button class="btn btn-outline btn-sm filters-toggle" data-open-filters aria-controls="filters-drawer">${icon('sliders-horizontal')} Filtros <span data-filter-count></span></button>
              <span class="muted small" data-count aria-live="polite"></span>
            </div>
            <label><span class="sr-only">Ordenar por</span><select class="select" data-sort>${SORTS.map(([v, l]) => html`<option value="${v}" ${f.orden === v ? html`selected` : ''}>${l}</option>`)}</select></label>
          </div>
          <div class="active-filters" data-active></div>
          <div data-results></div>
          <div class="grid-products" data-grid></div>
          <div class="load-more" data-more></div>
        </section>
      </div>
    </div>
    <aside id="filters-drawer" class="drawer from-left" aria-hidden="true" aria-label="Filtros">
      <div class="drawer-head"><h2>Filtros <span data-filter-count></span></h2><button class="icon-btn" data-close-filters aria-label="Cerrar filtros">${icon('x')}</button></div>
      <div class="drawer-body" data-filters-mobile></div>
      <div class="drawer-foot"><button class="btn btn-block" data-close-filters data-apply-count>Ver resultados</button></div>
    </aside>`);

  rerenderFilters();
  bindFilters(document.body);

  const slot = $('[data-filters-slot]');
  $('[data-open-filters]').addEventListener('click', () => { $('[data-filters-mobile]').append(slot); openPanel($('#filters-drawer')); });
  const restore = () => { $('[data-filters-home]').append(slot); };
  $$('[data-close-filters]').forEach((b) => b.addEventListener('click', () => { closeAll(); restore(); }));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') restore(); });
  $('#overlay')?.addEventListener('click', restore);

  $('[data-sort]').addEventListener('change', (e) => { f.orden = e.target.value; load(true); });

  document.body.addEventListener('click', (e) => {
    if (e.target.closest('[data-load-more]')) { page += 1; e.target.closest('[data-load-more]').classList.add('is-loading'); load(false); }
    if (e.target.closest('[data-retry]')) load(true);
    if (e.target.closest('[data-clear]')) {
      f = { q: '', categoria: '', coleccion: '', genero: '', tallas: [], colores: [], min: '', max: '', disponible: false, oferta: false, nuevo: false, destacado: false, orden: f.orden, ...preset };
      rerenderFilters(); load(true);
    }
    const one = e.target.closest('[data-clear-one]');
    if (one) {
      const [k, v] = one.dataset.clearOne.split(':');
      if (v !== undefined) f[k] = f[k].filter((x) => x !== v);
      else if (k === 'precio') { f.min = ''; f.max = ''; }
      else f[k] = typeof f[k] === 'boolean' ? false : '';
      rerenderFilters(); load(true);
    }
  });

  if (f.q) document.title = `"${f.q}" | ${state.settings.brand.name}`;
  load(true);
}
main();

