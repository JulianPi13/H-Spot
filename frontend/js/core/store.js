// Estado compartido de la tienda: ajustes, usuario y carrito.
//
// CARRITO:
//  - Invitado: se guarda en el navegador (localStorage) SOLO como lista de
//    { variantId, quantity }. Precios y stock siempre se piden al servidor.
//  - Con sesión: se guarda en el servidor (base de datos).
//  - Al iniciar sesión, el carrito del invitado se combina con el de la cuenta.
import { api, setCsrf } from './api.js';

const CART_KEY = 'hspot_cart_v1';
export const state = { boot: null, user: null, settings: null, cart: null, cartExtra: { shippingMethodId: null, promoCode: null } };

let bootPromise = null;
export function boot() {
  if (!bootPromise) {
    bootPromise = api('/bootstrap').then((data) => {
      state.boot = data;
      state.user = data.user;
      state.settings = data.settings;
      setCsrf(data.csrfToken);
      return data;
    });
  }
  return bootPromise;
}

export function setUser(user, csrfToken) {
  state.user = user;
  if (csrfToken) setCsrf(csrfToken);
  document.dispatchEvent(new CustomEvent('user:change', { detail: user }));
}

// ---------- Carrito local (invitados) ----------
function readLocal() {
  try {
    const items = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    return Array.isArray(items)
      ? items.filter((i) => Number.isInteger(i.variantId) && Number.isInteger(i.quantity) && i.quantity > 0).slice(0, 50)
      : [];
  } catch { return []; }
}
function writeLocal(items) {
  try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch { /* modo privado */ }
}

function emit() {
  document.dispatchEvent(new CustomEvent('cart:change', { detail: state.cart }));
}

// Devuelve el carrito con precios oficiales del servidor
// extra = { shippingMethodId, promoCode }: se recuerdan durante la visita
export async function loadCart(extra) {
  if (extra) Object.assign(state.cartExtra, extra);
  extra = state.cartExtra;
  if (state.user) {
    state.cart = await api('/cart');
    if (extra.shippingMethodId || extra.promoCode) {
      state.cart = await api('/cart/quote', { method: 'POST', body: { items: itemsFromQuote(state.cart), ...extra } });
    }
  } else {
    const items = readLocal();
    state.cart = await api('/cart/quote', { method: 'POST', body: { items, ...extra } });
    // Si el servidor ajustó cantidades (stock), actualizamos el carrito local
    const fixed = state.cart.lines.filter((l) => l.quantity > 0).map((l) => ({ variantId: l.variantId, quantity: l.quantity }));
    if (JSON.stringify(fixed) !== JSON.stringify(items)) writeLocal(fixed);
  }
  emit();
  return state.cart;
}

export const itemsFromQuote = (q) => (q ? q.lines.filter((l) => l.quantity > 0).map((l) => ({ variantId: l.variantId, quantity: l.quantity })) : []);

export function cartCount() {
  if (state.cart) return state.cart.lines.reduce((s, l) => s + l.quantity, 0);
  return readLocal().reduce((s, i) => s + i.quantity, 0);
}

export async function setQuantity(variantId, quantity) {
  if (state.user) {
    await api(`/cart/items/${variantId}`, { method: 'PUT', body: { quantity } });
    return loadCart();
  }
  let items = readLocal();
  const found = items.find((i) => i.variantId === variantId);
  if (quantity <= 0) items = items.filter((i) => i.variantId !== variantId);
  else if (found) found.quantity = quantity;
  else items.push({ variantId, quantity });
  writeLocal(items);
  return loadCart();
}

export async function addToCart(variantId, quantity) {
  const current = state.cart ? (state.cart.lines.find((l) => l.variantId === variantId)?.quantity || 0)
    : (readLocal().find((i) => i.variantId === variantId)?.quantity || 0);
  return setQuantity(variantId, current + quantity);
}

export async function clearCart() {
  if (state.user) { await api('/cart', { method: 'DELETE' }); return loadCart(); }
  writeLocal([]);
  return loadCart();
}

export function clearLocalCart() { writeLocal([]); }

// Al iniciar sesión: combina el carrito del invitado con el de la cuenta
export async function mergeGuestCart() {
  const items = readLocal();
  if (items.length) {
    state.cart = await api('/cart/merge', { method: 'POST', body: { items } });
    writeLocal([]);
    emit();
    return items.length;
  }
  return 0;
}
