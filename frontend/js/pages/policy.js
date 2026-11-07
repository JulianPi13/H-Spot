import { html, $, setHTML } from '../core/dom.js';
import { initPage } from '../core/layout.js';
import { state } from '../core/store.js';

const MAP = {
  '/politica-de-datos': ['privacy', 'Tratamiento de datos personales'],
  '/terminos': ['terms', 'Términos y condiciones'],
  '/envios': ['shipping', 'Envíos'],
  '/cambios-y-devoluciones': ['returns', 'Cambios y devoluciones'],
};

async function main() {
  await initPage();
  const [key, title] = MAP[location.pathname] || MAP['/terminos'];
  const text = state.settings.policies[key];
  document.title = `${title} | ${state.settings.brand.name}`;
  setHTML($('#main'), html`
    <div class="container">
      <div class="page-title"><div><p class="eyebrow">Políticas</p><h1 class="h1">${title}</h1></div></div>
      <nav class="policy-tabs" aria-label="Políticas">${Object.entries(MAP).map(([href, [, t]]) => html`<a class="btn btn-sm ${href === location.pathname ? '' : 'btn-outline'}" href="${href}" ${href === location.pathname ? html`aria-current="page"` : ''}>${t}</a>`)}</nav>
      ${text ? html`<article class="prose">${text}</article>` : html`<p class="muted">Este contenido todavía no ha sido publicado por la tienda.</p>`}
    </div>`);
}
main();
