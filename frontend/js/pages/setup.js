// Configuración inicial: crear el primer administrador desde el navegador.
// Solo funciona si en Vercel se definió SETUP_TOKEN y todavía no hay administradores.
import { html, $, setHTML, icon, showFieldErrors, clearFieldError, formData, setLoading } from '../core/dom.js';
import { api } from '../core/api.js';
import { initPage } from '../core/layout.js';
import { field, passwordField, bindPasswordToggles } from '../core/components.js';

async function main() {
  await initPage();
  const main = $('#main');
  const st = await api('/setup/status').catch(() => ({ enabled: false }));
  const wrap = (content) => html`<div class="container" style="max-width:520px;padding:56px 0"><p class="eyebrow">Paso único</p><h1 class="h2" style="margin:10px 0 18px">Crear el primer administrador</h1>${content}</div>`;

  if (!st.enabled) {
    setHTML(main, wrap(html`<div class="alert">${icon('lock')}<span>${st.tokenConfigured
      ? 'Ya existe un administrador. Esta página quedó desactivada. Ya puedes borrar la variable SETUP_TOKEN en Vercel.'
      : 'Esta página está desactivada. Para usarla, agrega en Vercel la variable SETUP_TOKEN (una clave de al menos 24 caracteres) y vuelve a publicar.'}</span></div>
      <p style="margin-top:18px"><a class="btn" href="/login">Iniciar sesión</a></p>`));
    return;
  }

  setHTML(main, wrap(html`
    <p class="muted">Escribe la clave SETUP_TOKEN que pusiste en Vercel y los datos de tu cuenta de administrador.</p>
    <form data-setup novalidate>
      <div class="alert alert-error" data-error hidden role="alert"></div>
      ${passwordField({ name: 'setupToken', label: 'Clave de configuración (SETUP_TOKEN)', autocomplete: 'off' })}
      ${field({ name: 'fullName', label: 'Tu nombre completo', autocomplete: 'name', maxlength: 120 })}
      ${field({ name: 'email', label: 'Tu correo', type: 'email', autocomplete: 'email', maxlength: 191 })}
      ${passwordField({ name: 'password', label: 'Contraseña', hint: html`<p class="field-hint">Mínimo 8 caracteres, con letras y números.</p>` })}
      ${passwordField({ name: 'confirmPassword', label: 'Repite la contraseña' })}
      <button class="btn btn-block" type="submit">Crear administrador</button>
    </form>`));
  bindPasswordToggles(main);
  const form = $('[data-setup]');
  form.addEventListener('input', clearFieldError);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('button[type=submit]', form);
    setLoading(btn, true);
    try {
      const r = await api('/setup/admin', { method: 'POST', body: formData(form) });
      setHTML(form, html`<div class="alert alert-success">${icon('circle-check')}<span>${r.message} Por seguridad, borra ahora la variable SETUP_TOKEN en Vercel.</span></div><p style="margin-top:16px"><a class="btn btn-block" href="/login?next=/admin">Entrar al panel</a></p>`);
    } catch (err) {
      if (!(err.fields && showFieldErrors(form, err.fields))) {
        const box = $('[data-error]', form);
        setHTML(box, html`${icon('circle-alert')}<span>${err.message}</span>`); box.hidden = false;
      }
      setLoading(btn, false);
    }
  });
}
main();
