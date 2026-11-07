# Alternativa — Publicar H-SPOT en un servidor propio (VPS)

> ¿Prefieres no administrar un servidor? Usa `PUBLICAR-EN-VERCEL.md`.

La forma más sencilla y económica de tener todo bajo control es un **servidor VPS con Ubuntu** (por ejemplo DigitalOcean, Hetzner, Vultr o Contabo), donde viven juntos la tienda, MySQL y las fotos.

## 1. Preparar el servidor (Ubuntu 24.04)

```bash
sudo apt update && sudo apt upgrade -y
# Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs mysql-server nginx git
sudo npm install -g pm2
```

Crea la base y el usuario igual que en el README (paso 2), con una contraseña larga.

## 2. Subir el código

```bash
cd /var/www
sudo git clone https://github.com/TU_USUARIO/h-spot.git
sudo chown -R $USER:$USER h-spot
cd h-spot && cp .env.example .env
nano .env
```

En `.env` de producción:

```
NODE_ENV=production
PORT=3000
APP_URL=https://tudominio.com
CORS_ORIGINS=https://tudominio.com
DATABASE_URL="mysql://hspot:CONTRASEÑA_LARGA@localhost:3306/hspot"
SESSION_SECRET=(clave aleatoria de 96 caracteres)
DEV_PRINT_EMAIL_LINKS=false
```

```bash
npm ci
npx prisma generate
npm run db:migrate
npm run db:seed            # opcional: en producción borra luego los productos DEMO
npm run create-admin
pm2 start backend/server.js --name hspot
pm2 save && pm2 startup     # que arranque solo si el servidor se reinicia
```


## 3. Dominio

En el panel donde compraste el dominio (por ejemplo `hspot.com.co`), crea dos registros DNS tipo **A** apuntando a la IP del servidor: `@` y `www`.

## 4. Nginx + HTTPS gratis (Let's Encrypt)

Crea `/etc/nginx/sites-available/hspot`:

```nginx
server {
    server_name tudominio.com www.tudominio.com;
    client_max_body_size 12M;   # fotos (hasta 10 por subida)

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/hspot /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d tudominio.com -d www.tudominio.com
```

Certbot renueva el certificado solo. En producción las cookies se marcan `Secure` y el navegador recibe HSTS.

Firewall básico:

```bash
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
```

MySQL **no** debe quedar abierto a internet (por defecto solo escucha en `localhost`).

## 5. Copias de seguridad

Respaldar dos cosas: **la base de datos** y **la carpeta de fotos** (`backend/uploads`).

```bash
sudo mkdir -p /var/backups/hspot
# Editar tareas programadas:
crontab -e
```

Agrega (todos los días a las 3 a. m., guarda 14 días):

```
0 3 * * * mysqldump --single-transaction -u hspot -p'CONTRASEÑA' hspot | gzip > /var/backups/hspot/db-$(date +\%F).sql.gz
15 3 * * * tar -czf /var/backups/hspot/uploads-$(date +\%F).tar.gz -C /var/www/h-spot/backend uploads
30 3 * * * find /var/backups/hspot -type f -mtime +14 -delete
```

Copia esos archivos también **fuera del servidor** (Google Drive, otro servidor, S3). Para restaurar:

```bash
gunzip < db-2026-11-07.sql.gz | mysql -u hspot -p hspot
```

## 6. Actualizar la tienda

```bash
cd /var/www/h-spot && git pull
npm ci && npm run db:migrate && pm2 restart hspot
```

## 7. Alternativa: plataformas administradas

Railway, Render o similares también sirven (Node + MySQL administrado). Ojo: muchas borran los archivos del disco en cada despliegue. Si usas una de esas, monta un **volumen persistente** para `backend/uploads` o cambia `src/services/storage.service.js` para usar Cloudinary o S3.

## 8. Lista antes de lanzar

- [ ] `NODE_ENV=production`, `SESSION_SECRET` nueva y larga, HTTPS activo.
- [ ] Productos DEMO eliminados y fotos reales cargadas.
- [ ] Métodos de pago, tarifas de envío y políticas revisadas.
- [ ] SMTP configurado (o aceptar que la recuperación de contraseña sea por WhatsApp).
- [ ] Copias de seguridad probadas (restaurar una vez para verificar).
- [ ] Hacer un pedido real de prueba de punta a punta.
