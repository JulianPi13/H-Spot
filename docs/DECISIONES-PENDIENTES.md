# Decisiones que debe tomar el negocio antes de lanzar

Todo esto se cambia desde el panel `/admin` o en `.env`, sin tocar código.

1. **Métodos de pago.** Están todos desactivados al inicio. Activen los que realmente acepten (Configuración > Checkout y pagos).
2. **Tarifas de envío.** No hay ninguna creada (no inventamos precios). Mientras no existan, el checkout dice "envío por confirmar". Créalas en Envíos y promociones.
3. **Envío gratis.** Decidir si habrá un monto mínimo para envío gratis.
4. **Tiempo de reserva** de un pedido sin confirmar: hoy 48 horas (`ORDER_RESERVATION_HOURS` en `.env`).
5. **Precios incluyen IVA o no.** Si la empresa es responsable de IVA, confirmarlo con el contador y reflejarlo en los textos.
6. **Políticas legales.** Los textos de datos personales, términos, envíos y cambios son borradores. Deben completarse (razón social, NIT, correo, días de cambio) y revisarse por un abogado.
7. **Correo SMTP.** Elegir proveedor (por ejemplo Brevo, Zoho Mail, Google Workspace, Amazon SES) para recuperación de contraseña.
8. **Fotografías reales.** Todas las imágenes de productos, hero, banner y categorías son provisionales y están marcadas.
9. **Guía de tallas.** Las medidas de la guía son de ejemplo (`frontend/js/pages/product.js`, constante `SIZE_GUIDE`). Reemplazar por las medidas reales.
10. **Productos de demostración.** Los 12 productos demo (marcados "DEMO") deben borrarse o reemplazarse antes del lanzamiento.
11. **Redes sociales.** Instagram y TikTok están vacíos a propósito. Agregar los enlaces reales en Configuración.
12. **Dominio y hosting.** Ver `docs/PUBLICAR-EN-VERCEL.md`.
14. **Planes pagos.** Para vender: Vercel Pro (uso comercial) y, cuando haya ventas reales, Supabase Pro (sin pausas por inactividad y con copias de seguridad diarias).
13. **Almacenamiento de fotos.** Si el hosting no conserva archivos entre despliegues, migrar a Cloudinary o S3.
