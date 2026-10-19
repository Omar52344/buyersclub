# 07 — Riesgos, decisiones y preguntas abiertas

## 1. Riesgos

Probabilidad (P) e impacto (I): A = alto, M = medio, B = bajo.

| # | Riesgo | P | I | Mitigación |
|---|---|---|---|---|
| R1 | **Fraude en la evidencia de pago**: el comprador sube una captura falsa y el vendedor valida sin revisar | M | A | Validación humana obligatoria, historial por comprador, límite de pedidos sin pago validado, flujo de disputa, auditoría, futura integración con pasarela |
| R2 | **Teléfono no verificado por SMS** permite cuentas descartables y spam | A | M | Rate limits, verificación de correo obligatoria, reportes, bloqueo manual; activar SMS en fase 2 |
| R3 | **Costo de Google Maps** crece con el uso | M | M | Abstracción del proveedor (ADR-003), monitoreo de llamadas, plan B MapLibre/OSM |
| R4 | **Rechazo en App Store** por chat de usuario (UGC) o por pagos fuera de la app | M | A | Política de contenido, reporte/bloqueo de usuarios, borrado de cuenta, términos claros de que el pago ocurre fuera; revisión temprana vía TestFlight |
| R5 | **Datos sensibles en comprobantes** (nombres, cuentas, montos) | A | A | Bucket privado, URLs firmadas de 5 min, acceso solo a las partes, retención de 12 meses, cifrado en reposo, sin logs |
| R6 | **Responsabilidad legal** como intermediario (productos, entregas, pagos) | M | A | Términos y condiciones, política de privacidad, país de operación definido, revisión legal antes de producción |
| R7 | **Dependencia de un solo desarrollador** | M | A | Documentación (este repo), CI/CD reproducible, código desplegable en todo momento |
| R8 | **Desviación web**: RN Web no se comporta igual en desktop | M | M | Probar web desde F2, presupuesto de responsive, componente de mapa por plataforma |
| R9 | **Escalado del WebSocket** (múltiples instancias) | B | M | En fase 1 una instancia + Redis pub/sub si se escala; reconexión y `GET /sync` |
| R10 | **PostGIS no disponible** en el proveedor de BD | B | A | Verificar soporte antes de contratar (Neon/Supabase lo tienen); plan B: cálculo por bounding box + Haversine |
| R11 | **Zonas horarias y DST** mal calculados en reportes | M | M | Guardar `timezone` por sucursal; agregaciones con `AT TIME ZONE`; tests con fechas de cambio |
| R12 | **Redondeo de dinero** por floats o descuentos | M | M | Enteros + `packages/core/money`; tests de totales |
| R13 | **Alcance creciente** (reseñas, cupones, repartidores) | A | A | Congelar alcance tras F0; backlog de fase 2 |
| R14 | **Push silencioso o no entregado** en iOS | M | M | Probar en dispositivo real temprano, `expo-notifications` + receipts, bandeja in-app como respaldo |
| R15 | **Cumplimiento de protección de datos** (Ley 1581/2012 en Colombia u otra local) | M | A | Registro de tratamiento, consentimiento, política publicada, canal de habeas data |
| R16 | **Imágenes pesadas** en catálogo y chat | M | B | Compresión en cliente, límite 10 MB, variantes y CDN |
| R17 | **Actualizaciones de Expo/RN** rompen dependencias | M | B | Versiones fijas, actualización planificada por trimestre, EAS Update para fixes |
| R18 | **Cuentas de tiendas**: 99 USD/año Apple + 25 USD Google + EAS | A | B | Presupuesto desde F0 |

## 2. Riesgos legales y de cumplimiento (a validar con abogado)

1. **Naturaleza del servicio**: intermediario tecnológico, no vendedor ni
   procesador de pagos. Debe quedar en los términos.
2. **Protección de datos**: consentimiento informado, finalidad, retención,
   derechos del titular (acceso, corrección, eliminación), encargados
   (hosting, correo, mapas).
3. **Facturación**: la app no emite facturas; cada comercio factura por fuera.
   Confirmar si se requiere algo adicional según el país.
4. **Contenido de usuarios**: chat e imágenes requieren política de contenido,
   mecanismo de reporte y baja de cuentas.
5. **Consumidor**: reglas de derecho de retracto, información de precios y
   disponibilidad, y responsabilidad por entregas.
6. **Tiendas de apps**: declaración de privacidad, borrado de cuenta y
   descripción honesta del rol frente a pagos.

## 3. Decisiones tomadas (resumen)

| # | Decisión | Documento |
|---|---|---|
| D-01 | React Native + Expo para iOS, Android y web | `01` |
| D-02 | TypeScript en todo el stack | `01` |
| D-03 | Fastify + PostgreSQL/PostGIS + Drizzle | `01`, `02` |
| D-04 | Autenticación passwordless por OTP; SMS en fase 2 | `02` ADR-006 |
| D-05 | Catálogo compartido con overrides por sucursal | `02` ADR-009 |
| D-06 | Estado abierto/cerrado calculado en servidor | `02` ADR-010 |
| D-07 | Evidencia de pago en bucket privado, validación manual | `02` ADR-008 |
| D-08 | Monolito modular, sin microservicios en fase 1 | `02` ADR-004 |
| D-09 | Sin monetización ni límites en fase 1 | `00` |
| D-10 | Web con la misma base de código; SEO avanzado después | `02` ADR-002 |
| D-11 | Moneda: **COP** por defecto y **USD** opcional por empresa; sin FX en fase 1 | `02` ADR-015 |
| D-12 | **Google Maps Platform** como proveedor de mapas del MVP | `02` ADR-003 |

## 4. Decisiones pendientes

**Decisiones ya cerradas en la revisión:** Colombia como país inicial, COP por
defecto con USD opcional por empresa, Google Maps como proveedor de mapas,
Fastify como backend y web desarrollada en paralelo con la misma base de código.

| # | Decisión | Opciones | Recomendación | Bloquea |
|---|---|---|---|---|
| P1 | **Proveedor de correo** | Resend, SES, Postmark | Resend (simple y barato) | F1 |
| P2 | **Storage** | Cloudflare R2, S3, MinIO | R2 en producción, MinIO local | F2 |
| P3 | **SMS (fase 2)** | Twilio, Infobip, proveedor local | Evaluar costo por país; Twilio como base | F5+ |
| P4 | **Nombre y dominio** | buyersclub.* | Confirmar marca y dominio | F0 |
| P5 | **Zona piloto** | Una ciudad/barrio | Una ciudad, 10–20 comercios | F8 |
| P6 | **Quién modera** | Solo admin | Admin con acceso a SQL/backoffice mínimo | F7 |
| P7 | **Propina y pedidos programados** | Sí/No | Fuera del MVP | F4 |
| P8 | **Política de evidencia** | Retención 6/12/24 meses | 12 meses y borrado de la imagen | F5 |

## 5. Preguntas para el usuario

**Ya resueltas:** país (Colombia), monedas (COP por defecto, USD opcional),
prioridad web (en paralelo, misma base de código), proveedor de mapas (Google) y
backend (Fastify).

1. **¿Quién valida el pago: solo el vendedor o también un administrador** en
   caso de disputa?
2. **¿Los productos deben tener stock** o alcanza con "disponible / no
   disponible" en el MVP?
3. **¿Hay un diseño de marca** (logo, colores, nombre definitivo) o lo definimos
   en F1?
4. **¿Confirmas el enfoque passwordless** (sin contraseñas, todo por código) o
   quieres además correo+contraseña?

## 6. Métricas de éxito del MVP (fase 1)

| Métrica | Objetivo inicial |
|---|---|
| Comercios activos con catálogo | ≥ 15 en la zona piloto |
| Tiempo de registro a primera tienda publicada | < 15 min |
| Compradores registrados | ≥ 300 en 60 días |
| Pedidos por semana | ≥ 50 al final del piloto |
| Pedidos completados / creados | ≥ 85 % |
| Tiempo de validación de pago | < 10 min (mediana) |
| Retención de compradores (2.ª compra en 30 días) | ≥ 25 % |
| Crash-free sessions | ≥ 99.5 % |
| Latencia API p95 | < 300 ms |

## 7. Criterios de salida de la fase de planificación

- [ ] Documentos `00`–`07` revisados y aprobados.
- [x] Decisiones de país/moneda, web, mapas y backend resueltas.
- [ ] Cuentas creadas: Apple Developer, Google Play, Firebase, Expo/EAS,
      dominio, correo transaccional, storage.
- [ ] Presupuesto mensual estimado aceptado (hosting, correo, mapas, tiendas).
- [ ] Alcance congelado y backlog de fase 2 separado.
- [ ] Fecha objetivo del MVP acordada según el escenario de equipo.
