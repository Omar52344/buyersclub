# 08 — Beta y release

## 1. Estado

La app está funcional de punta a punta: autenticación, empresa/sucursales,
catálogo, mapa, pedidos, chat, pagos y dashboards. Esta fase prepara la salida a
una **beta cerrada** y luego a las tiendas.

Ya implementado para la revisión de tiendas:

- Eliminación de cuenta desde la app, con bloqueo si hay pedidos activos.
- Edición de nombre de perfil.
- Metadatos de build (`bundleIdentifier`, `package`, versiones), permisos y
  textos de uso de ubicación/fotos.
- Plantillas de [términos](legal/terminos.md) y
  [privacidad](legal/privacidad.md).
- `eas.json` con perfiles `development`, `preview` y `production`.
- CI de typecheck y pruebas.

## 2. Pendientes externos (no bloquean el código)

| # | Pendiente | Responsable |
|---|---|---|
| 1 | Cuenta Apple Developer (99 USD/año) y Google Play (25 USD) | Producto |
| 2 | Proyecto EAS y `EAS_PROJECT_ID` | Producto |
| 3 | Dominio, correo de soporte, URLs públicas de términos/privacidad y `PUBLIC_APP_URL` | Producto |
| 3b | Universal links / app links para que el QR abra la app instalada | Producto |
| 4 | Revisión legal de los textos | Legal |
| 5 | SMS real (fase posterior) | Producto |
| 6 | Zona piloto y comercios aliados | Negocio |
| 7 | Capturas, ícono y ficha de tienda | Diseño |
| 8 | Monitoreo (Sentry) y backups gestionados | Infra |

## 3. Variables de entorno

`apps/api/.env`:

```
NODE_ENV=production
PORT=3000
DATABASE_URL=postgres://…
CORS_ORIGIN=https://app.tudominio.com
JWT_SECRET=<openssl rand -base64 32>
SMTP_URL=…
MAIL_FROM="BuyersClub <no-reply@tudominio.com>"
GOOGLE_MAPS_API_KEY=…
S3_ENDPOINT=…
S3_BUCKET=…
S3_ACCESS_KEY_ID=…
S3_SECRET_ACCESS_KEY=…
PUBLIC_APP_URL=https://app.tudominio.com
EXPOSE_DEV_CODES=false
```

`apps/mobile/.env` (build):

```
EXPO_PUBLIC_API_URL=https://api.tudominio.com
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=…
EAS_PROJECT_ID=…
```

## 4. Build y envío

```bash
cd apps/mobile
npx eas-cli@latest login
npx eas-cli@latest init          # genera el projectId
npx eas-cli@latest build --profile preview --platform android
npx eas-cli@latest build --profile preview --platform ios
npx eas-cli@latest submit --platform android --profile production
npx eas-cli@latest submit --platform ios --profile production
```

Recomendaciones:

- Probar primero en **TestFlight** y **Play Internal**.
- Ejecutar `npx expo-doctor` antes de cada build.
- No subir `.env`; configurar las variables como *secrets* en EAS/GitHub.
- iOS: completar `NSPhotoLibraryUsageDescription` y
  `NSLocationWhenInUseUsageDescription` (ya configurados).
- Android: revisar `POST_NOTIFICATIONS` y ubicación (ya configurados).

## 5. Ficha de tienda

- Nombre: **BuyersClub**.
- Categoría: Compras / Estilo de vida.
- Descripción corta: “Descubre y pide en los comercios cerca de ti”.
- Capturas: mapa, ficha de tienda, carrito, tracker y chat.
- Política de privacidad: URL pública de [privacidad](legal/privacidad.md).
- Soporte: URL o correo de soporte.
- Cuestionario de seguridad de datos:
  - Datos de contacto, ubicación aproximada/precisa, compras e imágenes.
  - Uso: funcionalidad de la app y seguridad.
  - No se comparten con terceros para publicidad.
- Clasificación: +18 por compras y chat entre usuarios.
- UGC: el chat exige un pedido previo; reportar/bloquear queda como pendiente
  para la primera iteración de moderación.

## 6. Riesgos de revisión y mitigación

| Riesgo | Mitigación |
|---|---|
| Pagos fuera de la app | Los términos y la ficha declaran que BuyersClub no procesa pagos; los bienes son físicos y el pago se coordina con el comercio |
| Chat de usuarios (UGC) | Reporte/bloqueo y moderación pendientes; monitorear la beta |
| Eliminación de cuenta | Implementada en **Cuenta y ajustes** |
| Datos sensibles en comprobantes | Almacenamiento privado con URLs firmadas, retención de 12 meses |
| Ubicación | Permiso contextual y explicación en la ficha |
| Notificaciones | Permiso solicitado tras el login; la bandeja in-app funciona sin push |

## 7. Plan de beta

1. **Zona piloto**: una ciudad/barrio con 10–20 comercios.
2. **Compradores**: 30–50 personas invitadas.
3. **Soporte**: canal directo (WhatsApp/correo) y guion de incidencias.
4. **Duración**: 2–4 semanas.
5. **Métricas**:
   - comercios con catálogo completo,
   - pedidos por semana,
   - pedidos completados / creados,
   - tiempo de validación de pago,
   - segunda compra en 30 días,
   - crashes y latencia.
6. **Criterio de salida**: 50 pedidos/semana, ≥85 % completados y sin bugs
   bloqueantes durante 5 días.

## 8. Checklist de salida (go/no-go)

- [ ] API en producción con HTTPS, `NODE_ENV=production` y `JWT_SECRET` propio.
- [ ] Migraciones aplicadas y backups verificados.
- [ ] Buckets/objetos privados y CORS restringido.
- [ ] Key de Google restringida por plataforma y con alertas de costo.
- [ ] Push probado en dispositivo real (dev build) con `EAS_PROJECT_ID`.
- [ ] QR de una sucursal probado en navegador y app; `PUBLIC_APP_URL` apunta al dominio público.
- [ ] Términos y privacidad publicados en URL pública.
- [ ] Eliminación de cuenta probada en la build de producción.
- [ ] Capturas y ficha listas en App Store Connect y Play Console.
- [ ] Comercios piloto capacitados y con catálogo cargado.
- [ ] Soporte y rollback definidos.

## 9. Rollback

- API: imagen/versión anterior y migraciones compatibles (expand/contract).
- Web: redeploy de la versión estable.
- Móvil: EAS Update para correcciones JS; nueva build solo si cambia código
  nativo.

## 10. Limitaciones conocidas de la beta

- SMS real pendiente (el celular se valida con OTP de desarrollo).
- El chat usa WebSocket con respaldo de polling.
- Sin pasarela de pagos: solo evidencia y validación manual.
- Sin moderación automática de imágenes/chat.
- Sin reseñas ni favoritos.
- Almacenamiento S3/R2 opcional; por defecto disco local.
