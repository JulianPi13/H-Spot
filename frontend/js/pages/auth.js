// Iniciar sesión, crear cuenta, recuperar y restablecer contraseña, verificar correo.
import { html, $, $$, setHTML, icon, showFieldErrors, clearFieldError, formData, setLoading } from '../core/dom.js';
import { api } from '../core/api.js';
import { initPage } from '../core/layout.js';
import { field, passwordField, bindPasswordToggles } from '../core/components.js';
import { state, setUser, mergeGuestCart } from '../core/store.js';

const params = new URLSearchParams(location.search);
// Solo permitimos redirigir a rutas internas (evita redirecciones abiertas)
const next = (() => { const n = params.get('next') || ''; return /^\/(?!\/)[\w\-/?=&%.]*$/.test(n) ? n : '/cuenta'; })();

const pwRules = html`<div class="pw-rules" data-pw-rules><span data-rule="len">${icon('check', 'icon-sm')} 8+ caracteres</span><span data-rule="letter">${icon('check', 'icon-sm')} Una letra</span><span data-rule="num">${icon('check', 'icon-sm')} Un número</span></div>`;

function watchRules(form, name) {
  const input = form.elements[name];
  input.addEventListener('input', () => {
    const v = input.value;
    const ok = { len: v.length >= 8, letter: /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(v), num: /\d/.test(v) };
    $$('[data-rule]', form).forEach((r) => r.classList.toggle('ok', ok[r.dataset.rule]));
  });
}

const views = {
  '/login': () => html`
    <h1>Iniciar sesión</h1><p>Consulta tus pedidos y compra más rápido.</p>
    <form data-form="login" novalidate>
      <div class="alert alert-error" data-error hidden role="alert"></div>
      ${field({ name: 'email', label: 'Correo electrónico', type: 'email', autocomplete: 'email', maxlength: 191 })}
      ${passwordField({ name: 'password', label: 'Contraseña', autocomplete: 'current-password' })}
      <p style="margin:-6px 0 18px;text-align:right"><a class="link small" href="/recuperar">¿Olvidaste tu contraseña?</a></p>
      <button class="btn btn-block" type="submit">Entrar ${icon('arrow-right')}</button>
    </form>
    <p class="auth-switch">¿No tienes cuenta? <a class="link" href="/registro${next !== '/cuenta' ? `?next=${encodeURIComponent(next)}` : ''}">Crear cuenta</a></p>
    <p class="auth-switch small">También puedes comprar como invitado, sin registrarte.</p>`,

  '/registro': () => html`
    <h1>Crear cuenta</h1><p>Guarda tus datos y sigue el estado de tus pedidos.</p>
    <form data-form="register" novalidate>
      <div class="alert alert-error" data-error hidden role="alert"></div>
      ${field({ name: 'fullName', label: 'Nombre completo', autocomplete: 'name', maxlength: 120 })}
      ${field({ name: 'email', label: 'Correo electrónico', type: 'email', autocomplete: 'email', maxlength: 191 })}
      ${passwordField({ name: 'password', label: 'Contraseña', hint: pwRules })}
      ${passwordField({ name: 'confirmPassword', label: 'Confirmar contraseña' })}
      <div class="field"><label class="check"><input type="checkbox" name="acceptPolicy"> <span>Acepto la <a class="link" href="/politica-de-datos" target="_blank" rel="noopener">política de tratamiento de datos personales</a>. <span class="req">*</span></span></label><p class="field-error"></p></div>
      <button class="btn btn-block" type="submit">Crear cuenta</button>
    </form>
    <p class="auth-switch">¿Ya tienes cuenta? <a class="link" href="/login">Inicia sesión</a></p>`,

  '/recuperar': () => html`
    <h1>Recuperar contraseña</h1><p>Escribe tu correo y te enviaremos un enlace para crear una nueva contraseña.</p>
    <form data-form="forgot" novalidate>
      <div class="alert" data-error hidden role="alert"></div>
      ${field({ name: 'email', label: 'Correo electrónico', type: 'email', autocomplete: 'email', maxlength: 191 })}
      <button class="btn btn-block" type="submit">Enviar enlace</button>
    </form>
    <p class="auth-switch"><a class="link" href="/login">Volver a iniciar sesión</a></p>`,

  '/restablecer': () => html`
    <h1>Nueva contraseña</h1><p>Elige una contraseña segura que no uses en otros sitios.</p>
    ${params.get('token') ? html`
    <form data-form="reset" novalidate>
      <div class="alert alert-error" data-error hidden role="alert"></div>
      ${passwordField({ name: 'password', label: 'Nueva contraseña', hint: pwRules })}
      ${passwordField({ name: 'confirmPassword', label: 'Confirmar contraseña' })}
      <button class="btn btn-block" type="submit">Guardar contraseña</button>
    </form>` : html`<div class="alert alert-error">${icon('circle-alert')}<span>El enlace está incompleto. Solicita uno nuevo.</span></div><p style="margin-top:16px"><a class="btn" href="/recuperar">Solicitar enlace</a></p>`}`,

  '/verificar-correo': () => html`<h1>Verificando correo</h1><div data-verify><div class="spinner"></div></div>`,
};

function showError(form, err) {
  const box = $('[data-error]', form);
  if (err.fields && showFieldErrors(form, err.fields) && Object.keys(err.fields).length) { box.hidden = true; return; }
  box.className = 'alert alert-error';
  setHTML(box, html`${icon('circle-alert')}<span>${err.message}</span>`);
  box.hidden = false;
}

function localValidate(kind, d) {
  const e = {};
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((d.email || '').trim());
  if ('email' in d && !emailOk) e.email = 'Escribe un correo válido.';
  if (kind === 'login' && !d.password) e.password = 'Escribe tu contraseña.';
  if (kind === 'register' && (!d.fullName || d.fullName.trim().length < 3)) e.fullName = 'Escribe tu nombre completo.';
  if (kind === 'register' || kind === 'reset') {
    if (d.password.length < 8 || !/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(d.password) || !/\d/.test(d.password)) e.password = 'Mínimo 8 caracteres, con letras y números.';
    if (d.password !== d.confirmPassword) e.confirmPassword = 'Las contraseñas no coinciden.';
  }
  if (kind === 'register' && !d.acceptPolicy) e.acceptPolicy = 'Debes aceptar la política de tratamiento de datos.';
  return e;
}

async function afterLogin(user, csrfToken) {
  setUser(user, csrfToken);
  const merged = await mergeGuestCart().catch(() => 0);
  if (merged) sessionStorage.setItem('hspot_merged', '1');
  location.href = user.role === 'ADMIN' && next === '/cuenta' ? '/admin' : next;
}

async function main() {
  await initPage();
  const path = location.pathname;
  if (state.user && (path === '/login' || path === '/registro')) { location.replace(next); return; }

  setHTML($('#main'), html`
    <div class="auth-wrap">
      <div class="auth-side"><img src="/assets/img/auth-provisional.svg" alt=""><h2>Your style.<br>Your spot.</h2></div>
      <div class="auth-main"><div class="auth-card">${views[path]()}</div></div>
    </div>`);
  bindPasswordToggles($('#main'));

  const form = $('[data-form]');
  if (form) {
    form.addEventListener('input', clearFieldError);
    if (form.elements.password && form.querySelector('[data-pw-rules]')) watchRules(form, 'password');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const kind = form.dataset.form;
      const d = formData(form);
      const errs = localValidate(kind, d);
      if (Object.keys(errs).length) { showFieldErrors(form, errs); return; }
      const btn = $('button[type=submit]', form);
      setLoading(btn, true);
      try {
        if (kind === 'login') {
          const r = await api('/auth/login', { method: 'POST', body: { email: d.email, password: d.password } });
          await afterLogin(r.user, r.csrfToken);
          return;
        }
        if (kind === 'register') {
          const r = await api('/auth/register', { method: 'POST', body: d });
          if (r.emailVerification === 'ENVIADO') sessionStorage.setItem('hspot_verify_sent', '1');
          await afterLogin(r.user, r.csrfToken);
          return;
        }
        if (kind === 'forgot') {
          const r = await api('/auth/forgot-password', { method: 'POST', body: { email: d.email } });
          setHTML(form, html`<div class="alert alert-success">${icon('circle-check')}<span>${r.message} Revisa también la carpeta de spam. El enlace vence en 30 minutos.</span></div>`);
          return;
        }
        if (kind === 'reset') {
          const r = await api('/auth/reset-password', { method: 'POST', body: { token: params.get('token'), password: d.password, confirmPassword: d.confirmPassword } });
          setHTML(form, html`<div class="alert alert-success">${icon('circle-check')}<span>${r.message}</span></div><p style="margin-top:16px"><a class="btn btn-block" href="/login">Iniciar sesión</a></p>`);
          return;
        }
      } catch (err) {
        showError(form, err);
        if (err.code === 'MAIL_NOT_CONFIGURED') {
          const wa = state.settings.whatsapp.number;
          $('[data-error]', form).insertAdjacentHTML('afterend', String(html`<p style="margin:12px 0"><a class="btn btn-outline btn-block" href="https://wa.me/${wa}" target="_blank" rel="noopener noreferrer">${icon('message-circle')} Escribir por WhatsApp</a></p>`));
        }
      }
      setLoading(btn, false);
    });
  }

  if (path === '/verificar-correo') {
    const box = $('[data-verify]');
    try {
      const r = await api('/auth/verify-email', { method: 'POST', body: { token: params.get('token') || '' } });
      setHTML(box, html`<div class="alert alert-success">${icon('circle-check')}<span>${r.message}</span></div><p style="margin-top:16px"><a class="btn" href="/cuenta">Ir a mi cuenta</a></p>`);
    } catch (err) {
      setHTML(box, html`<div class="alert alert-error">${icon('circle-alert')}<span>${err.message}</span></div>`);
    }
  }
}
main();
