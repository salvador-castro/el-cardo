# Proyecto: Sistema de gestión para un club de polo

> Especificación original del cliente (versión con rol único `admin`). Los cambios acordados después están en `docs/CONTINUAR.md` y tienen prioridad sobre este documento.

Vas a construir un sistema web **de uso interno** para administrar un club de polo. Primero es una **demo funcional** para mostrarle al club. Todo en español (UI, textos, mensajes de error). El código y los nombres de tablas/columnas van en español sin tildes (`jugadores`, `actividades`, `cobros`).

Antes de escribir código, leé todo este documento y proponeme un plan por etapas. Después trabajá **una etapa por vez** y frená al terminar cada una para que la revise.

---

## Stack

- Next.js (App Router, última versión estable) + TypeScript estricto
- Tailwind CSS + shadcn/ui
- Supabase: Postgres, Auth (email + contraseña), Storage. Usar `@supabase/ssr`.
- Formularios: react-hook-form + zod
- Tablas: TanStack Table
- Mercado Pago: SDK oficial `mercadopago` (Checkout Pro)
- Exportaciones: `@react-pdf/renderer` (PDF), `exceljs` (Excel), `next/og` (imagen para WhatsApp/Instagram)
- QR: `qrcode`
- Deploy en Vercel; Vercel Cron para tareas programadas

Migraciones SQL en `supabase/migrations/`. Tipos generados con `supabase gen types`. Incluí un `.env.example`.

---

## Alcance y acceso

- Solo usan el sistema los administradores del club. **Un único rol: `admin`**, con acceso total. No hay sistema de roles ni permisos: tabla `perfiles` ligada a `auth.users` (nombre, email) solo para saber quién hizo cada cambio.
- Los jugadores **no** tienen acceso.
- Rutas públicas (sin login), y ninguna otra:
  - `/login`
  - `/pagar/[token]` (página de pago)
  - `/api/webhooks/mercadopago`
  - `/api/cron/*` (protegidas con `CRON_SECRET`)
- Todo lo demás está protegido por middleware.
- **RLS activado en todas las tablas.** Cualquier usuario autenticado con perfil (todos son admin) puede leer y escribir; los anónimos no acceden a nada. La página pública de pago lee con una función del servidor (service role) que devuelve solo concepto, monto, nombre del jugador y estado.
- Interfaz responsive: el admin la va a usar mucho desde el celular.

Fuera de alcance: portal de jugadores, reserva de canchas, pago a profesores, gestión de caballos, facturación electrónica.

---

## Módulo 1: Jugadores

**Ficha**
- Personales: nombre, apellido, DNI (único, **opcional**), fecha de nacimiento, foto, teléfono, email, dirección.
- Club: tipo (`socio`, `no_socio`, `alumno`, `externo`), activo (bool), fecha de alta, club de origen, `es_profesor` (bool), notas.
- Polo: hándicap actual, mano (`diestro`/`zurdo`).
- Emergencia: contacto (nombre, vínculo, teléfono), grupo sanguíneo, obra social, número de afiliado.
- Documentos (tabla aparte): tipo (`apto_medico`, `seguro`, `deslinde`, `otro`), archivo en Storage (bucket privado), fecha de vencimiento.
- Historial de hándicap (tabla aparte): se inserta un registro automáticamente cada vez que cambia el hándicap (trigger).
- Auditoría: `updated_at` y `updated_by`.

**Vistas**
1. Listado: búsqueda por nombre/DNI; filtros por tipo, estado, hándicap, profesores, con deuda, apto vencido.
2. Alta completa.
3. Alta rápida (modal reutilizable): nombre, apellido, hándicap, club de origen; tipo `externo` por defecto.
4. Ficha con pestañas:
   - Datos
   - Actividades: como jugador (clases, prácticas, torneos) y como profesor (clases dictadas)
   - Cuenta corriente: cobros pagados y pendientes, con botón "Cobrar todo lo pendiente"
   - Documentos
5. Editar (el mismo formulario del alta).

**Reglas**
- No se borra nunca: se marca inactivo.
- Los inactivos no aparecen en los selectores de actividades.
- Badge de aviso si un documento está vencido o vence en menos de 30 días.

---

## Módulo 2: Actividades (prácticas, clases, torneos)

Una tabla `actividades` con `tipo` (`practica`, `clase`, `torneo`): nombre, fecha y hora (en torneos, inicio y fin), precio por jugador, estado (`programada`, `finalizada`, `cancelada`), notas, `profesor_id` (solo clases).

Los **equipos se crean dentro de cada actividad** y quedan guardados como registro. Cambian de una actividad a otra.

- `equipos`: actividad, nombre, categoría (nullable, solo torneos).
- `equipo_jugadores`. *(Acordado: se eliminó; la pertenencia a equipo vive en `participaciones.equipo_id`.)*
- `participaciones`: actividad + jugador (+ equipo si tiene). Campos: asistencia (`presente`/`ausente`/null) y bonificado. **Es la tabla del historial**, y de acá sale lo que muestra la ficha del jugador.

**Vistas**
1. Listado en lista y calendario, con filtros por tipo, fecha y estado. Cada fila muestra participantes y cuánto se cobró de lo esperado.
2. Nueva actividad: se elige el tipo. El precio se precompleta con el precio sugerido del tipo (tabla `configuracion`). En una clase, profesor (solo jugadores con `es_profesor`) y alumnos.
3. Detalle con pestañas: Equipos/Participantes, Asistencia, Cobros.
4. Armar equipo (modal):
   - Nombre y buscador de jugadores.
   - Hándicap total en vivo.
   - Botón de alta rápida.
   - "Duplicar equipo de una actividad anterior".
5. Agregar varios: textarea donde se pega una lista de nombres copiada de WhatsApp. Se buscan coincidencias aproximadas (usar `pg_trgm`) y se confirman antes de agregar.
6. Editar y cancelar.

**Reglas**
- Un jugador no puede estar en dos equipos de la misma actividad (constraint).
- Al agregar un jugador a una actividad con precio > 0 se crea su cobro automáticamente (Módulo 4).
- Al cancelar la actividad se anulan sus cobros pendientes.
- Aviso si el jugador tiene el apto vencido (aviso, no bloqueo).

---

## Módulo 3: Torneos

Un torneo es una actividad de tipo `torneo`, más:

- `torneo_categorias`: nombre, tope de hándicap (nullable).
- `torneo_zonas`: pertenece a una categoría.
- Asignación de equipos a una zona.
- `partidos`:
  - Categoría, zona (nullable) y fase (`grupos`, `cuartos`, `semi`, `final`, `otro`).
  - Fecha y hora.
  - Equipo A y equipo B, **nullable**, con textos `placeholder_a`/`placeholder_b` (ej. "Ganador Zona A").
  - Goles A y B, goles por chukker (jsonb, opcional).
  - Estado (`programado`, `jugado`, `suspendido`).
- `goleadores`: partido, jugador, cantidad.

**Vistas (pestañas del torneo):** General, Categorías, Equipos, Fixture, Posiciones, Cobros.

- **Equipos:** se arman igual que en prácticas y se asignan a una categoría. Aviso si la suma de hándicap supera el tope.
- **Zonas:** crear zonas y asignar equipos. Sin zonas, la categoría es un grupo único.
- **Fixture:** el admin crea cada partido **a mano**. Botón opcional "Generar todos contra todos" por zona, que crea partidos editables.
- **Cargar resultado:** goles, chukkers y goleadores opcionales.
- **Posiciones:** se calcula sola por zona (PJ, PG, PP, GF, GC, DIF), con una vista SQL o función.
- **Exportar fixture y posiciones**, por categoría o el torneo completo:
  - PDF
  - Excel
  - Imagen vertical 1080×1920 para historias

**Reglas:** un jugador no puede estar en dos equipos del mismo torneo.

---

## Módulo 4: Cobros + Mercado Pago

**Tablas**
- `cobros`:
  - Jugador.
  - Concepto (`cuota_social`, `practica`, `clase`, `torneo`, `otro`) y descripción.
  - Actividad (nullable), periodo (`YYYY-MM`, solo cuota social).
  - Monto y vencimiento.
  - Estado (`pendiente`, `pagado`, `vencido`, `anulado`, `bonificado`).
  - Medio de pago (`mercadopago`, `efectivo`, `transferencia`), `pagado_at`, nota o comprobante.
  - Único (jugador, periodo) para cuota social.
- `links_pago`: token aleatorio largo (no secuencial, mínimo 32 caracteres), monto total, estado, `mp_preference_id`, `mp_payment_id`, `expira_at`.
- `link_pago_cobros`: un link agrupa **uno o varios** cobros. Así funciona "Cobrar todo lo pendiente".
- `cobro_eventos`: historial (creado, link generado, enviado, pagado, anulado) con usuario y fecha.
- `configuracion`: monto de cuota social vigente, día de vencimiento, precio sugerido por tipo de actividad.
- `cuota_social_historial`: cambios de monto con fecha desde.

**Reglas de negocio**
- **Cuota social:** monto fijo mensual que el admin puede cambiar. Rige desde el mes siguiente; las cuotas ya generadas no cambian.
  - Vercel Cron `/api/cron/cuotas` el día 1 de cada mes genera la cuota para todos los socios activos.
  - Debe ser idempotente: si corre dos veces no duplica.
  - Botón para generarla a mano.
- **Actividades:** el cobro se crea cuando el admin anota al jugador (las inscripciones llegan por WhatsApp), con el precio de la actividad.
- **Estado pagado por Mercado Pago:** un cobro pasa a pagado **solo** por webhook. Nunca por la URL de retorno.
- **Efectivo y transferencia:** los marca el admin.
- **Sin borrar:** un cobro no se borra; se anula o se bonifica.
- **Cambio de monto:** si se edita el monto, se invalida el link anterior y se genera uno nuevo.
- **Vencidos:** un cron diario marca `vencido` los pendientes con fecha pasada.

**Integración Mercado Pago (Checkout Pro)**
- Crear la preferencia en el servidor:
  - `items` con el detalle de los cobros
  - `external_reference` = id del link de pago
  - `notification_url` = `/api/webhooks/mercadopago`
  - `back_urls` a `/pagar/[token]`
- Webhook:
  - Validar la firma `x-signature` con `MP_WEBHOOK_SECRET`.
  - Consultar el pago a la API de Mercado Pago con el id recibido (no confiar en el body).
  - Si está `approved`, marcar como pagados el link y todos sus cobros.
  - Idempotente: guardar `mp_payment_id` y no procesar dos veces.
  - Responder 200 rápido.
- QR: generado con `qrcode` a partir del `init_point`, descargable como PNG.
- WhatsApp: botón que abre `https://wa.me/<telefono>?text=<mensaje>` con concepto, monto y link `/pagar/[token]`.
- Para la demo se usan credenciales de prueba de mi cuenta. Todo por variables de entorno, así se cambia a la cuenta del club sin tocar código. *(Acordado: se prueba con credenciales de PRODUCCIÓN.)*

**Vistas**
1. Resumen: recaudado del mes, pendiente, morosos, vencidos. Accesos a "Nuevo cobro" y "Generar cuotas".
2. Listado de cobros:
   - Filtros por concepto, estado, mes, jugador y medio.
   - Acciones rápidas: copiar link, ver QR, WhatsApp, marcar pagado.
   - Exportar a Excel.
3. Nuevo cobro manual: concepto libre, monto, vencimiento, a uno o varios jugadores.
4. Configuración: cuota social (monto y día de vencimiento) y precios sugeridos.
5. Detalle del cobro: link, QR, compartir, historial de eventos, anular o bonificar.
6. Registrar pago manual: medio, fecha, nota o comprobante (archivo opcional).
7. "Cobrar todo lo pendiente" desde la ficha del jugador.
8. Página pública `/pagar/[token]`:
   - Muestra concepto(s), monto total, nombre del jugador y el botón de Mercado Pago.
   - Estados: pendiente, "Pago recibido", link vencido o anulado.
   - Sin datos personales extra. Con el branding del club.

---

## Datos de demo

Un script `supabase/seed.sql` con datos realistas para mostrar:
- 30 jugadores, entre ellos 2 profesores y 5 externos, con algunos aptos vencidos.
- Prácticas y clases de las últimas semanas, con asistencia cargada.
- Un torneo con 2 categorías, zonas, fixture parcialmente jugado y posiciones.
- Cuotas sociales de 3 meses, con pagados, pendientes y vencidos.
- Un usuario admin de prueba.

---

## Etapas sugeridas

1. Setup del proyecto, Supabase, auth, layout (sidebar + mobile), migraciones con todo el modelo, RLS y seed.
2. Jugadores.
3. Actividades (prácticas y clases) con armado de equipos y asistencia.
4. Torneos: categorías, zonas, fixture, resultados, posiciones.
5. Cobros: cuota social, cobros por actividad, Mercado Pago, webhook, página pública, WhatsApp y QR.
6. Exportaciones (PDF, Excel, imagen), resumen y crons.

En cada etapa:
- Corré `tsc`, lint y build antes de darla por terminada.
- Decime qué quedó, qué falta y cómo probarlo.
- No avances a la siguiente sin mi OK.
