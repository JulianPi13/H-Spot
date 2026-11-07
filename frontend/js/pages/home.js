import { html, $, setHTML, icon } from '../core/dom.js';
import { api } from '../core/api.js';
import { initPage, toast } from '../core/layout.js';
import { productCard, skeletonCards, errorBox } from '../core/components.js';
import { state } from '../core/store.js';

const isProvisional = (url) => /provisional/.test(url || '');

async function main() {
  await initPage();
  const h = state.settings.home;
  const cats = state.boot.categories;
  const main = $('#main');

  setHTML(main, html`
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-media"><img src="${h.heroImage}" alt="" fetchpriority="high" width="1920" height="1080"></div>
      ${isProvisional(h.heroImage) ? html`<span class="badge badge-demo hero-provisional">Imagen provisional</span>` : ''}
      <div class="container hero-content">
        ${h.heroEyebrow ? html`<p class="eyebrow">${h.heroEyebrow}</p>` : ''}
        <h1 id="hero-title" class="display hero-title">${h.heroTitle}</h1>
        ${h.heroSubtitle ? html`<p class="hero-sub">${h.heroSubtitle}</p>` : ''}
        <div class="hero-actions">
          <a class="btn" href="${h.heroCtaUrl || '/tienda'}">${h.heroCta} ${icon('arrow-right')}</a>
          <a class="btn btn-outline" href="/novedades">Ver novedades</a>
        </div>
      </div>
    </section>

    <section class="section container" aria-labelledby="drops-title">
      <div class="section-head"><div><span class="eyebrow">Recién llegado</span><h2 id="drops-title" class="h2">New drops</h2></div><a class="text-btn" href="/novedades">Ver todo ${icon('arrow-right', 'icon-sm')}</a></div>
      <div class="row-scroll" data-drops>${skeletonCards(4)}</div>
    </section>

    ${cats.length ? html`
    <section class="section container" aria-labelledby="cats-title">
      <div class="section-head"><div><span class="eyebrow">Categorías</span><h2 id="cats-title" class="h2">Compra por prenda</h2></div></div>
      <div class="cat-grid">${cats.map((c) => html`<a class="cat-tile" href="/categoria/${c.slug}">${c.imageUrl ? html`<img src="${c.imageUrl}" alt="" loading="lazy">` : ''}<span>${c.name} ${icon('arrow-up-right')}</span></a>`)}</div>
    </section>` : ''}

    <section class="section container" aria-labelledby="featured-title">
      <div class="section-head"><div><span class="eyebrow">Selección H-SPOT</span><h2 id="featured-title" class="h2">Destacados</h2></div><a class="text-btn" href="/tienda?destacado=1">Ver todo ${icon('arrow-right', 'icon-sm')}</a></div>
      <div class="grid-products" data-featured>${skeletonCards(8)}</div>
    </section>

    <div class="marquee" aria-hidden="true"><div class="marquee-inner">${Array.from({ length: 2 }, () => html`<span>Your style</span><span>Your spot</span><span>Streetwear</span><span>Hecho en Colombia</span><span>Oversize</span><span>Drops limitados</span>`)}</div></div>

    ${h.editorialTitle ? html`
    <section class="section container" aria-labelledby="ed-title">
      <div class="editorial">
        <div class="editorial-media">${h.editorialImage ? html`<img src="${h.editorialImage}" alt="" loading="lazy">` : ''}</div>
        <div class="editorial-copy"><span class="eyebrow">La marca</span><h2 id="ed-title" class="h1">${h.editorialTitle}</h2><p>${h.editorialText}</p><div><a class="btn btn-outline" href="/colecciones">Ver colecciones ${icon('arrow-right')}</a></div></div>
      </div>
    </section>` : ''}

    <section class="section container" aria-labelledby="best-title">
      <div class="section-head"><div><span class="eyebrow">Lo que más se lleva</span><h2 id="best-title" class="h2">Más vendidos</h2></div><a class="text-btn" href="/tienda?orden=populares">Ver todo ${icon('arrow-right', 'icon-sm')}</a></div>
      <div class="grid-products" data-best>${skeletonCards(4)}</div>
    </section>

    ${h.promoBanner.enabled && h.promoBanner.title ? html`
    <section class="section container">
      <div class="promo">
        ${h.promoBanner.image ? html`<img src="${h.promoBanner.image}" alt="" loading="lazy">` : ''}
        <div class="promo-copy"><span class="eyebrow">Promoción</span><h2 class="h1">${h.promoBanner.title}</h2>${h.promoBanner.text ? html`<p>${h.promoBanner.text}</p>` : ''}${h.promoBanner.ctaLabel ? html`<div><a class="btn" href="${h.promoBanner.ctaUrl || '/ofertas'}">${h.promoBanner.ctaLabel} ${icon('arrow-right')}</a></div>` : ''}</div>
      </div>
    </section>` : ''}

    ${h.newsletterEnabled ? html`
    <section class="section container" aria-labelledby="nl-title">
      <div class="newsletter">
        <div><span class="eyebrow">Newsletter</span><h2 id="nl-title" class="h2" style="margin-top:10px">Entérate primero del próximo drop</h2></div>
        <form novalidate data-newsletter>
          <div class="field" style="margin:0">
            <label class="sr-only" for="nl-email">Correo electrónico</label>
            <div class="inline"><input class="input" id="nl-email" name="email" type="email" placeholder="tu@correo.com" autocomplete="email" required maxlength="191"><button class="btn" type="submit">Suscribirme</button></div>
            <p class="field-error"></p>
          </div>
          <label class="check small"><input type="checkbox" name="consent" required> <span>Acepto recibir novedades de ${state.settings.brand.name} y la <a class="link" href="/politica-de-datos" target="_blank">política de tratamiento de datos</a>.</span></label>
        </form>
      </div>
    </section>` : ''}
  `);

  try {
    const data = await api('/home');
    const fill = (sel, list, emptyMsg) => setHTML($(sel), list.length ? list.map((p, i) => productCard(p, { eager: i < 2 })) : html`<p class="muted">${emptyMsg}</p>`);
    fill('[data-drops]', data.newDrops, 'Pronto anunciaremos el próximo lanzamiento.');
    // Mostramos filas completas de 4 para que la cuadrícula no quede coja
    const featured = data.featured.length > 4 ? data.featured.slice(0, Math.floor(data.featured.length / 4) * 4) : data.featured;
    fill('[data-featured]', featured, 'Aún no hay productos destacados.');
    fill('[data-best]', data.bestSellers, 'Aún no hay productos.');
  } catch (err) {
    ['[data-drops]', '[data-featured]', '[data-best]'].forEach((s) => setHTML($(s), errorBox(err.message)));
  }

  const nl = $('[data-newsletter]');
  if (nl) nl.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('.field-error', nl);
    err.textContent = '';
    const email = nl.email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = 'Escribe un correo válido.'; nl.email.focus(); return; }
    if (!nl.consent.checked) { err.textContent = 'Debes aceptar recibir comunicaciones.'; return; }
    const btn = $('button[type=submit]', nl);
    btn.disabled = true;
    try {
      const r = await api('/newsletter', { method: 'POST', body: { email, consent: true } });
      toast(r.message); nl.reset();
    } catch (ex) { err.textContent = ex.fields?.email || ex.message; } finally { btn.disabled = false; }
  });
}
main();
