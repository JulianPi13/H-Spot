// Piezas visuales reutilizables.
import { html, icon, cop } from './dom.js';

export function productCard(p, { eager = false } = {}) {
  const [img1, img2] = p.images;
  const badges = [];
  if (p.tags.onSale) badges.push(html`<span class="badge badge-solid">-${p.discountPercent}%</span>`);
  if (p.tags.isNew) badges.push(html`<span class="badge">Nuevo</span>`);
  if (p.tags.isBestSeller) badges.push(html`<span class="badge">Best seller</span>`);
  return html`
    <article class="card${p.inStock ? '' : ' is-soldout'}">
      <div class="card-media">
        ${img1 ? html`<img src="${img1.url}" alt="${img1.alt}" loading="${eager ? 'eager' : 'lazy'}" width="900" height="1125">` : ''}
        ${img2 ? html`<img class="img-alt" src="${img2.url}" alt="" loading="lazy" width="900" height="1125">` : ''}
        <div class="card-badges">${badges}</div>
        ${p.inStock ? '' : html`<div class="card-soldout">Agotado</div>`}
      </div>
      <div class="card-body">
        <span class="card-cat">${p.category.name}</span>
        <h3 class="card-title"><a href="/producto/${p.slug}">${p.name}</a></h3>
        <div><span class="price">${cop(p.price)}</span>${p.compareAtPrice ? html`<span class="price-old"><span class="sr-only">Antes </span>${cop(p.compareAtPrice)}</span>` : ''}</div>
        ${p.colors.length > 1 ? html`<div class="card-swatches" aria-label="${p.colors.length} colores disponibles">${p.colors.slice(0, 5).map((c) => html`<span class="swatch-dot" style="background:${/^#[0-9a-f]{6}$/i.test(c.hex || '') ? c.hex : '#777'}" title="${c.name}"></span>`)}</div>` : ''}
      </div>
    </article>`;
}

export function skeletonCards(n = 8) {
  return html`${Array.from({ length: n }, () => html`<div class="card" aria-hidden="true"><div class="card-media skeleton"></div><div class="skeleton" style="height:12px;width:40%"></div><div class="skeleton" style="height:14px;width:75%"></div></div>`)}`;
}

export function lineThumb(l) {
  return l.image ? html`<img src="${l.image.url}" alt="${l.image.alt}" loading="lazy" width="96" height="120">` : html`<div class="skeleton" style="aspect-ratio:4/5"></div>`;
}

export function errorBox(message) {
  return html`<div class="alert alert-error" role="alert">${icon('circle-alert')}<span>${message}</span></div>`;
}

export function passwordField({ name, label, autocomplete = 'new-password', hint = '' }) {
  return html`
    <div class="field">
      <label for="f-${name}">${label} <span class="req" aria-hidden="true">*</span></label>
      <div class="pw-wrap">
        <input class="input" id="f-${name}" name="${name}" type="password" autocomplete="${autocomplete}" required maxlength="128">
        <button type="button" class="icon-btn" data-toggle-pw aria-label="Mostrar contraseña">${icon('eye')}</button>
      </div>
      ${hint}
      <p class="field-error" id="e-${name}"></p>
    </div>`;
}

export function bindPasswordToggles(root) {
  root.querySelectorAll('[data-toggle-pw]').forEach((b) => b.addEventListener('click', () => {
    const input = b.previousElementSibling;
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    b.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
    b.innerHTML = String(icon(show ? 'eye-off' : 'eye'));
  }));
}

export function field({ name, label, type = 'text', required = true, autocomplete = '', value = '', placeholder = '', maxlength = 200, hint = '', inputmode = '' }) {
  return html`
    <div class="field">
      <label for="f-${name}">${label}${required ? html` <span class="req" aria-hidden="true">*</span>` : html` <span class="muted">(opcional)</span>`}</label>
      <input class="input" id="f-${name}" name="${name}" type="${type}" ${required ? html`required` : ''} autocomplete="${autocomplete || 'off'}" value="${value}" placeholder="${placeholder}" maxlength="${maxlength}" ${inputmode ? html`inputmode="${inputmode}"` : ''} aria-describedby="e-${name}${hint ? ` h-${name}` : ''}">
      ${hint ? html`<p class="field-hint" id="h-${name}">${hint}</p>` : ''}
      <p class="field-error" id="e-${name}"></p>
    </div>`;
}
