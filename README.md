# H-SPOT — Tienda de moda urbana

Tienda en línea completa: catálogo con filtros, carrito, pedidos por WhatsApp, cuentas de cliente y panel de administración.

- **Tienda:** HTML, CSS y JavaScript (sin frameworks).
- **Servidor:** Node.js + Express.
- **Base de datos:** PostgreSQL (Supabase en internet) con Prisma.

> Las fotos, precios y productos que vienen incluidos son **de demostración** y están marcados como tales ("FOTO PROVISIONAL", "DEMO"). Cámbialos desde el panel antes de vender.

## ¿Quieres publicarla sin instalar nada?

Sigue la guía **`docs/PUBLICAR-EN-VERCEL.md`**: todo desde el navegador (GitHub + Supabase + Vercel), sin instalar Node.js ni bases de datos en tu computador.

El resto de este archivo explica cómo correrla **en tu propio computador** (para programar y probar cambios).

---

## 1. Lo que necesitas instalar (una sola vez)

| Programa | Versión | Dónde |
|---|---|---|
| Node.js | 20 o más nuevo (LTS) | https://nodejs.org |
| PostgreSQL | 15 o más nuevo | https://www.postgresql.org/download/ (Windows: instalador de EDB) · `brew install postgresql@16` (Mac) |
| Git | cualquiera | https://git-scm.com |

Para revisar que quedaron bien, abre una terminal y escribe:

```bash
node -v
npm -v
psql --version
```

---

## 2. Crear la base de datos

Abre **SQL Shell (psql)** (viene con PostgreSQL en Windows) o una terminal, entra como el usuario `postgres` y pega esto (cambia `TuClaveSegura123` por una contraseña tuya, solo letras y números):

```sql
CREATE USER hspot WITH PASSWORD 'TuClaveSegura123' CREATEDB;
CREATE DATABASE hspot OWNER hspot;
CREATE DATABASE hspot_test OWNER hspot;
\q
```

`hspot_test` es solo para las pruebas automáticas (se borra cada vez que corren).

> ¿No quieres instalar PostgreSQL? Puedes usar en tu computador las mismas direcciones de Supabase (Paso 1 de `docs/PUBLICAR-EN-VERCEL.md`).

---

## 3. Configurar el proyecto

Desde la carpeta `h-spot`:

```bash
# 1. Copiar la plantilla de configuración
cp .env.example .env          # En Windows (PowerShell):  Copy-Item .env.example .env

# 2. Instalar dependencias
npm install
```

Abre el archivo `.env` (en la carpeta `h-spot`) con un editor y cambia:

- `DATABASE_URL` y `DIRECT_URL`: pon la contraseña que elegiste (en tu computador las dos son iguales). Ejemplo:
  `DATABASE_URL="postgresql://hspot:TuClaveSegura123@localhost:5432/hspot"`
- `SESSION_SECRET`: genera una clave con este comando y pégala:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```

---

## 4. Crear las tablas y los datos de demostración

```bash
npm run db:migrate     # crea las tablas
npm run db:seed        # categorías, colecciones, políticas y 12 productos DEMO con fotos provisionales
```

---

## 5. Crear el primer administrador

El registro público **nunca** crea administradores. El primero se crea así:

```bash
npm run create-admin
```

Te pedirá correo, nombre y contraseña (mínimo 8 caracteres, con letras y números).

---

## 6. Encender la tienda

```bash
npm run dev
```

Abre en el navegador:

- Tienda: http://localhost:3000
- Panel: http://localhost:3000/admin (entra con el administrador que creaste)

Para apagarla: `Ctrl + C` en la terminal.

> El servidor entrega también las páginas, así que **no necesitas abrir los archivos HTML a mano** ni usar "Live Server".

---

## 7. Primeros pasos en el panel

1. **Configuración > Checkout y pagos:** activa los métodos de pago que aceptas (vienen todos apagados).
2. **Envíos y promociones:** crea tus tarifas de envío reales. Si no hay ninguna, el cliente ve "envío por confirmar".
3. **Configuración > Portada:** cambia textos e imágenes del inicio (botón "Subir").
4. **Configuración > WhatsApp y redes:** revisa el número y agrega Instagram y TikTok.
5. **Configuración > Políticas:** completa los datos entre corchetes y haz revisar los textos por un abogado.
6. **Productos:** reemplaza los productos DEMO por los tuyos (fotos, tallas, colores y stock).

---

## 8. Cómo funciona un pedido

1. El cliente llena el formulario y pulsa **FINALIZAR PEDIDO**.
2. El servidor revisa precios, tallas y stock en la base de datos, **guarda el pedido** y aparta las unidades.
3. Se abre WhatsApp (+57 301 322 3892) con el resumen ya escrito. El cliente lo revisa y lo envía.
4. Si WhatsApp no abre, la página del pedido tiene botones para abrirlo de nuevo o copiar el resumen.
5. El pedido queda **Pendiente de confirmación**. Tú lo confirmas en el panel cuando hables con el cliente, y marcas **Pagado** cuando verifiques el pago.
6. Si en 48 horas nadie lo confirma, se cancela solo y las prendas vuelven al inventario.

---

## 9. Pruebas automáticas

```bash
npm test
```

Corren 26 pruebas sobre la base `hspot_test`: catálogo, precios calculados en el servidor, checkout, pedidos duplicados, la última unidad comprada al mismo tiempo, cancelaciones, sesiones, permisos del panel, subida de fotos y más. La lista completa de pruebas (automáticas y manuales) está en `docs/PRUEBAS.md`.

---

## 10. Comandos útiles

| Comando (dentro de la carpeta `h-spot`) | Qué hace |
|---|---|
| `npm run dev` | Enciende la tienda y se reinicia sola al guardar cambios. |
| `npm start` | Enciende la tienda (modo normal, para el servidor real). |
| `npm run db:migrate` | Aplica las tablas a la base de datos. |
| `npm run db:migrate:dev -- --name descripcion` | Crea una migración nueva después de cambiar `schema.prisma`. |
| `npm run db:seed` | Carga datos base. No crea productos demo si ya hay productos. |
| `npm run db:seed -- --reset-demo` | Borra los productos DEMO (sin pedidos) y los vuelve a crear. |
| `npm run db:studio` | Abre una ventana para ver las tablas. |
| `npm run create-admin` | Crea un administrador o convierte una cuenta existente en administradora. |
| `npm test` | Corre las pruebas. |

---

## 11. Errores comunes

| Mensaje | Solución |
|---|---|
| `Falta la variable de entorno DATABASE_URL` | No existe el archivo `.env` en la carpeta `h-spot`. Haz el paso 3. |
| `P1000: Authentication failed` | La contraseña de `DATABASE_URL` no coincide con la de PostgreSQL. |
| `Can't reach database server at localhost:5432` | PostgreSQL está apagado. En Windows: Servicios > postgresql-x64 > Iniciar. En Mac: `brew services start postgresql@16`. |
| `Database "hspot" does not exist` | No creaste la base. Haz el paso 2. |
| `EADDRINUSE: address already in use :::3000` | Ya hay otra tienda encendida. Ciérrala o cambia `PORT` en `.env`. |
| `P3014` / `permission denied to create database` al usar `db:migrate:dev` | Ese comando crea una base temporal y necesita el permiso `CREATEDB` (incluido en el paso 2). Para instalar usa `npm run db:migrate`. |
| Error instalando `argon2` o `sharp` | Usa Node 20 o 22 (LTS) y borra `node_modules` antes de `npm install`. |
| "La sesión de seguridad expiró" | Recarga la página (el token de seguridad venció). |
| "La recuperación de contraseña por correo aún no está habilitada" | Falta configurar SMTP en `.env` (ver abajo). |

---

## 12. Correo (recuperar contraseña)

Sin correo configurado, la tienda **no** finge que envía mensajes: avisa al cliente y le ofrece escribir por WhatsApp.

Para activarlo, completa en `.env` (o en las variables de Vercel) los datos que te dé tu proveedor de correo:

```
SMTP_HOST=smtp.tuproveedor.com
SMTP_PORT=587
SMTP_USER=usuario
SMTP_PASS=contraseña
MAIL_FROM="H-SPOT <no-reply@tudominio.com>"
```

Solo para probar en tu computador sin correo: `DEV_PRINT_EMAIL_LINKS=true` muestra el enlace en la terminal del servidor.

---

## 13. Más documentación

- `docs/FASE-1-PLAN.md` — arquitectura, tablas y cómo se protege el inventario.
- `docs/DECISIONES-PENDIENTES.md` — lo que el negocio debe definir antes de lanzar.
- `docs/PRUEBAS.md` — las 24 pruebas obligatorias y su resultado.
- `docs/PUBLICAR-EN-VERCEL.md` — publicar en Vercel paso a paso, sin instalar nada.
- `docs/DESPLIEGUE.md` — alternativa: publicar en un servidor propio (VPS), dominio, HTTPS y copias de seguridad.
- `docs/SEGURIDAD.md` — medidas de seguridad implementadas.
