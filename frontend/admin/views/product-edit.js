// Crear / editar producto: datos, precios, etiquetas, colecciones, variantes con stock e imágenes.
import { html, raw, setHTML, icon, fmtDate, $, showFieldErrors, clearFieldError, setLoading } from '/js/core/dom.js';
import { api } from '/js/core/api.js';
import { toast, modal, closeAll } from '/js/core/layout.js';
import { confirmAction } from '../ui.js';

const val = (v) => (v === null || v === undefined ? '' : v);

function productForm(p, cats, cols) {
  const sel = new Set((p?.collections || []).map((c) => c.id));
  const chk = (name, label, checked) => html`<label class="check"><input type="checkbox" name="${name}" ${checked ? raw('checked') : ''}> ${label}</label>`;
  return html`
    <form data-product novalidate>
      <section class="card-a"><h2>Información</h2>
        <div class="form-grid">
          <div class="field full"><label for="f-name">Nombre <span class="req">*</span></label><input class="input" id="f-name" name="name" required maxlength="120" value="${val(p?.name)}"><p class="field-error"></p></div>
          <div class="field"><label for="f-categoryId">Categoría <span class="req">*</span></label><select class="select" id="f-categoryId" name="categoryId" required><option value="">Elige...</option>${cats.map((c) => html`<option value="${c.id}" ${p?.categoryId === c.id ? raw('selected') : ''}>${c.name}${c.active ? '' : ' (inactiva)'}</option>`)}</select><p class="field-error"></p></div>
          <div class="field"><label for="f-gender">Género <span class="req">*</span></label><select class="select" id="f-gender" name="gender">${['UNISEX', 'HOMBRE', 'MUJER'].map((g) => html`<option ${p?.gender === g ? raw('selected') : ''}>${g}</option>`)}</select><p class="field-error"></p></div>
          <div class="field full"><label for="f-description">Descripción <span class="req">*</span></label><textarea class="textarea" id="f-description" name="description" maxlength="5000" rows="4">${val(p?.description)}</textarea><p class="field-error"></p></div>
          <div class="field"><label for="f-materials">Materiales</label><textarea class="textarea" id="f-materials" name="materials" maxlength="2000">${val(p?.materials)}</textarea><p class="field-error"></p></div>
          <div class="field"><label for="f-care">Recomendaciones de cuidado</label><textarea class="textarea" id="f-care" name="care" maxlength="2000">${val(p?.care)}</textarea><p class="field-error"></p></div>
          <div class="field full"><label for="f-slug">Enlace (URL)</label><input class="input" id="f-slug" name="slug" maxlength="140" value="${val(p?.slug)}" placeholder="se genera desde el nombre"><p class="field-hint">${p ? html`Página: <a class="link" href="/producto/${p.slug}" target="_blank">/producto/${p.slug}</a>` : 'Ejemplo: hoodie-oversize-negro'}</p><p class="field-error"></p></div>
        </div>
      </section>
      <section class="card-a"><h2>Precio (COP)</h2>
        <div class="form-grid">
          <div class="field"><label for="f-price">Precio de venta <span class="req">*</span></label><input class="input" id="f-price" name="price" type="number" min="1" step="100" inputmode="numeric" value="${val(p?.price)}"><p class="field-error"></p></div>
          <div class="field"><label for="f-compareAtPrice">Precio anterior (promoción)</label><input class="input" id="f-compareAtPrice" name="compareAtPrice" type="number" min="0" step="100" inputmode="numeric" value="${val(p?.compareAtPrice)}"><p class="field-hint">Déjalo vacío si no hay descuento. Debe ser mayor que el precio de venta.</p><p class="field-error"></p></div>
        </div>
      </section>
      <section class="card-a"><h2>Visibilidad y etiquetas</h2>
        <div class="checks-row">${chk('active', 'Activo (visible en la tienda)', p ? p.active : true)}${chk('featured', 'Destacado', p?.featured)}${chk('isNew', 'Novedad / New drop', p?.isNew)}${chk('isBestSeller', 'Best seller', p?.isBestSeller)}</div>
        <p class="field-label" style="margin-bottom:8px">Colecciones</p>
        <div class="checks-row">${cols.length ? cols.map((c) => html`<label class="check"><input type="checkbox" name="collectionIds" value="${c.id}" ${sel.has(c.id) ? raw('checked') : ''}> ${c.name}</label>`) : html`<span class="muted small">No hay colecciones. Créalas en <a class="link" href="#/catalogo">Categorías y colecciones</a>.</span>`}</div>
        ${p ? html`<p class="small muted">Creado ${fmtDate(p.createdAt, true)} · Modificado ${fmtDate(p.updatedAt, true)}</p>` : ''}
      </section>
      <div class="sticky-actions">
        ${p ? html`<button type="button" class="btn btn-danger btn-sm" data-delete>${icon('trash-2', 'icon-sm')} Eliminar</button>` : ''}
        <a class="btn btn-outline btn-sm" href="#/productos">Volver</a>
        <button class="btn btn-sm" type="submit">${p ? 'Guardar cambios' : 'Crear producto'}</button>
      </div>
    </form>`;
}

function variantsSection(p) {
  return html`
    <section class="card-a" id="variantes"><h2>Variantes e inventario <span class="muted small">${p.variants.reduce((s, v) => s + v.stock, 0)} unidades</span></h2>
      ${p.variants.length ? html`<div class="table-wrap"><table class="tbl">
        <thead><tr><th>Color</th><th>Talla</th><th>SKU</th><th>Activa</th><th class="num">Stock</th><th colspan="2"><span class="sr-only">Acciones</span></th></tr></thead>
        <tbody>${p.variants.map((v) => html`<tr>
          <td><span class="swatch-dot" style="display:inline-block;vertical-align:middle;margin-right:6px;background:${/^#[0-9a-f]{6}$/i.test(v.colorHex || '') ? v.colorHex : '#777'}"></span>${v.color}</td>
          <td>${v.size}</td><td class="mono small" style="white-space:nowrap">${v.sku}</td>
          <td><label class="check"><input type="checkbox" data-v-active="${v.id}" ${v.active ? raw('checked') : ''}><span class="sr-only">Activa</span></label></td>
          <td class="num"><strong ${v.stock === 0 ? raw('style="color:var(--danger)"') : ''}>${v.stock}</strong></td>
          <td><button class="icon-btn" data-adjust="${v.id}" data-stock="${v.stock}" data-label="${v.color} / ${v.size}" aria-label="Ajustar stock de ${v.color} ${v.size}" title="Ajustar stock">${icon('pencil', 'icon-sm')}</button></td>
          <td><button class="icon-btn" data-v-delete="${v.id}" aria-label="Eliminar variante ${v.color} ${v.size}">${icon('trash-2', 'icon-sm')}</button></td></tr>`)}
        </tbody></table></div>` : html`<p class="muted">Este producto aún no tiene variantes. Sin variantes no se puede comprar.</p>`}
      <h3 class="label" style="margin:22px 0 10px">Agregar variantes</h3>
      <form class="inline-form" data-add-variant novalidate>
        <div class="field"><label for="v-color">Color</label><input class="input" id="v-color" name="color" maxlength="40" placeholder="Negro" list="color-list" required></div>
        <div class="field"><label for="v-hex">Muestra</label><input class="input" id="v-hex" name="colorHex" type="color" value="#151515" style="width:56px;padding:4px"></div>
        <div class="field"><label for="v-sizes">Tallas (separadas por coma)</label><input class="input" id="v-sizes" name="sizes" placeholder="S, M, L, XL" required></div>
        <div class="field"><label for="v-stock">Stock por talla</label><input class="input stock-input" id="v-stock" name="stock" type="number" min="0" value="0"></div>
        <button class="btn btn-sm" type="submit">${icon('plus', 'icon-sm')} Agregar</button>
        <datalist id="color-list">${[...new Set(p.variants.map((v) => v.color))].map((c) => html`<option value="${c}">`)}</datalist>
      </form>
    </section>`;
}

function imagesSection(p) {
  const colors = [...new Set(p.variants.map((v) => v.color))];
  return html`
    <section class="card-a" id="imagenes"><h2>Fotografías <span class="muted small">JPG, PNG, WebP o AVIF · se convierten a WebP</span></h2>
      ${p.images.some((i) => i.isDemo) ? html`<div class="alert alert-warning" style="margin-bottom:14px">${icon('info')}<span>Las imágenes marcadas como "Provisional" son de demostración. Reemplázalas por fotografías reales de la prenda.</span></div>` : ''}
      <div class="img-grid" data-images>
        ${p.images.map((im, i) => html`<div class="img-item">
          <img src="${im.url}" alt="${im.alt}" loading="lazy">
          ${im.isDemo ? html`<span class="badge badge-demo" style="margin:6px">Provisional</span>` : ''}
          <select data-img-color="${im.id}" aria-label="Color de la foto"><option value="">Todos los colores</option>${colors.map((c) => html`<option ${im.color === c ? raw('selected') : ''}>${c}</option>`)}</select>
          <div class="acts">
            <button class="icon-btn" data-img-move="${im.id}" data-dir="-1" aria-label="Mover antes" ${i === 0 ? raw('disabled') : ''}>${icon('chevron-left', 'icon-sm')}</button>
            <button class="icon-btn" data-img-replace="${im.id}" aria-label="Reemplazar foto" title="Reemplazar">${icon('replace', 'icon-sm')}</button>
            <button class="icon-btn" data-img-delete="${im.id}" aria-label="Eliminar foto" title="Eliminar">${icon('trash-2', 'icon-sm')}</button>
            <button class="icon-btn" data-img-move="${im.id}" data-dir="1" aria-label="Mover después" ${i === p.images.length - 1 ? raw('disabled') : ''}>${icon('chevron-right', 'icon-sm')}</button>
          </div>
        </div>`)}
      </div>
      <label class="dropzone" style="margin-top:14px" data-drop>
        ${icon('upload', 'icon-lg')}<span>Arrastra fotos aquí o <u>haz clic para elegir</u> (máx. 10 por vez, 4 MB cada una)</span>
        <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple class="sr-only" data-upload>
      </label>
      <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" class="sr-only" data-replace-input aria-hidden="true" tabindex="-1">
      <p class="field-hint" style="margin-top:8px">La primera foto es la principal. Asigna un color a cada foto para que la tienda muestre la correcta al elegir color.</p>
    </section>`;
}

export async function render(root, { params, setTitle }) {
  const isNew = params[0] === 'nuevo';
  const [cats, cols, prod] = await Promise.all([
    api('/admin/categories'), api('/admin/collections'),
    isNew ? Promise.resolve(null) : api(`/admin/products/${params[0]}`),
  ]);
  const p = prod?.product || null;
  setTitle(isNew ? 'Nuevo producto' : p.name);

  setHTML(root, html`
    <p style="margin-bottom:16px"><a class="text-btn" href="#/productos">${icon('chevron-left', 'icon-sm')} Productos</a>${p ? html` <a class="text-btn" style="margin-left:16px" href="/producto/${p.slug}" target="_blank" rel="noopener">${icon('external-link', 'icon-sm')} Ver en la tienda</a>` : ''}</p>
    <div class="grid-2 grid-edit">
      <div>${productForm(p, cats.items, cols.items)}</div>
      <div>${p ? html`${variantsSection(p)}${imagesSection(p)}` : html`<section class="card-a"><h2>Siguiente paso</h2><p class="muted">Guarda el producto para agregar tallas, colores, inventario y fotografías.</p></section>`}</div>
    </div>`);

  const reload = () => render(root, { params, setTitle });
  const form = $('[data-product]', root);
  form.addEventListener('input', clearFieldError);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const body = {
      name: fd.get('name'), slug: fd.get('slug'), description: fd.get('description'), materials: fd.get('materials'), care: fd.get('care'),
      price: fd.get('price'), compareAtPrice: fd.get('compareAtPrice'), gender: fd.get('gender'), categoryId: fd.get('categoryId'),
      collectionIds: fd.getAll('collectionIds').map(Number),
      active: form.active.checked, featured: form.featured.checked, isNew: form.isNew.checked, isBestSeller: form.isBestSeller.checked,
    };
    const btn = $('button[type=submit]', form);
    setLoading(btn, true);
    try {
      const r = await api(isNew ? '/admin/products' : `/admin/products/${p.id}`, { method: isNew ? 'POST' : 'PUT', body });
      toast(isNew ? 'Producto creado. Ahora agrega variantes y fotos.' : 'Cambios guardados. La tienda ya muestra la información actualizada.');
      if (isNew) location.hash = `#/productos/${r.product.id}`; else reload();
    } catch (err) {
      if (!showFieldErrors(form, err.fields)) toast(err.message, { error: true });
    } finally { setLoading(btn, false); }
  });

  const del = $('[data-delete]', root);
  if (del) del.addEventListener('click', async () => {
    if (!(await confirmAction({ title: 'Eliminar producto', text: `¿Eliminar "${p.name}"? Si tiene pedidos, se desactivará en lugar de borrarse para conservar el historial.`, confirmLabel: 'Eliminar', danger: true }))) return;
    try { const r = await api(`/admin/products/${p.id}`, { method: 'DELETE' }); toast(r.message); location.hash = '#/productos'; } catch (err) { toast(err.message, { error: true }); }
  });

  if (!p) return;

  // ----- Variantes -----
  $('[data-add-variant]', root).addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const sizes = f.sizes.value.split(',').map((s) => s.trim()).filter(Boolean);
    if (!f.color.value.trim() || !sizes.length) { toast('Escribe el color y al menos una talla.', { error: true }); return; }
    let ok = 0;
    for (const size of sizes) {
      try { await api(`/admin/products/${p.id}/variants`, { method: 'POST', body: { color: f.color.value.trim(), colorHex: f.colorHex.value, size, stock: Number(f.stock.value) || 0 } }); ok++; }
      catch (err) { toast(`${size}: ${err.message}`, { error: true }); }
    }
    if (ok) { toast(`${ok} variante(s) agregadas.`); reload(); }
  });

  root.addEventListener('change', async (e) => {
    const a = e.target.closest('[data-v-active]');
    if (a) { try { await api(`/admin/variants/${a.dataset.vActive}`, { method: 'PATCH', body: { active: a.checked } }); toast('Variante actualizada.'); } catch (err) { toast(err.message, { error: true }); a.checked = !a.checked; } }
    const c = e.target.closest('[data-img-color]');
    if (c) { try { await api(`/admin/images/${c.dataset.imgColor}`, { method: 'PATCH', body: { color: c.value } }); toast('Color de la foto guardado.'); } catch (err) { toast(err.message, { error: true }); } }
  });

  root.addEventListener('click', async (e) => {
    const adj = e.target.closest('[data-adjust]');
    if (adj) {
      const m = modal({
        title: `Inventario: ${adj.dataset.label}`,
        body: html`<form data-stock-form novalidate>
          <p class="muted small">Stock actual: <strong>${adj.dataset.stock}</strong>. Cada ajuste queda registrado con su motivo.</p>
          <div class="form-row">
            <div class="field"><label for="s-mode">Tipo de ajuste</label><select class="select" id="s-mode" name="mode"><option value="set">Fijar cantidad exacta</option><option value="add">Sumar / restar unidades</option></select></div>
            <div class="field"><label for="s-value">Cantidad</label><input class="input" id="s-value" name="value" type="number" value="${adj.dataset.stock}" required><p class="field-hint">Para restar usa un número negativo (modo sumar/restar).</p></div>
          </div>
          <div class="field"><label for="s-reason">Motivo <span class="req">*</span></label><input class="input" id="s-reason" name="reason" maxlength="200" placeholder="Llegó nueva producción, conteo físico..." required><p class="field-error"></p></div>
          <button class="btn btn-block" type="submit">Guardar inventario</button></form>`,
      });
      $('[data-stock-form]', m).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const f = ev.target;
        try {
          await api(`/admin/variants/${adj.dataset.adjust}/stock`, { method: 'POST', body: { mode: f.mode.value, value: Number(f.value.value), reason: f.reason.value } });
          closeAll(); toast('Inventario actualizado.'); reload();
        } catch (err) { if (!showFieldErrors(f, err.fields)) toast(err.message, { error: true }); }
      });
      return;
    }
    const vd = e.target.closest('[data-v-delete]');
    if (vd) {
      if (!(await confirmAction({ title: 'Eliminar variante', text: 'Si la variante tiene pedidos se desactivará en lugar de borrarse.', confirmLabel: 'Eliminar', danger: true }))) return;
      try { const r = await api(`/admin/variants/${vd.dataset.vDelete}`, { method: 'DELETE' }); toast(r.message); reload(); } catch (err) { toast(err.message, { error: true }); }
      return;
    }
    const idel = e.target.closest('[data-img-delete]');
    if (idel) {
      if (!(await confirmAction({ title: 'Eliminar foto', text: 'La foto se borrará definitivamente.', confirmLabel: 'Eliminar', danger: true }))) return;
      try { await api(`/admin/images/${idel.dataset.imgDelete}`, { method: 'DELETE' }); toast('Foto eliminada.'); reload(); } catch (err) { toast(err.message, { error: true }); }
      return;
    }
    const mv = e.target.closest('[data-img-move]');
    if (mv) {
      const ids = p.images.map((i) => i.id);
      const idx = ids.indexOf(Number(mv.dataset.imgMove));
      const to = idx + Number(mv.dataset.dir);
      [ids[idx], ids[to]] = [ids[to], ids[idx]];
      try { await api(`/admin/products/${p.id}/images/order`, { method: 'PUT', body: { ids } }); reload(); } catch (err) { toast(err.message, { error: true }); }
      return;
    }
    const rep = e.target.closest('[data-img-replace]');
    if (rep) {
      const input = $('[data-replace-input]', root);
      input.onchange = async () => {
        if (!input.files[0]) return;
        const fd = new FormData(); fd.append('image', input.files[0]);
        try { await api(`/admin/images/${rep.dataset.imgReplace}/file`, { method: 'PUT', form: fd }); toast('Foto reemplazada.'); reload(); } catch (err) { toast(err.message, { error: true }); }
        input.value = '';
      };
      input.click();
    }
  });

  // ----- Subida de fotos -----
  const upload = async (files) => {
    const list = [...files].slice(0, 10);
    if (!list.length) return;
    const bad = list.find((f) => !/^image\/(jpeg|png|webp|avif)$/.test(f.type));
    if (bad) { toast(`"${bad.name}" no es una imagen permitida.`, { error: true }); return; }
    const big = list.find((f) => f.size > 4 * 1024 * 1024);
    if (big) { toast(`"${big.name}" pesa más de 4 MB. Redúcela antes de subirla.`, { error: true }); return; }
    const drop = $('[data-drop]', root);
    drop.classList.add('is-over');
    // Se suben de una en una (Vercel limita el tamaño de cada envío)
    let ok = 0;
    for (const file of list) {
      const fd = new FormData();
      fd.append('images', file);
      try { await api(`/admin/products/${p.id}/images`, { method: 'POST', form: fd }); ok++; }
      catch (err) { toast(`${file.name}: ${err.message}`, { error: true }); }
    }
    drop.classList.remove('is-over');
    if (ok) { toast(`${ok} foto(s) subidas.`); reload(); }
  };
  $('[data-upload]', root).addEventListener('change', (e) => upload(e.target.files));
  const drop = $('[data-drop]', root);
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('is-over'); }));
  drop.addEventListener('drop', (e) => upload(e.dataTransfer.files));
}
