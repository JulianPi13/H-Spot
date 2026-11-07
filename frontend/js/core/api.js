// Comunicación con el backend (Fetch API). Agrega el token CSRF automáticamente
// y convierte las respuestas de error en excepciones con mensaje claro.
let csrfToken = null;
export const setCsrf = (t) => { csrfToken = t; };

export class ApiError extends Error {
  constructor(status, message, fields, code) {
    super(message); this.status = status; this.fields = fields || {}; this.code = code;
  }
}

export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = { Accept: 'application/json' };
  if (method !== 'GET') headers['X-CSRF-Token'] = csrfToken || '';
  let payload;
  if (form) payload = form; // FormData (subida de imágenes)
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }

  let res;
  try {
    res = await fetch('/api' + path, { method, headers, body: payload, credentials: 'same-origin' });
  } catch {
    throw new ApiError(0, 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.');
  }
  const type = res.headers.get('content-type') || '';
  const data = type.includes('application/json') ? await res.json().catch(() => ({})) : null;
  if (!res.ok) {
    // Si el token CSRF venció, pedimos uno nuevo y reintentamos una sola vez
    if (res.status === 403 && data && /sesión de seguridad/.test(data.error || '') && !api._retry) {
      const boot = await fetch('/api/bootstrap', { credentials: 'same-origin' }).then((r) => r.json());
      setCsrf(boot.csrfToken);
      api._retry = true;
      try { return await api(path, { method, body, form }); } finally { api._retry = false; }
    }
    throw new ApiError(res.status, (data && data.error) || 'Ocurrió un error. Intenta de nuevo.', data && data.fields, data && data.code);
  }
  return data;
}
