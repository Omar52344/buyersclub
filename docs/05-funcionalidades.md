# 05 — Funcionalidades e historias de usuario

Prioridades: **M** = Must (MVP), **S** = Should, **C** = Could (fase 2).
Puntos: estimación relativa (1, 2, 3, 5, 8) para un desarrollador con la
arquitectura propuesta.

| Épica | Prioridad | Puntos |
|---|---|---|
| E1. Cuenta y verificación | M | 13 |
| E2. Onboarding de vendedor y sucursales | M | 18 |
| E3. Catálogo y precios por sucursal | M | 16 |
| E4. Descubrimiento en mapa | M | 16 |
| E5. Pedido del comprador | M | 21 |
| E6. Gestión de pedidos (vendedor) | M | 13 |
| E7. Evidencia y validación de pago | M | 13 |
| E8. Chat comprador ↔ vendedor | M | 13 |
| E9. Notificaciones | M | 8 |
| E10. Dashboards e indicadores | M | 16 |
| E11. Administración mínima | S | 5 |
| E12. Web responsive | M | 8 |
| E13. Reseñas, favoritos, cupones | C | — |
| **Total MVP** | | **160 pts** |

---

## E1 — Cuenta y verificación

### HU-01 · Elegir modo de entrada (M, 2)
Como visitante quiero indicar si entro como cliente o como vendedor para que la
app me lleve al flujo correcto.

- [ ] Pantalla inicial con dos acciones claras: "Quiero comprar" y "Quiero vender".
- [ ] La elección se guarda localmente y se puede cambiar después desde el perfil.
- [ ] Si ya hay sesión, se salta al home correspondiente.
- [ ] Un vendedor también puede comprar (la cuenta es única).

### HU-02 · Registro con correo y teléfono (M, 5)
Como visitante quiero registrarme con mi correo y mi celular para tener una
cuenta verificada.

- [ ] Formulario con correo y teléfono ( selector de país, validación E.164).
- [ ] Contraseña de al menos 8 caracteres con una letra y un número; se guarda
      hasheada con scrypt (nunca en claro).
- [ ] Errores claros si el correo o el teléfono ya existen (`EMAIL_TAKEN`, `PHONE_TAKEN`).
- [ ] Al enviar, se crea la cuenta pendiente y se envía un código de 6 dígitos al correo.
- [ ] El código expira a los 10 minutos y se puede reenviar (máx. 3 veces / 15 min).
- [ ] No se puede continuar sin verificar el correo.

### HU-03 · Verificación por correo (M, 3)
Como visitante quiero ingresar el código que llegó a mi correo para confirmar que
es mío.

- [ ] Input de 6 dígitos con autocompletado desde el SMS/correo cuando el SO lo permita.
- [ ] Código incorrecto muestra error sin borrar lo escrito; a los 5 intentos se invalida.
- [ ] Al validar, el correo queda `email_verified_at` y se pasa al paso del teléfono.
- [ ] Botón "reenviar código" con temporizador visible.

### HU-04 · Verificación de teléfono (M, 3)
Como visitante quiero verificar mi celular para que la app sepa que es mío.

- [ ] Se genera y valida un código de 6 dígitos para el teléfono.
- [ ] En fase 1 se muestra un aviso: "Aún no enviamos SMS; tu número quedará
      pendiente de verificación por mensaje".
- [ ] El perfil muestra `phoneVerificationMethod: "otp_dev"` y el estado "SMS pendiente"; la verificación real por SMS se activa en fase 2.
- [ ] La cuenta queda activa y se emiten tokens al validar.
- [ ] El canal SMS queda modelado para conectarse sin migración (ADR-006).

### HU-05 · Iniciar sesión (M, 3)
Como usuario registrado quiero entrar con mi correo o teléfono y mi contraseña.

- [ ] Un solo campo que acepta correo o teléfono, más la contraseña.
- [ ] Alternativa "entrar con un código por correo".
- [ ] Recuperación de contraseña por código enviado al correo.
- [ ] Si el usuario no existe, se ofrece registrarse.
- [ ] Código único, TTL 10 min, máx. 5 intentos.
- [ ] Sesión persistente entre reinicios; refresh automático.
- [ ] Cerrar sesión revoca solo el dispositivo actual.

### HU-06 · Gestionar perfil (S, 2)
Como usuario quiero editar mi nombre, foto y datos de contacto.

- [ ] Editar nombre y avatar (cámara o galería).
- [ ] Cambiar teléfono exige nueva verificación.
- [ ] Eliminar cuenta disponible en la app (requisito de App Store), con
      confirmación y anonimización.

---

## E2 — Onboarding de vendedor y sucursales

### HU-07 · Crear empresa (M, 3)
Como vendedor quiero registrar el nombre de mi empresa para empezar a vender.

- [ ] Nombre obligatorio; slug autogenerado y editable (único).
- [ ] Selector de moneda **COP / USD** con **COP** por defecto, elegido al crear
      la empresa; queda bloqueado cuando ya hay pedidos.
- [ ] Categoría principal obligatoria (panadería, restaurante, droguería…).
- [ ] Logo opcional (subida con compresión).
- [ ] Al crear, el usuario obtiene el rol `vendor_owner`.

### HU-08 · Crear sucursal con dirección (M, 5)
Como vendedor quiero registrar mis sucursales con dirección exacta para
aparecer en el mapa.

- [ ] Nombre, teléfono, dirección y ciudad.
- [ ] Selección de punto en el mapa + geocodificación de la dirección escrita.
- [ ] Validación de que el pin está dentro del país.
- [ ] La sucursal nace cerrada (`manual_open = false`) y con envío/recogida activos.
- [ ] Se puede crear más de una sucursal.

### HU-09 · Configurar horarios (M, 3)
Como vendedor quiero definir mis horarios de atención para que el mapa muestre
cuándo estoy abierto.

- [ ] Horario por día, con varias franjas (ej. 8–12 y 14–18).
- [ ] Marcar días cerrados.
- [ ] Excepciones por fecha (festivos) con nota.
- [ ] Zona horaria de la sucursal (por defecto la del dispositivo).
- [ ] Vista previa: "Hoy: 8:00–18:00 · Abierto".

### HU-10 · Activar/desactivar sucursal (M, 3)
Como vendedor quiero un interruptor para abrir o cerrar mi tienda en el momento,
sin importar el horario configurado.

- [ ] Toggle visible en el panel de la sucursal y en la ficha pública.
- [ ] Si está cerrada, los compradores ven "Cerrado" y no pueden pedir.
- [ ] El estado manual tiene prioridad sobre el horario (ADR-010).
- [ ] Si hay pedidos activos, se advierte antes de cerrar (R9).
- [ ] Cada cambio queda en `audit_log`.

### HU-11 · Configurar entrega (M, 2)
Como vendedor quiero definir si ofrezco domicilio, recogida, costo de envío y
pedido mínimo.

- [ ] Interruptores independientes para domicilio y recogida.
- [ ] Costo de envío y monto mínimo en la moneda de la empresa.
- [ ] Tiempo de preparación y ETA de tránsito en minutos.
- [ ] Si desactiva ambos medios, no puede activar la sucursal.

### HU-12 · Invitar operador de sucursal (C, 5)
Como dueño quiero que un empleado gestione los pedidos de una sucursal sin ver
las demás. *(Fase 2; el modelo ya lo soporta con `business_members`.)*

---

## E3 — Catálogo

### HU-13 · Crear producto (M, 3)
Como vendedor quiero registrar productos con nombre, precio, categoría y foto.

- [ ] Nombre, precio (> 0), categoría y foto opcional.
- [ ] Descripción libre.
- [ ] Se puede marcar "disponible en todas las sucursales" (por defecto sí).
- [ ] Validación de moneda y precio entero en centavos.

### HU-14 · Producto compartido entre sucursales (M, 3)
Como vendedor quiero usar el mismo producto en todas mis sucursales sin
duplicarlo.

- [ ] Al crear con "todas las sucursales", se generan las filas de
      `branch_products` para cada sucursal activa.
- [ ] Una sucursal nueva recibe automáticamente los productos compartidos.
- [ ] Editar nombre/foto del producto se refleja en todas.

### HU-15 · Precio y disponibilidad por sucursal (M, 5)
Como vendedor quiero ajustar precio, stock y disponibilidad de un producto en
una sucursal específica.

- [ ] Override de precio (si se deja vacío, hereda el base).
- [ ] Stock opcional (vacío = sin control).
- [ ] Interruptor "no disponible en esta sucursal".
- [ ] Los cambios de precio quedan auditados.
- [ ] El comprador nunca ve productos no disponibles.

### HU-16 · Gestionar catálogo (S, 3)
Como vendedor quiero listar, buscar, editar y desactivar productos.

- [ ] Lista con búsqueda por texto y filtro por categoría.
- [ ] Desactivar un producto lo oculta del mapa y del carrito, sin borrar historial.
- [ ] Edición masiva de disponibilidad por sucursal.

### HU-17 · Categorías (S, 2)
Como vendedor quiero clasificar mis productos para que los compradores filtren.

- [ ] Árbol de categorías globales (2 niveles).
- [ ] El vendedor elige categoría por producto.

---

## E4 — Descubrimiento en mapa

### HU-18 · Ver tiendas cercanas (M, 5)
Como comprador quiero ver en un mapa las tiendas cerca de mí para decidir dónde
comprar.

- [ ] Mapa centrado en la ubicación del usuario (con permiso) o en una ciudad por defecto.
- [ ] Pines con logo/color por categoría; tap muestra nombre, distancia y estado.
- [ ] Radio ajustable (1, 3, 5, 10 km).
- [ ] Consulta al servidor al mover el mapa (debounce ≥ 300 ms) y límite de 200 resultados.
- [ ] Funciona sin permiso de ubicación (búsqueda por ciudad/dirección).

### HU-19 · Ver estado abierto/cerrado (M, 3)
Como comprador quiero saber si una tienda está abierta antes de pedir.

- [ ] Badge "Abierto"/"Cerrado" visible en el pin/lista y en la ficha.
- [ ] Si está cerrada, se muestra cuándo abre (`nextChangeAt`).
- [ ] El estado se recalcula al abrir la app y al refrescar; no se cachea más de 60 s.
- [ ] El botón "Pedir" se deshabilita cuando está cerrada.

### HU-20 · Ver catálogo de una tienda (M, 3)
Como comprador quiero ver los productos de una tienda y sus precios.

- [ ] Ficha con logo, nombre, categorías, dirección, horario, estado y medios de entrega.
- [ ] Lista de productos con foto, precio, disponibilidad y búsqueda.
- [ ] Muestra costo de envío y pedido mínimo.
- [ ] Botón "Pedir" y acceso al chat (si hay pedido previo).

### HU-21 · Filtrar y buscar (S, 3)
Como comprador quiero filtrar por categoría, abierto ahora y tipo de entrega.

- [ ] Filtros combinables: categoría, `openNow`, domicilio/recogida.
- [ ] Búsqueda de texto por tienda y producto.
- [ ] Resultados ordenados por distancia.
- [ ] Estado vacío con sugerencia de ampliar el radio.

---

## E5 — Pedido del comprador

### HU-22 · Carrito (M, 5)
Como comprador quiero agregar productos de una tienda a un carrito.

- [ ] Solo productos de una sucursal a la vez (si cambia de tienda, se advierte y se reinicia).
- [ ] Cantidades, notas por ítem y eliminación.
- [ ] Totales recalculados en vivo (subtotal + envío).
- [ ] Persistencia local del carrito entre sesiones.
- [ ] Revalidación de precios y disponibilidad al abrir el checkout.

### HU-23 · Elegir entrega o recogida (M, 3)
Como comprador quiero decidir si quiero domicilio o recoger en tienda.

- [ ] Opciones solo si la sucursal las ofrece.
- [ ] Domicilio: elegir dirección guardada o crear una nueva con mapa.
- [ ] Recogida: muestra dirección y horario de la tienda.
- [ ] Costo de envío y pedido mínimo visibles; si no se cumple, se bloquea.

### HU-24 · Confirmar pedido (M, 5)
Como comprador quiero confirmar mi pedido y ver su estado.

- [ ] Resumen final con ítems, total, medio de pago y ETA estimada.
- [ ] Elección de medio de pago: efectivo, transferencia u otro (definidos por el vendedor).
- [ ] `POST /orders` idempotente; errores de precio muestran el carrito actualizado.
- [ ] Redirige al detalle del pedido con tracker y acciones siguientes.
- [ ] Se crea la conversación de chat automáticamente.

### HU-25 · Seguir el pedido (M, 5)
Como comprador quiero ver en qué estado va mi pedido y cuándo llega.

- [ ] Timeline: recibido → pago → aceptado → preparando → listo/en camino → entregado.
- [ ] ETA visible y actualizada cuando el vendedor cambia el estado.
- [ ] Notificación push en cada cambio relevante.
- [ ] Botón de chat y de cancelar (según estado).
- [ ] Si el vendedor rechaza, se explica el motivo y se ofrece reintentar.

### HU-26 · Mis pedidos (M, 3)
Como comprador quiero ver el historial de mis pedidos y su estado.

- [ ] Lista con filtros por estado y fecha.
- [ ] Agrupación por activos / históricos.
- [ ] Acceso al detalle, chat y comprobantes.

### HU-27 · Calificar (C, 3) — fase 2
Reseñas por pedido completado, con moderación.

---

## E6 — Gestión de pedidos (vendedor)

### HU-28 · Ver pedidos por sucursal (M, 5)
Como vendedor quiero ver los pedidos de cada sucursal para operarlos.

- [ ] Selector de sucursal y contador de pedidos nuevos.
- [ ] Lista con estado, hora, total, tipo de entrega y cliente.
- [ ] Filtros por estado, fecha y sucursal.
- [ ] Orden por antigüedad; los nuevos se resaltan.
- [ ] Sonido/vibración y push al entrar un pedido nuevo.

### HU-29 · Cambiar estado del pedido (M, 5)
Como vendedor quiero avanzar el estado del pedido para informar al comprador.

- [ ] Botones de acción contextuales (aceptar, preparar, listo, en camino, entregado).
- [ ] Transiciones inválidas deshabilitadas (tabla de `04`).
- [ ] No se puede aceptar un pedido sin pago validado si el método lo exige.
- [ ] Cada cambio genera evento de historial, notificación y push.
- [ ] Confirmación al rechazar, con motivo obligatorio.

### HU-30 · Ver detalle del pedido (M, 3)
Como vendedor quiero ver ítems, notas, dirección y cliente de un pedido.

- [ ] Ítems con cantidades, notas y totales.
- [ ] Dirección con enlace a mapa (si es domicilio).
- [ ] Datos de contacto del comprador y acceso al chat.
- [ ] Evidencia de pago visible si existe.

---

## E7 — Evidencia y validación de pago

### HU-31 · Subir evidencia de pago (M, 5)
Como comprador quiero subir una foto o captura de mi pago para que el vendedor
lo valide.

- [ ] Cámara o galería, con compresión antes de subir.
- [ ] Muestra el medio de pago y el monto esperado.
- [ ] Vista previa y opción de reemplazar antes de enviar.
- [ ] La imagen va a bucket privado; solo comprador y vendedor la ven.
- [ ] El pedido pasa a `payment_status = evidence_submitted`.
- [ ] Se notifica al vendedor.

### HU-32 · Validar pago (M, 5)
Como vendedor quiero marcar un pago como validado o rechazarlo con motivo.

- [ ] Ver la imagen en grande y los datos del pedido.
- [ ] "Validar" deja el pago en `validated`, el pedido puede avanzar y se notifica al comprador.
- [ ] "Rechazar" exige motivo; el pedido vuelve a `awaiting_payment` y se notifica.
- [ ] Un pago validado no se puede volver a validar (`409`).
- [ ] Toda validación queda en `audit_log` con usuario y hora.

### HU-33 · Ver estado del pago (M, 3)
Como comprador quiero saber si mi pago fue validado o rechazado.

- [ ] Badge en el pedido: pendiente / en revisión / validado / rechazado.
- [ ] Si es rechazado, se muestra el motivo y se permite subir nueva evidencia.
- [ ] Push en cada cambio.

---

## E8 — Chat comprador ↔ vendedor

### HU-34 · Chatear sobre un pedido (M, 5)
Como comprador y vendedor queremos conversar sobre un pedido dentro de la app.

- [ ] La conversación se crea con el pedido y agrupa a comprador y vendedor.
- [ ] Mensajes de texto con hora y remitente.
- [ ] Historial paginado; los mensajes propios se ven a la derecha.
- [ ] Contador de no leídos por conversación.
- [ ] WebSocket en vivo; al reconectar se sincroniza sin perder mensajes.
- [ ] Push al receptor si no está en la conversación.

### HU-35 · Enviar imágenes en el chat (M, 3)
Como usuario quiero enviar una foto (comprobante, producto) en el chat.

- [ ] Cámara/galería con compresión.
- [ ] Miniaturas en la lista y visor a pantalla completa.
- [ ] Límite de 10 MB y tipos permitidos.
- [ ] Bucket privado y URLs firmadas.

### HU-36 · Bandeja de conversaciones (S, 3)
Como usuario quiero ver todas mis conversaciones ordenadas por actividad.

- [ ] Lista con tienda/cliente, último mensaje, hora y no leídos.
- [ ] Filtro por pedido activo.
- [ ] Estado vacío informativo.

---

## E9 — Notificaciones

### HU-37 · Recibir notificaciones push (M, 5)
Como usuario quiero recibir avisos de pedidos, pagos y mensajes.

- [ ] Registro del token al iniciar sesión y al renovarlo.
- [ ] Permiso solicitado en el momento adecuado (no al abrir la app por primera vez).
- [ ] Push para: pedido nuevo (vendedor), cambio de estado (comprador), evidencia
      recibida (vendedor), pago validado/rechazado (comprador), mensaje nuevo.
- [ ] El tap abre la pantalla correspondiente (deep link).
- [ ] Si el usuario no dio permiso, la bandeja in-app sigue funcionando.
- [ ] Tokens inválidos se eliminan automáticamente.

### HU-38 · Bandeja de notificaciones (S, 2)
Como usuario quiero ver mis notificaciones dentro de la app.

- [ ] Lista con leídas/no leídas y acción "marcar todas".
- [ ] Persistencia en `notifications`.

---

## E10 — Dashboards e indicadores

### HU-39 · Dashboard del vendedor (M, 8)
Como vendedor quiero ver el consolidado de ventas para tomar decisiones.

- [ ] Filtros de fecha (hoy, 7 días, 30 días, mes actual, rango personalizado).
- [ ] KPIs: ventas, pedidos completados, ticket promedio, cancelados.
- [ ] Comparación con el periodo anterior en porcentaje.
- [ ] Desglose por sucursal (tabla + gráfico).
- [ ] Serie temporal de ventas y pedidos.
- [ ] Top productos del periodo.
- [ ] Embudo por estado.
- [ ] Todos los montos en la moneda de la empresa (COP o USD), sin conversión.
- [ ] Solo incluye pedidos `completed` en ventas; cancelados/rechazados aparte.
- [ ] Exportar CSV (S).

### HU-40 · Dashboard del comprador (M, 5)
Como comprador quiero ver cuánto he comprado y en qué comercios.

- [ ] Filtros de fecha.
- [ ] Gasto total, número de pedidos, ticket promedio.
- [ ] Serie temporal de compras.
- [ ] Comercios frecuentes y categorías más compradas.
- [ ] Gastos separados por moneda (COP/USD) cuando aplique; sin conversión.
- [ ] Pedidos activos destacados.

### HU-41 · Vista por sucursal (M, 3)
Como vendedor quiero comparar el desempeño de mis sucursales.

- [ ] Tabla comparativa con ventas, pedidos y ticket promedio.
- [ ] Indicador de la mejor sucursal.
- [ ] Acceso al detalle de pedidos filtrado por sucursal.

---

## E11 — Administración mínima

### HU-42 · Moderar comercios (S, 5)
Como administrador quiero suspender un comercio que incumple las reglas.

- [ ] Cambiar `businesses.status` a `suspended` (desaparece del mapa).
- [ ] No puede operar pedidos nuevos mientras esté suspendido.
- [ ] Registro en `audit_log`.
- [ ] Acceso restringido por rol `admin`.

---

## E12 — Web responsive

### HU-43 · Usar la app en el navegador (M, 8)
Como usuario quiero usar BuyersClub desde el navegador con la misma cuenta.

- [ ] Mapa, catálogo, pedido, chat y dashboards funcionan en desktop y móvil web.
- [ ] Layout adaptable (mapa + panel lateral en desktop).
- [ ] Login con OTP y sesión persistente.
- [ ] Fichas de tienda con URL propia (`/tienda/:slug`) y metadatos para compartir.
- [ ] Sin funcionalidades rotas por APIs exclusivas de nativo.

---

## 13. Requisitos no funcionales (resumen)

| Categoría | Objetivo |
|---|---|
| Rendimiento | TTFB API < 300 ms p95; mapa con 200 pines < 1 s; arranque en frío < 3 s |
| Disponibilidad | 99.5 % en fase 1; sin ventanas de mantenimiento planificadas |
| Seguridad | OWASP Top 10 cubierto; OTP y pagos con rate limit y auditoría |
| Accesibilidad | Contraste AA, soporte de lector de pantalla en flujos críticos, targets ≥ 44 px |
| i18n | Español inicial; textos centralizados, fechas y moneda por locale |
| Offline | Lectura de últimos pedidos y conversaciones en caché; escritura requiere red |
| Privacidad | Datos mínimos, URLs firmadas, borrado de cuenta, política publicada |
