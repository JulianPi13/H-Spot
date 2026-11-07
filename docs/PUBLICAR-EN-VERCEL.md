# Publicar H-SPOT en Vercel (sin instalar Node.js)

Todo se hace desde el navegador, más un programa gratuito para subir la carpeta a GitHub.
Tiempo aproximado: 40 minutos la primera vez.

> Si en Vercel ya creaste el proyecto y el primer deploy falló con `FALTA DATABASE_URL`, es normal: completa el Paso 1, agrega las variables del Paso 3 y pulsa **Redeploy**.

Vas a usar 3 servicios:

| Servicio | Para qué | Costo |
|---|---|---|
| **GitHub** | Guardar el código. Vercel lo toma de ahí. | Gratis |
| **Supabase** | La base de datos (pedidos, productos, clientes). | Plan gratis |
| **Vercel** | Publicar la tienda y guardar las fotos (Vercel Blob). | Gratis para probar. **Para vender se necesita el plan Pro** (ver el final). |

---

## Paso 1. Crear la base de datos en Supabase

1. Entra a https://supabase.com y crea una cuenta (puedes entrar con GitHub).
2. Pulsa **New project**:
   - **Name:** `hspot`
   - **Database Password:** inventa una contraseña **solo con letras y números** (sin símbolos como `@`, `#` o `/`, porque rompen la dirección de conexión). Anótala.
   - **Region:** la más cercana a Colombia (por ejemplo, *East US*).
   - Pulsa **Create new project** y espera un par de minutos.
3. Cuando esté listo, pulsa el botón **Connect** (arriba en el proyecto).
4. Busca la sección **Connection string > URI** y copia dos direcciones:

   **a) Transaction pooler** (termina en `:6543/postgres`). Será tu `DATABASE_URL`. Al final agrégale `?pgbouncer=true&connection_limit=1`:

   ```
   postgresql://postgres.abcdefghijkl:TU_CONTRASEÑA@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
   ```

   **b) Session pooler** (igual, pero termina en `:5432/postgres`). Será tu `DIRECT_URL`, tal cual:

   ```
   postgresql://postgres.abcdefghijkl:TU_CONTRASEÑA@aws-0-us-east-1.pooler.supabase.com:5432/postgres
   ```

   En ambas, cambia `[YOUR-PASSWORD]` por la contraseña del punto 2.

Guárdalas en un lugar seguro. **Nunca las publiques.**

> ¿Por qué dos? La tienda usa la primera para atender a muchos clientes a la vez. La segunda solo se usa al publicar, para crear o actualizar las tablas.

---

## Paso 2. Subir el código a GitHub (con GitHub Desktop)

1. Crea una cuenta en https://github.com si no tienes.
2. Instala **GitHub Desktop**: https://desktop.github.com e inicia sesión.
3. Descomprime `h-spot.zip` en tu computador (por ejemplo en `Documentos\h-spot`).
4. En GitHub Desktop: **File > Add local repository**, elige la carpeta `h-spot`.
   Si te dice que no es un repositorio, pulsa **create a repository** y luego **Create repository**.
5. Pulsa **Publish repository**. **Deja marcada la casilla "Keep this code private"** y confirma.

Listo: tu código ya está en GitHub, en privado.

---

## Paso 3. Crear el proyecto en Vercel

1. Entra a https://vercel.com y regístrate con **Continue with GitHub**.
2. Pulsa **Add New… > Project** y elige tu repositorio `h-spot` (**Import**).
3. En **Framework Preset** deja **Other**. No cambies nada de Build ni de Output (el archivo `vercel.json` ya lo trae configurado).
4. Abre **Environment Variables** y agrega estas 6, una por una:

| Nombre | Valor |
|---|---|
| `DATABASE_URL` | La dirección **Transaction pooler** del Paso 1 (puerto 6543, con `?pgbouncer=true&connection_limit=1`). |
| `DIRECT_URL` | La dirección **Session pooler** del Paso 1 (puerto 5432). |
| `SESSION_SECRET` | Una frase larga inventada, de al menos 40 caracteres, con letras y números. Ejemplo de forma: `hspot-Bucaramanga-2026-calle45-Q8w3n7Lk2pX9`. **No uses el ejemplo.** |
| `SETUP_TOKEN` | Otra clave inventada, de al menos 24 caracteres. Sirve para crear tu usuario administrador. |
| `CRON_SECRET` | Otra clave inventada de al menos 24 caracteres. |
| `NODE_ENV` | `production` |

5. Pulsa **Deploy**. Espera a que termine (2 a 4 minutos). En esta primera vez la tienda sale **sin productos**: es normal, faltan las fotos (Paso 4).

---

## Paso 4. Conectar el almacenamiento de fotos (Vercel Blob)

Vercel no guarda archivos en su servidor, así que las fotos van a un "Blob store".

1. Dentro de tu proyecto en Vercel, abre la pestaña **Storage**.
2. Pulsa **Create Database** (o **Connect Database**), elige **Blob** y **Continue**.
3. En el tipo de acceso elige **Public** (las fotos de productos deben verse en la tienda).
4. Ponle un nombre (por ejemplo `hspot-fotos`) y créalo. Vercel agrega solo la variable `BLOB_READ_WRITE_TOKEN`.
5. Ve a la pestaña **Deployments**, abre el menú (los tres puntos) del último y pulsa **Redeploy**.

Esta vez se crean las tablas y los **12 productos de demostración** con sus fotos provisionales.

---

## Paso 5. Crear tu usuario administrador

1. Abre tu tienda: `https://TU-PROYECTO.vercel.app/configuracion-inicial`
   (la dirección exacta aparece en Vercel, en **Domains**).
2. Escribe el `SETUP_TOKEN` que pusiste en el Paso 3, tu nombre, tu correo y una contraseña.
3. Pulsa **Crear administrador** y entra al panel en `https://TU-PROYECTO.vercel.app/admin`.
4. **Por seguridad:** en Vercel, **Settings > Environment Variables**, borra `SETUP_TOKEN`. La página de configuración inicial queda desactivada para siempre (ya existe un administrador).

---

## Paso 6. Dejar la tienda lista

En el panel `/admin` (detalles en `DECISIONES-PENDIENTES.md`):

- **Configuración > Checkout y pagos:** activa tus métodos de pago.
- **Envíos y promociones:** crea tus tarifas de envío.
- **Productos:** reemplaza los productos DEMO por los tuyos, con fotos reales (máximo 4 MB por foto).
- **Configuración > Portada, WhatsApp y redes, Políticas:** tus textos, fotos e enlaces.

---

## Paso 7. Tu dominio (opcional)

1. En Vercel: **Settings > Domains**, escribe tu dominio (por ejemplo `hspot.com.co`) y pulsa **Add**.
2. Vercel te muestra qué registros DNS crear. Créalos en la empresa donde compraste el dominio. El HTTPS (candado) lo pone Vercel solo.
3. Cuando el dominio funcione, agrega en **Environment Variables**:
   - `APP_URL` = `https://hspot.com.co`
   - `CORS_ORIGINS` = `https://hspot.com.co`

   Y haz **Redeploy**.

---

## Cómo actualizar la tienda después

Si cambias algo en el código: abre GitHub Desktop, escribe un resumen del cambio, pulsa **Commit** y luego **Push origin**. Vercel publica la nueva versión sola en un par de minutos.

Lo que cambias desde el panel (productos, precios, fotos, textos) **no** necesita volver a publicar: se ve de inmediato.

---

## Si algo falla

Ve a Vercel, pestaña **Deployments**, abre el último y mira **Build Logs**. Copia el mensaje de error y compártelo.

| Mensaje | Solución |
|---|---|
| `FALTA DATABASE_URL` o `FALTA DIRECT_URL` | Falta esa variable (Paso 3). Agrégala y haz Redeploy. |
| `P1001: Can't reach database server` | Revisa que copiaste bien la dirección y que el proyecto de Supabase no esté pausado (en Supabase pulsa **Restore project**). |
| `P1000: Authentication failed` | La contraseña dentro de la dirección no es correcta. Puedes cambiarla en Supabase: **Project Settings > Database > Reset database password**. |
| `prepared statement ... already exists` | A `DATABASE_URL` le falta `?pgbouncer=true&connection_limit=1` al final. |
| La tienda abre pero sin productos | Falta el Blob (Paso 4) o no hiciste Redeploy después de conectarlo. |
| Las fotos no suben | Revisa que el Blob esté conectado y que la foto pese menos de 4 MB. |
| "Esta página está desactivada" en `/configuracion-inicial` | Falta `SETUP_TOKEN` (mín. 24 caracteres) o ya creaste el administrador. |

---

## Lo que debes saber de Vercel

- **Plan para vender:** el plan gratis (Hobby) de Vercel es solo para uso personal, no comercial. Para una tienda que vende necesitas el plan **Pro** (USD 20 al mes por persona que publica, a noviembre de 2026). Puedes armar y probar todo en Hobby y cambiarte a Pro antes de lanzar.
- **Reservas vencidas:** Vercel ejecuta una vez al día la tarea que cancela pedidos no confirmados. Además, la tienda lo revisa sola cada vez que alguien compra o que tú abres los pedidos en el panel, así que el inventario se mantiene al día.
- **Supabase gratis:** sirve para empezar, pero **se pausa si pasa una semana sin actividad**; con una tienda en uso no ocurre. El plan gratis no incluye copias de seguridad que puedas descargar: cuando la tienda venda de verdad, conviene el plan Pro de Supabase. Para cambiar de plan no hay que tocar el código.
- **Ver tus datos:** en Supabase, **Table Editor** muestra pedidos, productos y clientes como una hoja de cálculo. Úsalo para mirar; para cambiar cosas usa el panel `/admin` de la tienda, que valida y registra cada cambio.
- **Límite de intentos de inicio de sesión:** en Vercel funciona por servidor, así que es menos estricto que en un servidor propio. Las demás protecciones siguen iguales.
