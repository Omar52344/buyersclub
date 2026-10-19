# BuyersClub

Marketplace de comercio local: un mapa vivo de tiendas, catálogos y pedidos con
entrega en tienda o a domicilio. Compradores y vendedores en una sola app
(Android, iOS y web).

> **Estado: Fase 1 — Fundaciones (en curso).** La planificación está aprobada y
> el repositorio ya contiene el esqueleto del monorepo. Ver el
> [roadmap](docs/06-roadmap.md).

---

## 1. Resumen ejecutivo

| Tema | Decisión |
|---|---|
| Cliente | **React Native + Expo** con `expo-router` y **React Native Web** para la versión web |
| Lenguaje | **TypeScript** de punta a punta |
| Backend | **Node.js + Fastify** (API REST) + **WebSocket** para chat/estados |
| Base de datos | **PostgreSQL 16 + PostGIS** (geolocalización por radio/distancia) |
| ORM / validación | **Drizzle ORM** + **Zod** (esquemas compartidos en `packages/core`) |
| Archivos (evidencia de pago, fotos) | **S3-compatible** (Cloudflare R2 o Moto (S3 local)) con URLs firmadas |
| Notificaciones | **Expo Push Service** (APNs/FCM) + notificaciones locales |
| Mapas | **Google Maps Platform** (decisión cerrada): `react-native-maps` en nativo + Maps JS en web, aislados tras una interfaz propia |
| Autenticación | **Contraseña** (scrypt) + **OTP por correo** para verificar y recuperar; teléfono verificado por código (SMS real en fase 2) |
| Monedas | **COP** por defecto; el vendedor elige **COP o USD** al crear su empresa. Sin conversión entre monedas en fase 1 |
| Monorepo | **npm workspaces**: `apps/mobile`, `apps/api`, `packages/core` (Turborepo opcional más adelante) |
| Despliegue | API en Fly.io/Railway, Postgres gestionado (Neon/Supabase), web estática en Cloudflare/Vercel, builds móviles con **EAS** |
| Monetización | **Ninguna en fase 1** (sin planes, sin límites, sin comisión) |

**Esfuerzo estimado del MVP**: 14–17 semanas con 1 desarrollador
full-stack; 8–10 semanas con 2 desarrolladores en paralelo. Detalle en
[06-roadmap.md](docs/06-roadmap.md).

---

## 2. Índice de documentación

| Documento | Contenido |
|---|---|
| [00-contexto-y-alcance.md](docs/00-contexto-y-alcance.md) | Problema, visión, actores, flujos, alcance MVP y lo que queda fuera |
| [01-evaluacion-tecnica.md](docs/01-evaluacion-tecnica.md) | Comparativa de frameworks, notificaciones, mapas y backend. Por qué Expo |
| [02-arquitectura.md](docs/02-arquitectura.md) | Arquitectura, monorepo, entornos, seguridad, ADRs y observabilidad |
| [03-modelo-de-datos.md](docs/03-modelo-de-datos.md) | ER, tablas, índices PostGIS, máquinas de estado y migraciones |
| [04-api.md](docs/04-api.md) | Convenciones REST, endpoints por dominio, eventos WS y errores |
| [05-funcionalidades.md](docs/05-funcionalidades.md) | Historias de usuario y criterios de aceptación por módulo |
| [06-roadmap.md](docs/06-roadmap.md) | Fases, hitos, estimaciones y definición de "terminado" |
| [07-riesgos-y-decisiones.md](docs/07-riesgos-y-decisiones.md) | Riesgos técnicos/legales, mitigaciones y decisiones pendientes |

---

## 3. El producto en una frase

> Cualquier persona abre el mapa, ve los comercios de su zona con su catálogo y
> su estado (abierto/cerrado), pide por entrega o recoge en tienda, paga por
> fuera de la app y sube el comprobante; el vendedor lo valida y ambos siguen el
> pedido en tiempo real con chat incluido.

## 4. Los tres módulos del MVP

1. **Identidad y negocio** — registro con correo + teléfono, verificación por
   código, onboarding de vendedor (empresa, sucursales, horarios, catálogo).
2. **Descubrimiento y pedido** — mapa de tiendas cercanas, catálogo, carrito,
   checkout (domicilio/recogida), tracker de estado y ETA.
3. **Operación** — chat comprador↔vendedor con imágenes, evidencia de pago y
   validación, listas de pedidos por sucursal, dashboards con filtros de fecha.

## 5. Cómo se trabaja este repositorio

- Cada decisión relevante se registra como **ADR** en
  [02-arquitectura.md](docs/02-arquitectura.md#11-adrs).
- Los cambios de alcance se reflejan en `00` y `05`; los de plan en `06`.
- Convención de commits: `feat:`, `fix:`, `docs:`, `chore:` (Conventional
  Commits) para poder generar changelog y versionar.
- Las decisiones de producto y arquitectura se registran en
  [07](docs/07-riesgos-y-decisiones.md) y [02](docs/02-arquitectura.md#11-adrs).

## 6. Estructura del repositorio

```
buyersclub/
├── apps/
│   ├── api/          Fastify + Drizzle ORM (REST)
│   └── mobile/       Expo + expo-router (iOS, Android y web)
├── packages/
│   └── core/         dinero, monedas, estados de pedido y esquemas Zod
├── infra/            docker-compose (PostGIS, Redis, S3 local (Moto), Mailpit)
└── docs/             planificación, arquitectura y roadmap
```

## 7. Cómo correr en local

Requisitos: Node 20+, Docker y (opcional) la app Expo Go o un dev build.

> **Nota sobre npm en esta máquina**: el caché global (`~/.npm`) tiene archivos
> de root y `npm install` falla con `EACCES`. El repo usa un caché local:
>
> ```bash
> export npm_config_cache="$PWD/.npm-cache"
> ```
>
> También puedes corregir el caché global una sola vez con
> `sudo chown -R "$(id -u):$(id -g)" ~/.npm`.

```bash
# 1. Dependencias
export npm_config_cache="$PWD/.npm-cache"
npm install

# 2. Servicios locales (Postgres+PostGIS en 5433, Redis, S3 local (Moto), Mailpit)
#    --wait evita el error 57P03 de "database system is starting up".
npm run services:up

# Alternativa sin esperar: docker compose -f infra/docker-compose.yml up -d

# El storage local es Moto (S3 en memoria): los archivos se pierden al
# reiniciar el contenedor. En producción se usa Cloudflare R2 / S3.
# Mailpit (correos de prueba): http://localhost:8025

# 3. Variables de entorno
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env

# 4. Base de datos
npm run db:generate    # solo si cambió el esquema
npm run db:migrate
npm run db:seed        # categorías iniciales (idempotente)

# 5. API
npm run dev:api        # http://localhost:3000/health · /v1/meta

# 6. App (elige una)
npm run web            # http://localhost:8081
npm run dev:mobile     # QR para Expo Go / dev client
```

## 8. Estado de implementación

| Área | Estado |
|---|---|
| Planificación, arquitectura y roadmap | ✅ Aprobados |
| Monorepo (npm workspaces, TypeScript) | ✅ |
| `packages/core` (dinero, monedas, estados, Zod) | ✅ Con pruebas |
| API Fastify (health, meta, errores, rate limit, CORS) | ✅ |
| Infra local: PostGIS, Redis, S3 (Moto) y Mailpit | ✅ `infra/docker-compose.yml` |
| Esquema PostgreSQL/Drizzle | ✅ Aplicado en Docker: 23 tablas + PostGIS 3.4 |
| API de autenticación (contraseña + OTP, refresh, recuperación, `/me`) | ✅ Probada de punta a punta con Mailpit |
| App Expo: registro/login con contraseña, código alternativo y recuperación | ✅ |
| Fase 2 API: empresa, sucursales, horarios, catálogo y overrides | ✅ Probada de punta a punta |
| Fase 2 App: pantalla "Mi negocio" (empresa, sucursales, horarios y catálogo) | ✅ Incluida en el build web |
| Fase 3 API: PostGIS, radio, filtros y abierto/cerrado en servidor | ✅ Probada con datos reales |
| Fase 3 App: explorar tiendas y ficha pública con catálogo | ✅ En el build web |
| Mapa visual: Maps JS en web y `react-native-maps` en nativo | ✅ Configurado (keys en `.env`) |
| Fase 4 API: pedidos, totales en servidor, estados, tracker y cancelación | ✅ Probada de punta a punta |
| Fase 4 App: carrito, checkout, mis pedidos, detalle y pedidos del vendedor | ✅ En el build web |
| Chat, evidencia de pago, notificaciones y dashboards | ⏳ Fases 5–6 |

## 9. Próximo paso

La **Fase 4 quedó completa**: carrito persistente, checkout con domicilio o
recogida, dirección, medios de pago, recálculo de precios y totales en el
servidor, validación de sucursal abierta y pedido mínimo, máquina de estados,
tracker con historial, cancelación del comprador y avance de estados desde la
pantalla de pedidos del vendedor.

### Google Maps: configuración y seguridad

- `apps/api/.env` → `GOOGLE_MAPS_API_KEY` para geocodificación en el servidor.
- `apps/mobile/.env` → `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` para Maps JS (web) y los
  SDK nativos.
- [`app.config.js`](apps/mobile/app.config.js) inyecta la key en Android/iOS sin
  escribirla en el repositorio. Las keys **no** se versionan.
- Restringe la key en Google Cloud: habilita solo **Maps JavaScript API, Maps SDK
  for Android, Maps SDK for iOS y Geocoding API**; limita referrers web
  (`http://localhost:8081/*` y tu dominio), el package Android
  (`com.buyersclub.app` + SHA-1) y el bundle iOS (`com.buyersclub.app`).
- Rota cualquier key que se haya compartido por un canal inseguro.

Sigue la **Fase 5 — Chat y pago**: mensajes por pedido, imágenes, comprobante de
pago y validación del vendedor.
