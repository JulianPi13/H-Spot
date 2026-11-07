import { html, $, setHTML, icon } from '../core/dom.js';
import { api } from '../core/api.js';
import { initPage } from '../core/layout.js';
import { errorBox } from '../core/components.js';

async function main() {
  await initPage();
  try {
    const { collections } = await api('/products/facets');
    setHTML($('#main'), html`
      <div class="container">
        <div class="page-title"><div><p class="eyebrow">Lanzamientos</p><h1 class="h1">Colecciones</h1></div></div>
        ${collections.length ? html`<div class="collections-grid">${collections.map((c) => html`
          <a class="collection-card" href="/colecciones/${c.slug}">
            <img src="${c.imageUrl || '/assets/img/editorial-provisional.svg'}" alt="" loading="lazy">
            ${c.isDrop ? html`<span class="badge" style="width:fit-content">Drop</span>` : ''}
            <h2 class="h2">${c.name}</h2>
            ${c.description ? html`<p>${c.description}</p>` : ''}
            <span class="text-btn" style="color:var(--white)">Ver colección ${icon('arrow-right', 'icon-sm')}</span>
          </a>`)}</div>` : html`<div class="empty"><h2 class="h3">Pronto</h2><p>Estamos preparando la próxima colección.</p></div>`}
      </div>`);
  } catch (err) { setHTML($('#main'), html`<div class="container" style="padding:40px 0">${errorBox(err.message)}</div>`); }
}
main();
