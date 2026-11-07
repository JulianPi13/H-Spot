// Ayudas del panel: paginación, confirmaciones, estados y formularios.
import { html, $, icon } from '/js/core/dom.js';
import { modal, closeAll } from '/js/core/layout.js';

export const STATUS = {
  PENDIENTE_CONFIRMACION: 'Pendiente de confirmación', CONFIRMADO: 'Confirmado', EN_PREPARACION: 'En preparación',
  ENVIADO: 'Enviado', ENTREGADO: 'Entregado', CANCELADO: 'Cancelado',
};
export const PAY = { PENDIENTE: 'Pendiente', PAGADO: 'Pagado', REEMBOLSADO: 'Reembolsado' };

export const st = (value, label) => html`<span class="st" data-s="${value}">${label ?? value}</span>`;

export function pager(page, pages, total) {
  if (pages <= 1) return html`<div class="pager">${total} registro${total === 1 ? '' : 's'}</div>`;
  return html`<div class="pager">
    <span>${total} registros · página ${page} de ${pages}</span>
    <button class="btn btn-outline btn-sm" data-page="${page - 1}" ${page <= 1 ? html`disabled` : ''} aria-label="Página anterior">${icon('chevron-left', 'icon-sm')}</button>
    <button class="btn btn-outline btn-sm" data-page="${page + 1}" ${page >= pages ? html`disabled` : ''} aria-label="Página siguiente">${icon('chevron-right', 'icon-sm')}</button>
  </div>`;
}

// Confirmación en una ventana del propio panel (no usamos alert/confirm del navegador)
export function confirmAction({ title, text, confirmLabel = 'Confirmar', danger = false }) {
  return new Promise((resolve) => {
    const m = modal({
      title,
      body: html`<p>${text}</p><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:20px"><button class="btn btn-outline btn-sm" data-no>Cancelar</button><button class="btn btn-sm ${danger ? 'btn-danger' : ''}" data-yes>${confirmLabel}</button></div>`,
      id: 'confirm-modal',
    });
    let done = false;
    const finish = (v) => { if (done) return; done = true; closeAll(); resolve(v); };
    $('[data-yes]', m).addEventListener('click', () => finish(true));
    $('[data-no]', m).addEventListener('click', () => finish(false));
    $('[data-close]', m).addEventListener('click', () => finish(false));
  });
}

export const bool = (v, yes = 'Sí', no = 'No') => st(String(Boolean(v)), v ? yes : no);

export function qs(params) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== '' && v !== undefined && v !== null) p.set(k, v);
  return p.toString();
}
