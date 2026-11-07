# Pruebas obligatorias — resultados

Se verificaron con **pruebas automáticas** (`npm test`, 26 pruebas sobre PostgreSQL real, también a través de un pooler en modo transacción como el de Supabase) y con **pruebas en navegador** (Chromium automatizado, escritorio 1440 px y móvil 390 px).

| # | Prueba | Cómo se verificó | Resultado |
|---|---|---|---|
| 1 | Navegar el catálogo sin iniciar sesión | Navegador + `orders.test.js` "catálogo público" | OK |
| 2 | Buscar y filtrar productos | Navegador (talla M desde el panel de filtros en móvil, búsqueda) + prueba automática | OK |
| 3 | Seleccionar talla y color | Navegador: sin talla muestra "Selecciona una talla."; tallas agotadas deshabilitadas | OK |
| 4 | Añadir y quitar productos del carrito | Navegador (carrito lateral, cantidades, eliminar) | OK |
| 5 | Impedir cantidades superiores al inventario | Selector limitado al stock + servidor rechaza (409) — `orders.test.js` | OK |
| 6 | Registrar una cuenta | Navegador + `auth.test.js` (validaciones, duplicados, no crea admin) | OK |
| 7 | Iniciar y cerrar sesión | `auth.test.js` (cookie HttpOnly/SameSite, cierre real) + navegador | OK |
| 8 | Recuperar contraseña | Sin SMTP: responde que no está habilitado (no simula). Token de un solo uso y vencimiento: `auth.test.js`. Modo desarrollo: enlace impreso en la terminal | OK (falta configurar SMTP real) |
| 9 | Checkout como invitado | Navegador móvil completo + `orders.test.js` | OK |
| 10 | Checkout con cuenta | Navegador (datos prellenados, método de pago) + `auth.test.js` | OK |
| 11 | Crear pedido y verificarlo en la base de datos | `orders.test.js` lee `Order`, `OrderItem`, `InventoryMovement` | OK |
| 12 | Abrir WhatsApp con el resumen | Navegador: se abrió `wa.me/573013223892` con el mensaje; botones "Abrir" y "Copiar" en la página del pedido | OK |
| 13 | Evitar pedidos duplicados | Mismo envío dos veces = mismo pedido, stock descontado una vez | OK |
| 14 | Precio calculado en el servidor | Se envió `price: 1` y el servidor usó $150.000 | OK |
| 15 | Entrar al panel con un administrador | Navegador: login y recorrido de todas las secciones sin errores | OK |
| 16 | Bloquear el panel a un usuario normal | API 401/403 + pantalla "Acceso restringido" | OK |
| 17 | Crear y editar productos | Navegador + `admin.test.js`; el precio nuevo aparece en la tienda al instante | OK |
| 18 | Subir y reemplazar fotografías | Navegador + `admin.test.js` (rechaza .exe y archivos falsos) | OK |
| 19 | Actualizar inventario | Navegador (ajuste con motivo) + `admin.test.js` (movimiento registrado, no permite negativos) | OK |
| 20 | Cambiar el estado de un pedido | Navegador + `admin.test.js` (transiciones inválidas rechazadas, historial) | OK |
| 21 | Verificar estadísticas y reportes | `admin.test.js`: pendiente no cuenta como ingreso; confirmado y pagado sí; CSV exporta | OK |
| 22 | Errores de validación | Mensajes por campo en checkout, registro y panel | OK |
| 23 | Probar en móviles | Capturas a 390 px: sin desbordes horizontales, menú, filtros y carrito lateral | OK |
| 24 | Pedidos e inventario correctos tras reiniciar | Se reinició el servidor: misma cantidad de pedidos y stock, sesión de admin sigue activa | OK |

Pruebas extra incluidas: dos compras simultáneas de la última unidad (solo una gana), liberación automática de reservas vencidas, códigos promocionales con límite de usos, combinación del carrito de invitado al iniciar sesión, CSRF obligatorio.

## Cómo repetirlas

```bash
npm test
```

Prueba manual recomendada antes de lanzar: hacer un pedido real desde un celular, enviarlo por WhatsApp, confirmarlo y marcarlo pagado en el panel.

## Pruebas de la versión para Vercel

- Se ejecutó el mismo proceso de publicación de Vercel (`npm run vercel-build`) con PostgreSQL detrás de PgBouncer en modo transacción y una sola conexión (igual que Supabase en Vercel): tablas creadas y productos de demostración cargados. Esta prueba encontró y permitió corregir una consulta que se bloqueaba con una sola conexión.
- Se simuló el enrutamiento de Vercel (archivos de `public/` primero, el resto a `api/index.js`, HTTPS por proxy): compra como invitado completa, filtros, carrito, creación del primer administrador desde `/configuracion-inicial`, panel y subida de fotos de una en una.
- El guardado de fotos en Vercel Blob se probó con una simulación del servicio (subir, rechazar archivos falsos y borrar). La prueba con Blob real se hace al publicar (Paso 4 de la guía).
- Pruebas automáticas nuevas: configuración inicial (clave obligatoria, un solo uso) y tarea programada (exige `CRON_SECRET`).
- Se instaló el proyecto con npm 12 (el que usa Vercel), que bloquea scripts de instalación no autorizados: con `allowScripts` en `package.json`, Prisma y argon2 se instalan correctamente.
