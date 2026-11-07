// Configuración de la tienda: marca, anuncios, portada, WhatsApp/redes, checkout y políticas.
import { html, raw, setHTML, icon, $, showFieldErrors, clearFieldError, setLoading } from '/js/core/dom.js';
import { api } from '/js/core/api.js';
import { toast } from '/js/core/layout.js';
import { uploadSiteImage } from '../crud.js';

const TABS = [['brand', 'Marca'], ['announcement', 'Anuncios'], ['home', 'Portada'], ['contact', 'WhatsApp y redes'], ['checkout', 'Checkout y pagos'], ['policies', 'Políticas']];

const text = (name, label, value, { hint = '', max = 200, full = false, placeholder = '' } = {}) => html`
  <div class="field ${full ? 'full' : ''}"><label for="s-${name}">${label}</label><input class="input" id="s-${name}" name="${name}" value="${value ?? ''}" maxlength="${max}" placeholder="${placeholder}"><p class="field-error"></p>${hint ? html`<p class="field-hint">${hint}</p>` : ''}</div>`;
const area = (name, label, value, { rows = 4, max = 1000 } = {}) => html`
  <div class="field full"><label for="s-${name}">${label}</label><textarea class="textarea" id="s-${name}" name="${name}" rows="${rows}" maxlength="${max}">${value ?? ''}</textarea><p class="field-error"></p></div>`;
const img = (name, label, value) => html`
  <div class="field full"><label for="s-${name}">${label}</label>
    <div style="display:flex;gap:8px;align-items:center">${value ? html`<img src="${value}" alt="" style="width:64px;height:48px;object-fit:cover;border:1px solid var(--line)">` : ''}
    <input class="input" id="s-${name}" name="${name}" value="${value ?? ''}" placeholder="/uploads/site/... o https://">
    <label class="btn btn-outline btn-sm" style="min-height:50px">${icon('upload', 'icon-sm')} Subir<input type="file" class="sr-only" accept="image/jpeg,image/png,image/webp,image/avif" data-upload-for="${name}"></label></div>
    ${/provisional/.test(value || '') ? html`<p class="field-hint" style="color:var(--warning)">Imagen provisional: reemplázala por una fotografía real.</p>` : ''}<p class="field-error"></p></div>`;
const check = (name, label, value) => html`<div class="field"><label class="check"><input type="checkbox" name="${name}" ${value ? raw('checked') : ''}> ${label}</label></div>`;

function forms(s) {
  return {
    brand: html`<div class="form-grid">
      ${text('name', 'Nombre de la tienda', s.brand.name, { max: 40 })}${text('tagline', 'Lema', s.brand.tagline, { max: 120 })}
      ${img('logoUrl', 'Logotipo (opcional; si está vacío se usa el nombre en texto)', s.brand.logoUrl)}
      ${text('contactEmail', 'Correo de contacto', s.brand.contactEmail, { max: 191 })}${text('contactPhone', 'Teléfono visible', s.brand.contactPhone, { max: 30 })}
      ${text('city', 'Ciudad / dirección visible', s.brand.city, { max: 80 })}
      ${area('aboutText', 'Texto "sobre la marca"', s.brand.aboutText)}</div>`,
    announcement: html`
      ${check('enabled', 'Mostrar barra de anuncios', s.announcement.enabled)}
      ${[0, 1, 2, 3, 4].map((i) => text(`m${i}`, `Mensaje ${i + 1}`, s.announcement.messages[i], { max: 80, placeholder: i === 0 ? 'NUEVA COLECCIÓN DISPONIBLE' : '' }))}
      <p class="field-hint">Los mensajes rotan cada pocos segundos. Deja vacíos los que no uses.</p>`,
    home: html`<div class="form-grid">
      <h3 class="label full" style="margin-bottom:12px">Hero</h3>
      ${text('heroEyebrow', 'Antetítulo', s.home.heroEyebrow, { max: 60 })}${text('heroTitle', 'Titular', s.home.heroTitle, { max: 80 })}
      ${area('heroSubtitle', 'Subtítulo', s.home.heroSubtitle, { rows: 2, max: 240 })}
      ${text('heroCta', 'Texto del botón', s.home.heroCta, { max: 40 })}${text('heroCtaUrl', 'Enlace del botón', s.home.heroCtaUrl, { max: 300 })}
      ${img('heroImage', 'Imagen principal (recomendado 1920 x 1080)', s.home.heroImage)}
      <h3 class="label full" style="margin:12px 0">Sección editorial</h3>
      ${text('editorialTitle', 'Título', s.home.editorialTitle, { max: 80, full: true })}${area('editorialText', 'Texto', s.home.editorialText, { max: 800 })}
      ${img('editorialImage', 'Imagen editorial', s.home.editorialImage)}
      <h3 class="label full" style="margin:12px 0">Banner promocional</h3>
      <div class="full">${check('promoEnabled', 'Mostrar banner promocional', s.home.promoBanner.enabled)}</div>
      ${text('promoTitle', 'Título', s.home.promoBanner.title, { max: 80 })}${text('promoText', 'Texto', s.home.promoBanner.text, { max: 240 })}
      ${text('promoCtaLabel', 'Texto del botón', s.home.promoBanner.ctaLabel, { max: 40 })}${text('promoCtaUrl', 'Enlace del botón', s.home.promoBanner.ctaUrl, { max: 300 })}
      ${img('promoImage', 'Imagen del banner', s.home.promoBanner.image)}
      <div class="full">${check('newsletterEnabled', 'Mostrar formulario de newsletter', s.home.newsletterEnabled)}</div></div>`,
    contact: html`
      ${text('number', 'Número de WhatsApp para pedidos', s.whatsapp.number, { max: 12, hint: 'Formato internacional sin espacios ni +. Ejemplo: 573013223892' })}
      ${text('instagram', 'Perfil de Instagram (URL)', s.social.instagram, { max: 300, placeholder: 'https://www.instagram.com/tu_cuenta' })}
      ${text('tiktok', 'Perfil de TikTok (URL)', s.social.tiktok, { max: 300, placeholder: 'https://www.tiktok.com/@tu_cuenta' })}
      <p class="field-hint">Si dejas una red vacía, no se muestra en la tienda.</p>`,
    checkout: html`
      <div class="form-grid">${text('freeShippingThreshold', 'Envío gratis desde (COP)', s.checkout.freeShippingThreshold, { max: 12, hint: 'Vacío = no hay envío gratis.' })}
      ${text('lowStockThreshold', 'Alerta de stock bajo (unidades)', s.checkout.lowStockThreshold, { max: 4 })}</div>
      <p class="field-label" style="margin:8px 0 10px">Métodos de pago que aceptas</p>
      ${s.checkout.paymentMethods.map((p, i) => html`<div class="inline-form" style="margin-bottom:8px"><label class="check" style="min-width:110px"><input type="checkbox" name="pm-enabled-${i}" ${p.enabled ? raw('checked') : ''}> Activo</label><input type="hidden" name="pm-id-${i}" value="${p.id}"><div class="field" style="flex:1"><input class="input" name="pm-name-${i}" value="${p.name}" maxlength="60" aria-label="Nombre del método ${i + 1}"></div></div>`)}
      <p class="field-hint">Solo se muestran en el checkout los métodos activos. La web no cobra: el pago se coordina por WhatsApp. Moneda: COP.</p>`,
    policies: html`
      <div class="alert alert-warning" style="margin-bottom:16px">${icon('info')}<span>Estos textos son borradores base. Haz que un abogado los revise antes del lanzamiento y completa los datos entre corchetes.</span></div>
      ${area('privacy', 'Política de tratamiento de datos personales', s.policies.privacy, { rows: 14, max: 30000 })}
      ${area('terms', 'Términos y condiciones', s.policies.terms, { rows: 8, max: 30000 })}
      ${area('shipping', 'Política de envíos', s.policies.shipping, { rows: 6, max: 30000 })}
      ${area('returns', 'Cambios y devoluciones', s.policies.returns, { rows: 6, max: 30000 })}`,
  };
}

// Convierte el formulario en lo que espera el servidor, por pestaña
function collect(tab, f, s) {
  const v = (n) => f.elements[n]?.value ?? '';
  const c = (n) => Boolean(f.elements[n]?.checked);
  switch (tab) {
    case 'brand': return [['brand', { name: v('name'), tagline: v('tagline'), logoUrl: v('logoUrl'), contactEmail: v('contactEmail'), contactPhone: v('contactPhone'), city: v('city'), aboutText: v('aboutText') }]];
    case 'announcement': return [['announcement', { enabled: c('enabled'), messages: [0, 1, 2, 3, 4].map((i) => v(`m${i}`).trim()).filter(Boolean) }]];
    case 'home': return [['home', {
      heroEyebrow: v('heroEyebrow'), heroTitle: v('heroTitle'), heroSubtitle: v('heroSubtitle'), heroCta: v('heroCta'), heroCtaUrl: v('heroCtaUrl'), heroImage: v('heroImage'),
      editorialTitle: v('editorialTitle'), editorialText: v('editorialText'), editorialImage: v('editorialImage'),
      promoBanner: { enabled: c('promoEnabled'), title: v('promoTitle'), text: v('promoText'), ctaLabel: v('promoCtaLabel'), ctaUrl: v('promoCtaUrl'), image: v('promoImage') },
      newsletterEnabled: c('newsletterEnabled'),
    }]];
    case 'contact': return [['whatsapp', { number: v('number').replace(/\D/g, '') }], ['social', { instagram: v('instagram'), tiktok: v('tiktok') }]];
    case 'checkout': return [['checkout', {
      freeShippingThreshold: v('freeShippingThreshold').replace(/\D/g, '') || null,
      lowStockThreshold: v('lowStockThreshold') || 0,
      paymentMethods: s.checkout.paymentMethods.map((_, i) => ({ id: v(`pm-id-${i}`), name: v(`pm-name-${i}`), enabled: c(`pm-enabled-${i}`) })),
    }]];
    case 'policies': return [['policies', { privacy: v('privacy'), terms: v('terms'), shipping: v('shipping'), returns: v('returns') }]];
    default: return [];
  }
}

// Traduce nombres de campos del servidor (ej. "promoBanner.title") a los del formulario
const FIELD_MAP = { 'promoBanner.title': 'promoTitle', 'promoBanner.text': 'promoText', 'promoBanner.ctaLabel': 'promoCtaLabel', 'promoBanner.ctaUrl': 'promoCtaUrl', 'promoBanner.image': 'promoImage' };

export async function render(root, { query }) {
  const tab = TABS.some(([k]) => k === query.get('tab')) ? query.get('tab') : 'brand';
  const { settings: s } = await api('/admin/settings');
  setHTML(root, html`
    <div class="tabs" role="tablist">${TABS.map(([k, l]) => html`<a role="tab" href="#/ajustes?tab=${k}" aria-selected="${k === tab}">${l}</a>`)}</div>
    <form class="card-a" data-settings novalidate style="max-width:900px">${forms(s)[tab]}
      <div class="sticky-actions"><a class="btn btn-outline btn-sm" href="/" target="_blank" rel="noopener">${icon('external-link', 'icon-sm')} Ver tienda</a><button class="btn btn-sm" type="submit">Guardar</button></div>
    </form>`);

  const form = $('[data-settings]', root);
  form.addEventListener('input', clearFieldError);
  form.querySelectorAll('[data-upload-for]').forEach((u) => u.addEventListener('change', async () => {
    if (!u.files[0]) return;
    try { form.elements[u.dataset.uploadFor].value = await uploadSiteImage(u.files[0]); toast('Imagen subida. Pulsa Guardar para aplicarla.'); } catch (err) { toast(err.message, { error: true }); }
  }));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('button[type=submit]', form);
    setLoading(btn, true);
    try {
      for (const [key, body] of collect(tab, form, s)) await api(`/admin/settings/${key}`, { method: 'PUT', body });
      toast('Configuración guardada. Los cambios ya se ven en la tienda.');
    } catch (err) {
      const fields = {};
      for (const [k, v] of Object.entries(err.fields || {})) fields[FIELD_MAP[k] || k] = v;
      if (!showFieldErrors(form, fields)) toast(err.message, { error: true });
    } finally { setLoading(btn, false); }
  });
}
