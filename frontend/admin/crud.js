// Tabla + formulario genérico para tablas pequeñas (categorías, colecciones, envíos, promociones).
import { html, raw, setHTML, icon, $, showFieldErrors, clearFieldError } from '/js/core/dom.js';
import { api } from '/js/core/api.js';
import { toast, modal, closeAll } from '/js/core/layout.js';
import { confirmAction } from './ui.js';

const toInputDate = (v) => (v ? new Date(v).toISOString().slice(0, 10) : '');

function input(f, item) {
  const v = item ? item[f.name] : f.default;
  const id = `c-${f.name}`;
  if (f.type === 'checkbox') return html`<div class="field"><label class="check"><input type="checkbox" name="${f.name}" ${(item ? v : f.default ?? true) ? raw('checked') : ''}> ${f.label}</label></div>`;
  if (f.type === 'select') return html`<div class="field"><label for="${id}">${f.label}</label><select class="select" id="${id}" name="${f.name}">${f.options.map(([val, lab]) => html`<option value="${val}" ${String(v) === String(val) ? raw('selected') : ''}>${lab}</option>`)}</select><p class="field-error"></p></div>`;
  if (f.type === 'textarea') return html`<div class="field ${f.full ? 'full' : ''}"><label for="${id}">${f.label}</label><textarea class="textarea" id="${id}" name="${f.name}" maxlength="${f.max || 500}">${v ?? ''}</textarea><p class="field-error"></p></div>`;
  if (f.type === 'image') return html`<div class="field full"><label for="${id}">${f.label}</label><div style="display:flex;gap:8px"><input class="input" id="${id}" name="${f.name}" value="${v ?? ''}" placeholder="/uploads/... o https://"><label class="btn btn-outline btn-sm" style="min-height:50px">${icon('upload', 'icon-sm')} Subir<input type="file" class="sr-only" accept="image/jpeg,image/png,image/webp,image/avif" data-upload-for="${f.name}"></label></div><p class="field-error"></p></div>`;
  const val = f.type === 'date' ? toInputDate(v) : (v ?? '');
  return html`<div class="field ${f.full ? 'full' : ''}"><label for="${id}">${f.label}${f.required ? html` <span class="req">*</span>` : ''}</label><input class="input" id="${id}" name="${f.name}" type="${f.type || 'text'}" value="${val}" ${f.type === 'number' ? raw('step="any" min="0"') : ''} placeholder="${f.placeholder || ''}"><p class="field-error"></p>${f.hint ? html`<p class="field-hint">${f.hint}</p>` : ''}</div>`;
}

export async function uploadSiteImage(file) {
  const fd = new FormData(); fd.append('image', file);
  const r = await api('/admin/uploads/site-image', { method: 'POST', form: fd });
  return r.url;
}

export async function crudSection(root, cfg) {
  const { items } = await api(cfg.endpoint);
  setHTML(root, html`
    <section class="card-a"><h2>${cfg.title} <button class="btn btn-sm" data-new>${icon('plus', 'icon-sm')} ${cfg.newLabel}</button></h2>
      ${cfg.help ? html`<p class="small muted" style="margin-top:-6px">${cfg.help}</p>` : ''}
      ${items.length ? html`<div class="table-wrap"><table class="tbl"><thead><tr>${cfg.columns.map((c) => html`<th class="${c.num ? 'num' : ''}">${c.label}</th>`)}<th></th></tr></thead>
        <tbody>${items.map((it) => html`<tr>${cfg.columns.map((c) => html`<td class="${c.num ? 'num' : ''}">${c.render ? c.render(it) : it[c.key]}</td>`)}
          <td class="num"><button class="icon-btn" data-edit="${it.id}" aria-label="Editar">${icon('pencil', 'icon-sm')}</button><button class="icon-btn" data-del="${it.id}" aria-label="Eliminar">${icon('trash-2', 'icon-sm')}</button></td></tr>`)}</tbody></table></div>`
        : html`<p class="muted">${cfg.empty}</p>`}
    </section>`);

  const open = (item) => {
    const m = modal({
      title: item ? `Editar ${cfg.singular}` : cfg.newLabel,
      body: html`<form data-crud novalidate><div class="form-grid">${cfg.fields.map((f) => input(f, item))}</div><button class="btn btn-block" type="submit">Guardar</button></form>`,
    });
    const form = $('[data-crud]', m);
    form.addEventListener('input', clearFieldError);
    form.querySelectorAll('[data-upload-for]').forEach((u) => u.addEventListener('change', async () => {
      if (!u.files[0]) return;
      try { form.elements[u.dataset.uploadFor].value = await uploadSiteImage(u.files[0]); toast('Imagen subida.'); } catch (err) { toast(err.message, { error: true }); }
    }));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = {};
      for (const f of cfg.fields) {
        const el = form.elements[f.name];
        body[f.name] = f.type === 'checkbox' ? el.checked : el.value;
      }
      try {
        await api(item ? `${cfg.endpoint}/${item.id}` : cfg.endpoint, { method: item ? 'PUT' : 'POST', body });
        closeAll(); toast('Guardado.'); crudSection(root, cfg);
      } catch (err) { if (!showFieldErrors(form, err.fields)) toast(err.message, { error: true }); }
    });
  };

  $('[data-new]', root).addEventListener('click', () => open(null));
  root.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => open(items.find((i) => i.id === Number(b.dataset.edit)))));
  root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    if (!(await confirmAction({ title: `Eliminar ${cfg.singular}`, text: 'Esta acción no se puede deshacer.', confirmLabel: 'Eliminar', danger: true }))) return;
    try { await api(`${cfg.endpoint}/${b.dataset.del}`, { method: 'DELETE' }); toast('Eliminado.'); crudSection(root, cfg); } catch (err) { toast(err.message, { error: true }); }
  }));
}
