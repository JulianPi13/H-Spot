# Fase 1 — Planificación de H-SPOT

## 1. Qué construimos (en simple)

Una tienda en línea de ropa urbana donde el cliente:

1. Mira el catálogo y filtra por talla, color, precio, categoría o colección.
2. Elige talla y color, y agrega al carrito.
3. Llena sus datos de entrega (con o sin cuenta).
4. La tienda **guarda el pedido** y abre **WhatsApp** con el resumen ya escrito.
5. El negocio confirma por WhatsApp disponibilidad, envío y pago, y actualiza el estado en el panel.

El dueño administra todo desde `/admin`: productos, fotos, tallas, stock, pedidos, clientes, textos de la portada, envíos, promociones y políticas.

## 2. Arquitectura

```
Navegador (HTML + CSS + JavaScript)
        │  fetch /api/...  (cookies de sesión + token CSRF)
        ▼
Servidor Node.js + Express  ── valida, calcula precios, controla permisos
        │  Prisma (ORM)
        ▼
MySQL  ── usuarios, productos, variantes, inventario, pedidos, ajustes, auditoría
```

- **Un solo servidor** entrega la tienda y la API. Así las cookies funcionan sin complicaciones y no hay problemas de CORS.
- El navegador **nunca decide** precios, stock ni permisos: todo lo calcula el servidor con datos de MySQL.
- Las sesiones se guardan en MySQL, así que un reinicio del servidor no cierra la sesión de nadie.
- Las fotos se convierten a WebP y se guardan en **Vercel Blob** cuando la tienda corre en Vercel, o en la carpeta `backend/uploads` en un computador o servidor propio. Todo está aislado en `storage.service.js`.
- En Vercel, la tienda completa corre como una función (`api/index.js`) y los archivos estáticos salen de su CDN. No hay procesos de fondo: las reservas vencidas se liberan con una tarea diaria (Vercel Cron) y cada vez que alguien compra o abre los pedidos.

**Única diferencia con la propuesta original:** no se usó React ni otro framework. Se mantuvo HTML, CSS y JavaScript puros, como pedía el documento, organizados en módulos pequeños.

## 3. Modelo de datos (tablas)

| Tabla | Para qué sirve |
|---|---|
| `User` | Clientes y administradores (rol `CUSTOMER` o `ADMIN`). Contraseña cifrada con Argon2id. |
| `Address` | Direcciones guardadas del cliente (preparada para el futuro). |
| `Session` | Sesiones de inicio de sesión. |
| `PasswordResetToken` / `EmailVerificationToken` | Enlaces de un solo uso con vencimiento (se guarda solo su huella SHA-256). |
| `Category` | Camisetas, Hoodies, Pantalones... |
| `Collection` | Colecciones y drops. |
| `ProductCollection` | Une productos y colecciones (muchos a muchos), con llave primaria propia. |
| `Product` | Prenda: nombre, descripción, precio, precio anterior, género, etiquetas. |
| `ProductImage` | Fotos de la prenda (archivo + orden + color asociado). |
| `ProductVariant` | Combinación talla + color con su **stock** y SKU. |
| `Cart` / `CartItem` | Carrito de clientes con cuenta. El de invitados vive en el navegador. |
| `Order` | Pedido con datos de entrega, totales, estado del pedido y estado del pago. |
| `OrderItem` | **Copia congelada** de cada prenda vendida (nombre, talla, color, precio). |
| `OrderStatusHistory` / `OrderNote` | Historial de cambios de estado y notas internas. |
| `InventoryMovement` | Cada entrada/salida de inventario con su motivo. |
| `Promotion` | Códigos de descuento (porcentaje o valor fijo, vigencia, límite de usos). |
| `ShippingMethod` | Tarifas de envío configurables. |
| `StoreSetting` | Textos e imágenes de la portada, anuncios, WhatsApp, redes, políticas, métodos de pago. |
| `AuditLog` | Bitácora de acciones administrativas. |
| `NewsletterSubscriber` | Correos con consentimiento para el boletín. |

Precios con `DECIMAL(12,2)` (sin errores de redondeo). Estados con enumeraciones. Índices en búsquedas frecuentes (estado + fecha de pedidos, precio, categoría, talla, color).

El esquema completo y comentado está en `backend/prisma/schema.prisma`.

## 4. Inventario sin vender dos veces la misma prenda

- Al crear el pedido, el servidor descuenta el stock con una sola orden a MySQL que dice: *"resta solo si quedan suficientes"*. MySQL bloquea esa fila mientras tanto: si dos personas compran la última unidad al mismo tiempo, una lo logra y la otra recibe un aviso. (Probado automáticamente.)
- El pedido queda **Pendiente de confirmación** con una **reserva de 48 horas** (configurable). Si nadie lo confirma, se cancela solo y el stock vuelve.
- Si el administrador cancela, el stock vuelve automáticamente. Todo queda en `InventoryMovement`.

## 5. Estados del pedido

```
Pendiente de confirmación ─► Confirmado ─► En preparación ─► Enviado ─► Entregado
          │                      │               │
          └──────────────────────┴───────────────┴──► Cancelado (devuelve stock)
```

El **estado de pago** va aparte (Pendiente / Pagado / Reembolsado) y solo lo cambia el administrador. Abrir WhatsApp no marca nada como pagado.

## 6. Estructura de carpetas

```
h-spot/
  package.json        Dependencias y comandos (npm run ...)
  vercel.json         Configuración para publicar en Vercel
  api/index.js        Entrada de la tienda en Vercel
  .env.example        Plantilla de configuración (sin claves reales)
  README.md           Cómo instalar y ejecutar
  docs/               Plan, decisiones, pruebas y despliegue
  frontend/
    index.html        Portada
    pages/            Tienda, producto, carrito, checkout, pedido, cuenta, políticas, 404
    css/              base.css, layout.css, pages.css
    js/core/          api.js, dom.js, store.js, layout.js, components.js
    js/pages/         Un archivo por página
    admin/            Panel (index.html, app.js, views/…)
    assets/           Fuentes, iconos SVG, imágenes provisionales
  backend/
    server.js         Arranque
    src/config/       Variables de entorno, conexión Prisma
    src/middlewares/  Sesión, CSRF, permisos, límites, errores, subida de fotos
    src/validators/   Reglas de validación (Zod)
    src/services/     Lógica: precios, pedidos, catálogo, ajustes, correo, archivos
    src/controllers/  Respuestas de cada ruta (y admin/)
    src/routes/       Rutas públicas, de cuenta y de administración
    prisma/           schema.prisma, migraciones, seed (datos demo), políticas base
    scripts/          create-admin, liberar reservas, generar imágenes provisionales
    tests/            Pruebas automáticas
```

## 7. Servicios externos

| Servicio | ¿Obligatorio? | Estado |
|---|---|---|
| MySQL 8 | Sí | Requerido para todo. |
| WhatsApp (enlace wa.me) | Sí | No necesita cuenta ni clave. Número: 573013223892. |
| Servidor de correo SMTP | No | Necesario para recuperar contraseña y verificar correos. **No configurado**: la tienda lo indica claramente y no finge enviar correos. |
| Almacenamiento de fotos externo (Cloudinary/S3) | No | Hoy se usa el disco del servidor. Recomendado si el hosting no tiene disco permanente. |
| Pasarela de pagos (Wompi, ePayco, Mercado Pago) | No | No implementada (por pedido). El modelo ya separa "estado de pago" para conectarla después. |

## 8. Decisiones que deben confirmar antes de producción

Ver `docs/DECISIONES-PENDIENTES.md`.
