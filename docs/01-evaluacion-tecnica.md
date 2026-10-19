# 01 — Evaluación técnica

Objetivo: elegir la combinación de tecnologías que permita **una sola base de
código** para Android, iOS y web, con **notificaciones confiables**, **mapas
fluidos** y un backend ligero sobre PostgreSQL, sin sacrificar velocidad de
entrega.

## 1. Requisitos que condicionan la decisión

| Requisito | Implicación técnica |
|---|---|
| Android + iOS + web | Framework con render multiplataforma real, no solo "responsive web" |
| Mapa con cientos de pines y geolocalización | Librería nativa de mapas + consultas geoespaciales en la BD |
| Push notifications (pedidos, pagos, chat) | Integración APNs/FCM de primera clase, con servidor de envío |
| Chat con imágenes | WebSocket + storage de archivos |
| Dashboards con filtros de fecha | SQL analítico, no un backend rígido |
| Cámara/galería para evidencia de pago | APIs nativas de cámara y subida de archivos |
| Iteración rápida y equipo pequeño | Ecosistema maduro, hot reload, builds gestionados |
| Costo bajo en fase 1 | Servicios gratuitos o baratos, sin licencias |

## 2. Criterios y pesos

| Criterio | Peso | Por qué |
|---|---|---|
| Cobertura web + iOS + Android | 25 | El objetivo declarado es una sola app para las tres plataformas |
| Notificaciones push | 15 | El usuario ya manifestó que es un punto doloroso en Ionic |
| Mapas y geolocalización | 15 | Es el corazón del producto |
| Velocidad de desarrollo | 15 | Fase 1 con equipo pequeño y mucho por construir |
| Madurez y ecosistema | 10 | Menos riesgos de dependencias abandonadas |
| Rendimiento y sensación nativa | 10 | Mapas, listas largas, chat y cámara exigen fluidez |
| Costo operativo | 5 | Sin monetización todavía |
| Curva de aprendizaje | 5 | Importa, pero es superable |

Escala 1–5 por criterio; total ponderado sobre 500.

## 3. Opciones evaluadas

### A. React Native + Expo (con React Native Web)

**Cómo funciona**: un solo proyecto Expo compila a Android e iOS nativos y, con
`react-native-web` + `expo-router`, sirve una versión web de la misma app.

- ✅ Una base de código para las tres plataformas; el equipo escribe React/TS.
- ✅ **Notificaciones**: `expo-notifications` + Expo Push Service (gratuito) que
  habla con APNs y FCM por ti. Es el camino más corto y estable a push real.
- ✅ Mapas: `react-native-maps` (Google en Android, Apple/Google en iOS) y
  Google Maps JS en web, detrás de un componente propio.
- ✅ Ecosistema enorme: cámara, storage, deep links, pagos, analytics.
- ✅ Builds y firmas sin Mac: **EAS Build**; actualizaciones OTA con EAS Update.
- ⚠️ La web no es "HTML nativo": hay que cuidar accesibilidad, bundles y SEO.
- ⚠️ Algunas librerías nativas requieren *dev client* (no funcionan en Expo Go).
- ⚠️ El rendimiento en listas/mapas exige cuidado (memoización, clustering).

### B. Angular + Capacitor (sin Ionic)

**Cómo funciona**: app Angular (web-first) empaquetada como app nativa con
Capacitor. La UI se hace con Angular Material/Tailwind, no con Ionic.

- ✅ Web perfecta (SSR/SSG con Angular Universal, SEO real, PWA).
- ✅ Angular moderno (signals, standalone components, build con esbuild) es
  productivo y muy tipado.
- ✅ Capacitor es maduro y separa el problema "web" del problema "nativo".
- ⚠️ **Notificaciones**: dependes de plugins de la comunidad
  (`@capacitor/push-notifications`) + configuración manual de FCM/APNs y, en
  varios casos, de un backend propio. Funciona, pero es exactamente el punto
  donde Ionic/Capacitor genera fricción.
- ⚠️ La app nativa es un WebView: mapas y listas largas se sienten menos
  fluidos, y la cámara/archivos pasan por plugins.
- ⚠️ El "look" nativo hay que construirlo a mano.

### C. Ionic + Angular

Descartada por el usuario por la experiencia de notificaciones y por el look
web dentro de la app. Se incluye en la matriz solo como referencia.

### D. Flutter

- ✅ Rendimiento y consistencia visual excelentes; muy buen mapa y cámara.
- ✅ Push con `firebase_messaging` es sólido.
- ❌ Web con CanvasKit: pesado, poco accesible, SEO prácticamente nulo.
- ❌ Dos lenguajes (Dart + backend) y un ecosistema web distinto.

### E. Dos apps: Next.js (web) + Expo (app)

- ✅ Lo mejor de cada mundo: web con SEO/SSR de verdad y app nativa real.
- ✅ Se comparte lógica de negocio y tipos vía `packages/core`.
- ❌ Dos superficies de UI que mantener: prácticamente duplica el trabajo de
  pantallas y el QA.
- 💡 Es el **camino de evolución** si el SEO/la adquisición web se vuelve
  crítico. La arquitectura propuesta lo permite sin reescribir el backend.

### F. Solo PWA

- ✅ Barata y rápida; instalable.
- ❌ Push en iOS históricamente limitado y con restricciones; sin presencia en
  tiendas; cámara/archivos con menos garantías. No cumple "exportar app Android
  e iOS".

## 4. Matriz de decisión

| Criterio (peso) | A. RN+Expo | B. Angular+Capacitor | C. Ionic | D. Flutter | E. Next+Expo | F. PWA |
|---|---|---|---|---|---|---|
| Cobertura 3 plataformas (25) | 5 | 5 | 5 | 3 | 5 | 2 |
| Notificaciones push (15) | 4 | 3 | 2 | 4 | 4 | 2 |
| Mapas/geo (15) | 4 | 4 | 4 | 4 | 5 | 5 |
| Velocidad de desarrollo (15) | 4 | 3 | 4 | 4 | 2 | 5 |
| Madurez/ecosistema (10) | 5 | 5 | 4 | 5 | 5 | 4 |
| Rendimiento/nativo (10) | 4 | 2 | 2 | 5 | 4 | 3 |
| Costo operativo (5) | 5 | 5 | 5 | 4 | 4 | 5 |
| Curva de aprendizaje (5) | 3 | 5 | 5 | 2 | 3 | 5 |
| **Total /500** | **435** | **395** | **385** | **385** | **415** | **350** |
| **Índice** | **87** | **79** | **77** | **77** | **83** | **70** |

> Puntajes subjetivos, documentados para poder revisarlos. El orden es lo que
> importa: **Expo gana por cobertura total con buen push y buena velocidad**;
> Next+Expo gana en calidad web pero pierde en esfuerzo; Angular+Capacitor es la
> alternativa viable si el equipo es Angular y la web/SEO es prioridad.

## 5. Decisión: React Native + Expo

### Por qué

1. **Cumple el requisito principal**: una sola app para Android, iOS y web.
2. **Resuelve el dolor de notificaciones**: Expo Push Service gestiona APNs y
   FCM sin que tengas que montar la infraestructura de certificados y tokens.
3. **Mapas y cámara** tienen soporte de primera clase y buen rendimiento nativo.
4. **Velocidad**: expo-router, EAS Build/Update y un ecosistema de módulos
   reducen semanas de trabajo frente a mantener dos apps.
5. **Riesgo controlado**: la lógica de negocio vive en `packages/core`
   (TypeScript puro), así que si más adelante se agrega un frontend Next.js para
   SEO, se reutiliza sin tocar el backend.
6. **Web en paralelo**: la misma app corre en el navegador, así que cada pantalla
   se prueba en web, iOS y Android desde la Fase 1, sin un segundo frontend.

### Qué se pierde y cómo se mitiga

| Pérdida | Mitigación |
|---|---|
| SEO en web | `expo-router` con renderizado estático de las fichas de tienda; si no alcanza, agregar `apps/web` en Next.js reutilizando `packages/core` (ADR-002) |
| WebView vs nativo | Expo usa vistas nativas reales (no WebView) en iOS/Android |
| Librerías que exigen código nativo | Usar *dev client* desde el inicio (no depender de Expo Go) |
| Mapas de Google con costo | Abstraer el proveedor; plan B con MapLibre + tiles OSM |
| Complejidad del monorepo | npm workspaces (Turborepo opcional), configurado una vez en Fase 1 |

## 6. Notificaciones: análisis específico

Cadena técnica: **app → token del dispositivo → backend → Expo Push Service →
APNs (iOS) / FCM (Android) → dispositivo**.

- `expo-notifications` obtiene el token y maneja la recepción en foreground,
  background y taps (deep link al pedido/chat).
- El backend guarda `device_tokens` por usuario y envía por HTTP a
  `https://exp.host/--/api/v2/push/send` (sin SDK, sin costo).
- iOS exige cuenta de Apple Developer (99 USD/año) y configuración de
  credenciales APNs en EAS; Android exige proyecto Firebase y `google-services.json`.
- **Notificaciones locales** para recordatorios (ej. "tu pedido está listo")
  funcionan sin backend.
- **Web push** (service worker) queda para fase 2; no es requisito del MVP.

Por qué se percibe mal en Ionic: el plugin de Capacitor es una capa fina sobre
los SDK nativos, con configuración manual de entitlements, manejo de foreground
inconsistente y dependencia de un backend propio para el envío. Expo encapsula
buena parte de eso y expone una API única, con un servicio de envío ya resuelto.

## 7. Mapas: análisis específico

| Necesidad | Solución MVP | Alternativa / fase 2 |
|---|---|---|
| Pines de tiendas, cluster, ficha | Google Maps (nativo: `react-native-maps`; web: Maps JS) | MapLibre GL + tiles vectoriales OSM (Protomaps/MapTiler) |
| "Tiendas cerca de mí" | PostGIS `ST_DWithin` sobre `geography(Point)` con índice GiST | Igual (independiente del proveedor de mapas) |
| Geocodificar direcciones al registrar sucursal | API de Geocoding de Google (o Nominatim gratis) | Nominatim/Photon self-hosted |
| Ruta y ETA real | Cálculo simple (prep time + tránsito fijo) | Directions API / OSRM |

**Decisión cerrada:** se usa **Google Maps Platform** como proveedor del MVP
(Maps SDK en Android/iOS vía `react-native-maps`, Maps JavaScript API en web y
Geocoding para direcciones). El gasto se monitorea desde el primer día.

**Costo**: Google Maps Platform tiene una capa gratuita mensual por SKU
(verificar montos vigentes). Para un MVP con pocos usuarios no se paga, pero
**hay que medirlo**: el mapa se cobra por carga. Por eso el componente de mapa se
aísla tras `packages/ui/map` con implementaciones por plataforma; cambiar a
MapLibre debe ser un cambio localizado.

## 8. Backend: opciones y decisión

| Opción | Pros | Contras | Veredicto |
|---|---|---|---|
| **Fastify + TS + Drizzle** | Ligero, rapidísimo, tipado, control total, WebSocket fácil, mismo lenguaje | Hay que construir auth/OTP/storage | **Elegido** |
| Supabase (BaaS) | Auth, storage, realtime y PostGIS listos; muy rápido de arrancar | Lógica de negocio en RLS/SQL o edge functions; menos control; lock-in | Acelerador válido, no elegido |
| NestJS | Estructura y DI, bueno en equipos grandes | Más ceremonia y peso para un MVP | Descartado |
| Django/DRF | Admin gratis, maduro | Python + JS; más pesado; WS con Channels | Descartado |
| Go (Fiber/Echo) | Rendimiento y binario único | Menos velocidad de iteración y ecosistema ORM | Descartado |
| Serverless (Lambda) | Escala a cero | WebSocket, cron y conexiones persistentes incómodos | Descartado |

**Decisión**: monolito modular en Fastify. Un solo proceso con módulos por
dominio (`auth`, `businesses`, `catalog`, `orders`, `payments`, `chat`,
`analytics`). Nada de microservicios en fase 1.

Componentes:
- **PostgreSQL 16 + PostGIS** (gestionado: Neon, Supabase o RDS).
- **Redis** solo para rate limiting de OTP, colas (BullMQ) y cache de sesión.
- **S3-compatible** para imágenes (R2/MinIO) con URLs prefirmadas.
- **Zod** para validar entrada y compartir contratos con la app.

## 9. Alternativas y disparadores de cambio

| Si pasa esto… | Entonces… |
|---|---|
| El SEO web se vuelve el canal principal de adquisición | Crear `apps/web` en Next.js reutilizando `packages/core` (ADR-002) |
| El costo de Google Maps se dispara | Migrar a MapLibre + tiles OSM (ADR-003) |
| El equipo es 100% Angular y no hay tiempo de aprender RN | Angular + Capacitor sigue siendo viable; backend y BD no cambian |
| Se necesita cobrar dentro de la app | Integrar pasarela (Wompi/MercadoPago/Stripe) y convertir la app en mercado regulado; revisar PCI y términos |
| Crece la operación de reparto | Servicio de ruteo (OSRM/Google Directions) y app de repartidor |

## 10. Conclusión

**React Native + Expo + Fastify + PostgreSQL/PostGIS + Google Maps** es la
combinación con mejor relación cobertura/velocidad/riesgo para este producto.
Mantiene el lenguaje único (TypeScript), resuelve notificaciones con un servicio
gestionado, permite mapas nativos, deja la web disponible en paralelo desde el
primer día y mantiene abierta la puerta a una web con SEO sin reescribir nada
crítico.
