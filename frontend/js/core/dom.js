// Utilidades de interfaz: plantillas HTML seguras, iconos, formato de precios.
// IMPORTANTE (seguridad XSS): html`...` escapa automáticamente todo lo que se
// interpola. Solo el contenido creado con html`` o raw() se inserta sin escapar.

class SafeHTML {
  constructor(value) { this.value = value; }
  toString() { return this.value; }
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const raw = (s) => new SafeHTML(String(s));

function render(v) {
  if (v === null || v === undefined || v === false) return '';
  if (Array.isArray(v)) return v.map(render).join('');
  if (v instanceof SafeHTML) return v.value;
  return esc(v);
}

export function html(strings, ...values) {
  let out = '';
  strings.forEach((s, i) => { out += s + (i < values.length ? render(values[i]) : ''); });
  return new SafeHTML(out);
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function setHTML(el, content) { if (el) el.innerHTML = render(content); }

export const icon = (name, cls = 'icon') =>
  raw(`<svg class="${cls}" aria-hidden="true" focusable="false"><use href="/assets/icons/sprite.svg#i-${name}"></use></svg>`);

const copFormat = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
export const cop = (n) => (n === null || n === undefined ? '—' : '$' + copFormat.format(n));

export const fmtDate = (d, withTime = false) => new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota', day: '2-digit', month: 'short', year: 'numeric',
  ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
}).format(new Date(d));

export function debounce(fn, ms = 250) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

export function uid() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

// Muestra errores del servidor junto a cada campo del formulario
export function showFieldErrors(form, fields = {}) {
  $$('.field', form).forEach((f) => { f.classList.remove('has-error'); const e = $('.field-error', f); if (e) e.textContent = ''; });
  let first = null;
  for (const [name, msg] of Object.entries(fields)) {
    const input = form.elements[name];
    const field = input && (input.closest ? input.closest('.field') : input[0]?.closest('.field'));
    if (!field) continue;
    field.classList.add('has-error');
    const box = $('.field-error', field);
    if (box) box.textContent = msg;
    const el = input.focus ? input : input[0];
    if (el) el.setAttribute('aria-invalid', 'true');
    if (!first) first = el;
  }
  if (first && first.focus) first.focus();
  return Boolean(first);
}

export function clearFieldError(e) {
  const field = e.target.closest('.field');
  if (field && field.classList.contains('has-error')) {
    field.classList.remove('has-error');
    const box = $('.field-error', field); if (box) box.textContent = '';
    e.target.removeAttribute('aria-invalid');
  }
}

export function formData(form) {
  const data = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    if (el.type === 'checkbox') data[el.name] = el.checked;
    else if (el.type === 'radio') { if (el.checked) data[el.name] = el.value; }
    else data[el.name] = el.value;
  }
  return data;
}

export function setLoading(btn, loading) {
  if (!btn) return;
  btn.classList.toggle('is-loading', loading);
  btn.disabled = loading;
  btn.setAttribute('aria-busy', String(loading));
}
