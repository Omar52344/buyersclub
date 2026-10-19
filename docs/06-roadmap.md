# 06 — Roadmap y estimación

> **Estado de implementación:** F1 ✅, F2 ✅, F3 ✅ y F4 ✅ (autenticación,
> empresa, sucursales, catálogo, descubrimiento PostGIS, mapa, carrito, pedidos y
> tracker). F5 siguiente.

## 1. Supuestos de estimación

- Equipo base: **1 desarrollador full-stack** con apoyo de IA (esta sesión) y
  dedicación completa.
- Semana laboral de 5 días; las estimaciones incluyen pruebas y documentación,
  **no** incluyen diseño visual de alta fidelidad ni contenido (fotos, textos).
- Buffer del 20 % ya incorporado en los rangos.
- El camino crítico es: identidad → negocio/sucursales → catálogo → mapa →
  pedidos → pagos/chat → dashboards → release.

## 2. Escenarios de equipo

| Equipo | Duración del MVP | Comentario |
|---|---|---|
| 1 dev full-stack | **14–17 semanas** | Secuencial, con foco |
| 2 devs (app + API) | **8–10 semanas** | Paraleliza UI y backend desde F1 |
| 2 devs + diseñador | **7–9 semanas** | Diseño en paralelo, menos retrabajo visual |
| 3 devs + QA | **6–7 semanas** | Requiere más coordinación; útil para llegar a tiendas |

## 3. Fases

### F0 — Planificación y decisiones · 1 semana
**Entregables**
- Este paquete de documentos aprobado.
- Cuenta de Apple Developer, proyecto Firebase, dominio y repositorio remoto.
- Decisiones cerradas (país, mapas, prioridad web, proveedor de correo).

**Criterio de salida**: decisiones pendientes resueltas y alcance congelado.

---

### F1 — Fundaciones · 2–3 semanas
**Entregables**
- Monorepo (npm workspaces), `packages/core`, `packages/ui`, `packages/config`.
- `docker-compose` con Postgres+PostGIS, Redis, storage S3 (Moto) y Mailpit.
- Esquema base con Drizzle + migraciones + seeds.
- API Fastify con plugins (db, errores, auth, rate limit, logs) y `/health`.
- Auth completa: signup, OTP correo, OTP teléfono (sin SMS), login, refresh,
  logout, `GET /me`.
- App Expo con expo-router, tema, navegación por rol y pantallas de auth.
- CI (typecheck, lint, tests) y deploy de staging de la API.

**Criterio de salida**: un usuario puede registrarse, verificar correo y
teléfono, iniciar sesión y llegar a un home vacío en iOS, Android y web.

---

### F2 — Vendedor: negocio, sucursales y catálogo · 3 semanas
**Entregables**
- Onboarding de empresa y sucursales con mapa y geocodificación.
- Selección de moneda al crear la empresa (**COP** por defecto, **USD**
  opcional) y bloqueo cuando ya hay pedidos.
- Horarios, excepciones, interruptor de apertura, configuración de entrega.
- CRUD de productos con imagen y categorías.
- Catálogo compartido y overrides por sucursal.
- Subida de archivos con URLs prefirmadas y compresión en cliente.
- Panel del vendedor (lista de sucursales con estado y pedidos activos).

**Criterio de salida**: un vendedor crea su negocio, 2 sucursales con horarios y
un catálogo de 10 productos compartidos, con precios distintos en una sede.

---

### F3 — Descubrimiento y mapa · 2 semanas
**Entregables**
- Endpoint PostGIS de sucursales cercanas con filtros y límite.
- Pantalla de mapa (nativo y web) con pines, clustering básico y ficha.
- Ficha de tienda con catálogo, horario y estado.
- Filtros y búsqueda.
- Página web de tienda con URL compartible.

**Criterio de salida**: un comprador abre el mapa, ve las tiendas de su zona,
filtra por "abierto ahora" y entra al catálogo de una.

---

### F4 — Pedido y tracker · 3 semanas
**Entregables**
- Carrito con persistencia y revalidación.
- Checkout: entrega/recogida, dirección, medio de pago, totales en servidor.
- Creación de pedido idempotente y máquina de estados.
- Lista y detalle de pedidos del comprador con timeline y ETA.
- Lista de pedidos por sucursal y cambio de estado para el vendedor.
- Cancelación y rechazo con motivos.

**Criterio de salida**: pedido de punta a punta (crear → aceptar → preparar →
listo → entregado) visible en ambos lados, con historial de eventos.

---

### F5 — Chat, evidencia y validación de pago · 2–3 semanas
**Entregables**
- Conversaciones por pedido, mensajes de texto e imágenes.
- WebSocket + `GET /sync` para recuperación.
- Subida de evidencia a bucket privado.
- Validación/rechazo por el vendedor con auditoría.
- Notificaciones push de los eventos de pago y chat.

**Criterio de salida**: comprador sube comprobante, vendedor lo ve y valida; el
comprador recibe push y el pedido avanza; un rechazo permite reenviar.

---

### F6 — Dashboards · 2 semanas
**Entregables**
- Endpoints de analítica con filtros de fecha y zona horaria.
- Dashboard vendedor: KPIs, comparación, por sucursal, serie temporal, top
  productos, embudo.
- Dashboard comprador: gasto, pedidos, ticket, serie, comercios frecuentes.
- Agrupación por moneda (COP/USD) en el dashboard del comprador y montos en la
  moneda de la empresa en el del vendedor.
- Exportación CSV del vendedor (S).

**Criterio de salida**: los números del dashboard cuadran con los pedidos del
periodo, incluyendo sucursales y estados.

---

### F7 — Notificaciones, pulido y calidad · 2 semanas
**Entregables**
- Push en iOS y Android con deep links, permiso contextual y limpieza de tokens.
- Accesibilidad, estados vacíos, errores de red, skeletons.
- Pruebas E2E de los flujos críticos (auth, pedido, pago, chat).
- Revisión de seguridad (OWASP), rate limits, headers.
- Términos, privacidad, política de pagos y borrado de cuenta.
- Instrumentación (Sentry, métricas) y alertas.

**Criterio de salida**: suite E2E verde, sin bugs bloqueantes, métricas visibles.

---

### F8 — Beta cerrada y release · 2 semanas (parcialmente en paralelo)
**Entregables**
- Builds de producción en TestFlight y Play Internal.
- 10–20 comercios reales y 30–50 compradores en una zona piloto.
- Corrección de hallazgos de la beta.
- Envío a revisión de App Store y Google Play (1–5 días hábiles cada uno).
- Landing pública y material de onboarding para vendedores.

**Criterio de salida**: app aprobada en ambas tiendas y web pública; primeras
ventas reales registradas.

## 4. Calendario sugerido (1 dev)

| Semana | Fase | Hito demostrable |
|---|---|---|
| 1 | F0 | Documentos aprobados, cuentas creadas |
| 2–4 | F1 | Registro/login en 3 plataformas |
| 5–7 | F2 | Negocio + sucursales + catálogo |
| 8–9 | F3 | Mapa con tiendas y catálogo |
| 10–12 | F4 | Pedido completo con tracker |
| 13–14 | F5 | Chat + evidencia + validación |
| 15–16 | F6 | Dashboards |
| 17 | F7 | Notificaciones + QA |
| 18–19 | F8 | Beta y envío a tiendas |

> El calendario es una guía; los rangos de la sección 2 son la referencia
> comprometible.

## 5. Qué se puede paralelizar

- Diseño de UI (design system) mientras se construye F1.
- Endpoints de analítica mientras se pule el mapa (misma base de datos).
- Contenido/onboarding de comercios desde F3, sin esperar el release.
- Web y móvil: el mismo código, pero conviene probar web desde F2 para no
  acumular deuda responsive.

## 6. Riesgos que afectan el cronograma

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Revisión de App Store (pagos fuera de la app, UGC) | +1–2 semanas | Política clara, borrado de cuenta, reporte de contenido, revisión temprana en TestFlight |
| Credenciales APNs/FCM mal configuradas | +3–5 días | Configurar en F1, no en F7 |
| Costos/ límites de Google Maps | variable | Abstracción del proveedor + medición |
| Cambios de alcance | alto | Congelar alcance tras F0; nuevas ideas a backlog de fase 2 |
| Un solo dev enfermo/vacaciones | alto | Documentar y mantener el repo siempre desplegable |

## 7. Definición de "terminado" (DoD)

Una historia está terminada cuando:

- [ ] Cumple sus criterios de aceptación.
- [ ] Tiene tipos y validación en `packages/core`.
- [ ] Funciona en iOS, Android y web (o tiene excepción documentada).
- [ ] Tiene pruebas (unidad para reglas, integración para endpoints críticos).
- [ ] Pasa CI (typecheck, lint, tests).
- [ ] Está desplegada en staging y probada con datos reales.
- [ ] Actualiza la documentación si cambió el contrato o el modelo.

## 8. Después del MVP (fase 2/3, no comprometido)

1. SMS real + WhatsApp para verificación y notificaciones.
2. Reseñas, favoritos, cupones y programas de lealtad.
3. Cobro dentro de la app (pasarela) y liquidaciones.
4. Repartidores, ruteo real y tracking GPS.
5. `apps/web` con Next.js y SEO completo.
6. Planes para vendedores, comisiones y publicidad.
7. Multi-sucursal avanzado, inventario y variantes.
8. Analítica avanzada y recomendaciones.
