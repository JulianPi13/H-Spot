# Publicar H-SPOT en Vercel (sin instalar Node.js)

Todo se hace desde el navegador, más un programa gratuito para subir la carpeta a GitHub.
Tiempo aproximado: 40 minutos la primera vez.

Vas a usar 3 servicios:

| Servicio | Para qué | Costo |
|---|---|---|
| **GitHub** | Guardar el código. Vercel lo toma de ahí. | Gratis |
| **Aiven** | La base de datos MySQL (pedidos, productos, clientes). | Plan gratis |
| **Vercel** | Publicar la tienda y guardar las fotos (Vercel Blob). | Gratis para probar. **Para vender se necesita el plan Pro** (ver el final). |

---

## Paso 1. Crear la base de datos en Aiven

1. Entra a https://aiven.io y crea una cuenta (puedes usar tu cuenta de Google).
2. Pulsa **Create service** y elige **MySQL**.
3. Elige el plan **Free**. En región escoge la más cercana a Estados Unidos (por ejemplo, `do-nyc` o `aws-us-east`).
4. Ponle de nombre `hspot-db` y pulsa **Create service**. Espera unos minutos hasta que diga **Running**.
5. En la pestaña **Overview** verás los **Connection information**. Anota:
   - **Host** (algo como `hspot-db-tunombre.a.aivencloud.com`)
   - **Port** (un número como `12345`)
   - **User** (`avnadmin`)
   - **Password** (pulsa el ojo para verla)
   - **Database name** (`defaultdb`)

6. Arma tu **DATABASE_URL** reemplazando los valores en esta plantilla:

```
mysql://avnadmin:CONTRASEÑA@HOST:PUERTO/defaultdb?sslaccept=accept_invalid_certs&connection_limit=3
```

Ejemplo (inventado):

```
mysql://avnadmin:AVNS_abc123XYZ@hspot-db-oscar.a.aivencloud.com:12345/defaultdb?sslaccept=accept_invalid_certs&connection_limit=3
```

Guárdala en un lugar seguro. **Nunca la publiques.**

> La conexión va cifrada. `accept_invalid_certs` solo evita tener que instalar el certificado de Aiven.

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
4. Abre **Environment Variables** y agrega estas, una por una:

| Nombre | Valor |
|---|---|
| `DATABASE_URL` | La que armaste en el Paso 1. |
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
| `FALTA DATABASE_URL` | No agregaste la variable del Paso 3. Agrégala y haz Redeploy. |
| `P1001: Can't reach database server` | Revisa el host y el puerto de Aiven, y que el servicio diga **Running**. |
| `P1000: Authentication failed` | La contraseña dentro de `DATABASE_URL` no es correcta. |
| La tienda abre pero sin productos | Falta el Blob (Paso 4) o no hiciste Redeploy después de conectarlo. |
| Las fotos no suben | Revisa que el Blob esté conectado y que la foto pese menos de 4 MB. |
| "Esta página está desactivada" en `/configuracion-inicial` | Falta `SETUP_TOKEN` (mín. 24 caracteres) o ya creaste el administrador. |

---

## Lo que debes saber de Vercel

- **Plan para vender:** el plan gratis (Hobby) de Vercel es solo para uso personal, no comercial. Para una tienda que vende necesitas el plan **Pro** (USD 20 al mes por persona que publica, a noviembre de 2026). Puedes armar y probar todo en Hobby y cambiarte a Pro antes de lanzar.
- **Reservas vencidas:** Vercel ejecuta una vez al día la tarea que cancela pedidos no confirmados. Además, la tienda lo revisa sola cada vez que alguien compra o que tú abres los pedidos en el panel, así que el inventario se mantiene al día.
- **Base de datos gratis de Aiven:** sirve para empezar (1 GB, con copias de seguridad automáticas), pero Aiven no la recomienda para producción crítica. Cuando la tienda crezca, pasa a un plan pago; solo cambias `DATABASE_URL`.
- **Límite de intentos de inicio de sesión:** en Vercel funciona por servidor, así que es menos estricto que en un servidor propio. Las demás protecciones siguen iguales.
