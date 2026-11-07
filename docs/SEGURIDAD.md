# Seguridad implementada

| Riesgo | Cómo se protege | Dónde |
|---|---|---|
| Contraseñas robadas | Argon2id (no se pueden revertir). | `controllers/auth.controller.js` |
| Robo de sesión | Cookie `HttpOnly`, `SameSite=Lax`, `Secure` en producción; nuevo identificador al iniciar sesión; sesiones guardadas en MySQL y cerradas de verdad al salir. | `middlewares/session.js` |
| Formularios enviados desde otros sitios (CSRF) | Token en cada POST/PUT/PATCH/DELETE. | `middlewares/csrf.js` |
| Fuerza bruta | Límite de intentos de login (10 / 15 min), registro, recuperación y pedidos. | `middlewares/rateLimits.js` |
| Adivinar si un correo existe | Mismo mensaje y mismo tiempo de respuesta en login y recuperación. | `auth.controller.js` |
| Acceso al panel | El servidor verifica el rol ADMIN en cada ruta `/api/admin`. Ocultar botones no es la protección. | `middlewares/auth.js`, `routes/admin.routes.js` |
| Precios manipulados | El navegador solo envía qué y cuánto; precios, descuentos, envío y totales se calculan con MySQL. | `services/pricing.service.js` |
| Vender dos veces la última prenda | Descuento atómico con condición de stock dentro de una transacción. | `services/order.service.js` |
| Pedidos duplicados | Clave única por intento + botón bloqueado mientras se envía. | `Order.idempotencyKey`, `checkout.js` |
| Inyección SQL | Prisma usa consultas parametrizadas. | todo el backend |
| XSS (código malicioso en textos) | Todo texto se escapa al mostrarse (`html` en `dom.js`); política de contenido (CSP) que bloquea scripts externos o en línea; las URL de ajustes solo aceptan `https://` o rutas internas. | `frontend/js/core/dom.js`, `src/app.js` |
| Archivos peligrosos | Solo JPG/PNG/WebP/AVIF; se verifica que sea imagen real con `sharp` y se convierte a WebP; límite de tamaño. | `middlewares/upload.js`, `services/storage.service.js` |
| Datos personales expuestos | Endpoints públicos no devuelven datos de otros clientes; un invitado solo ve su pedido (misma sesión o enlace con token secreto). Consultar datos de clientes queda en la auditoría. | `order.controller.js`, `admin/*.controller.js` |
| Excel ejecutando fórmulas del CSV | Las celdas que empiezan por `= + - @` se neutralizan. | `admin/orders.controller.js` |
| Errores que revelan detalles | En producción solo se muestra un mensaje genérico; no se registran contraseñas ni tokens. | `middlewares/errorHandler.js` |
| Redirecciones engañosas | `?next=` solo acepta rutas internas. | `js/pages/auth.js` |
| Secretos | Solo en `.env` o en las variables de Vercel (excluido de Git). `.env.example` no tiene claves reales. | `.gitignore` |
| Tarjetas | La tienda no pide ni guarda datos de tarjetas. | — |
| Cabeceras HTTP | Helmet: CSP, HSTS (producción), `X-Frame-Options`, `nosniff`, etc. CORS solo para `CORS_ORIGINS`. | `src/app.js` |

| Primer administrador en Vercel | `/configuracion-inicial` solo funciona con `SETUP_TOKEN` (mín. 24 caracteres) y mientras no exista ningún administrador; luego se desactiva sola. | `routes/system.routes.js` |
| Tarea programada | `/api/cron/release-expired` exige la cabecera con `CRON_SECRET`. | `routes/system.routes.js` |

Pendiente de evaluar cuando crezca la tienda: verificación en dos pasos para administradores y un servicio de monitoreo de errores.

## Avisos de `npm audit` conocidos (noviembre 2026)

- **zod 3** (validación): aviso de consumo de memoria con listas enormes. Mitigado: el servidor rechaza cuerpos de más de 200 KB y todas las listas tienen tamaño máximo (por ejemplo, 50 productos por carrito). Migrar a zod 4 cuando haya tiempo (cambia la forma de escribir algunos mensajes de error).
- **prisma 6 / deepmerge-ts**: afecta solo a la herramienta de línea de comandos al leer su configuración, no a la tienda en funcionamiento. Se corrige al pasar a Prisma 7 (cambio mayor; probarlo antes).

No ejecuten `npm audit fix --force` sin probar: instala versiones mayores que rompen el código.
