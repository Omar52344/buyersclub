# BuyersClub

Marketplace de comercio local: un mapa vivo de tiendas, catálogos y pedidos con
entrega en tienda o a domicilio. Compradores y vendedores en una sola app
(Android, iOS y web).

> **Estado: Fase 0 — Evaluación y planificación.** Todavía no hay código de
> producto. Este repositorio contiene la documentación de decisiones, alcance,
> arquitectura, modelo de datos y roadmap.

---

## 1. Resumen ejecutivo

| Tema | Decisión propuesta |
|---|---|
| Cliente | **React Native + Expo (SDK 53+)** con `expo-router` y **React Native Web** para la versión web |
| Lenguaje | **TypeScript** de punta a punta |
| Backend | **Node.js + Fastify** (API REST) + **WebSocket** para chat/estados |
| Base de datos | **PostgreSQL 16 + PostGIS** (geolocalización por radio/distancia) |
| ORM / validación | **Drizzle ORM** + **Zod** (esquemas compartidos en `packages/core`) |
| Archivos (evidencia de pago, fotos) | **S3-compatible** (Cloudflare R2 o MinIO) con URLs firmadas |
| Notificaciones | **Expo Push Service** (APNs/FCM) + notificaciones locales |
| Mapas | `react-native-maps` en nativo + Google Maps JS en web, aislados tras una interfaz propia |
| Autenticación | **Passwordless**: código OTP por correo; teléfono con OTP "pendiente de SMS" en fase 1 |
| Monorepo | **pnpm workspaces + Turborepo**: `apps/mobile`, `apps/api`, `packages/core` |
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
- Antes de la primera línea de código de producto se cierran las
  [decisiones pendientes](docs/07-riesgos-y-decisiones.md#4-decisiones-pendientes).

## 6. Próximo paso

Cerrar las decisiones abiertas (país de operación, proveedor de mapas,
prioridad web vs. app) y ejecutar la **Fase 1 — Fundaciones** descrita en el
roadmap: monorepo, autenticación OTP, modelo de datos base y esqueleto de las
tres plataformas.
