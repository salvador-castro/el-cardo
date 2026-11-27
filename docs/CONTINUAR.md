# Cómo seguir — estado al 27/11/2026

Documento de traspaso para retomar el trabajo en otra sesión o computadora.
Leer junto con `docs/ESPECIFICACION.md` (la especificación original). **Lo que dice este archivo tiene prioridad** sobre la especificación.

---

## 1. Estado

| Etapa | Estado |
|---|---|
| 1. Setup, Supabase, auth, layout, migraciones, RLS, seed | ✅ Terminada y revisada |
| 2. Jugadores | ✅ Terminada y revisada (con ajustes pedidos por el cliente) |
| 3. Actividades (prácticas y clases, equipos, partidos, asistencia) | ✅ Terminada, revisada y en producción (commit `6f02e41`, 27/11/2026) |
| 4. Torneos (+ rotación a la americana en prácticas) | ✅ Terminada, revisada y en producción (28/11/2026) |
| 5. Cobros + Mercado Pago + mails | ⏭️ **Próxima** (con cambios acordados, ver §4) |
| 6. Exportaciones, resumen y crons | Pendiente |

Modo de trabajo acordado: **una etapa por vez**. Antes de cerrar una etapa: `npm run typecheck`, `npm run lint`, `npm run build` y `npm run db:probar`. Después contar qué quedó, qué falta y cómo probarlo, y **frenar hasta que el cliente dé el OK**. El cliente prefiere ir "de a pasos": si una idea nueva corresponde a otra etapa, anotarla y seguir el orden.

UI y textos en español rioplatense; código, tablas y columnas en español sin tildes; comentarios en inglés o español (hasta ahora, español).

---

## 2. Infraestructura

- **Repo:** https://github.com/salvador-castro/el-cardo (rama `main`, **público**; se recomendó pasarlo a privado).
- **Producción:** https://el-cardo-polo.vercel.app (proyecto Vercel `el-cardo`, scope `salvador-castros-projects`). Cada push a `main` despliega solo. `el-cardo.vercel.app` es de otra cuenta. A futuro, si el club aprueba: `gestion.elcardopoloclub.com`.
- **Supabase:** proyecto `elcardopoloclub` (linkeado con la CLI). Migraciones aplicadas hasta `20261128000010_torneos.sql` (28/11/2026). Tipos regenerados con `npm run db:tipos`. Seed cargado. Tipos regenerados con `npm run db:tipos`.
- **Usuario de demo:** `admin@elcardo.test` (la contraseña la tiene el cliente; no se guarda en el repo).
- **Mercado Pago:** se prueba con credenciales de **producción** (los pagos son reales; no se puede pagar con la misma cuenta dueña de la app). Webhook configurado en MP → `https://el-cardo-polo.vercel.app/api/webhooks/mercadopago`, evento "Pagos (legacy)".

### Variables de entorno
Ver `.env.example`. En Vercel están cargadas las 10 para production y preview (las secretas como *sensitive*, que no se pueden volver a leer). `NEXT_PUBLIC_APP_URL=https://el-cardo-polo.vercel.app` en Vercel **y** en `.env.local`.

En una computadora nueva:
```bash
npm install
npx vercel link --yes --project el-cardo --scope salvador-castros-projects
npx vercel env pull .env.local   # trae las no secretas; las sensitive vienen vacías
```
Supabase CLI: tiene que estar logueada (`npx supabase login`) con la cuenta dueña de `elcardopoloclub` y linkeada (`npx supabase link --project-ref <ref>`; el ref sale de la URL del proyecto). Si la CLI falla con `Failed to start server. Is port 9234 in use?`, es la variable `BUN_INSPECT` del entorno (pasa al correrla desde Claude Code): correr con `env -u BUN_INSPECT npx supabase ...` (bash) o `$env:BUN_INSPECT=$null` antes (PowerShell).

Completar a mano en `.env.local` las secretas (`SUPABASE_SECRET_KEY`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `CRON_SECRET`) copiándolas de la otra máquina o del gestor de contraseñas. **Nunca pegar secretos en el chat**: para subir variables a Vercel se usa un script que las pasa por stdin a `vercel env add` sin imprimirlas.

---

## 3. Decisiones técnicas (y trampas ya resueltas)

- **Next.js 16.4**: el middleware se llama `src/proxy.ts`. Hay docs de la versión en `node_modules/next/dist/docs/` (leerlas antes de usar APIs nuevas). **Cache Components desactivado** (`cacheComponents: false`): todas las páginas dependen de la sesión. `error.tsx` recibe `{ error: unknown, retry }`.
- **TanStack Table v9** (no v8): `useTable` + `tableFeatures({...})` con registro explícito de features (sorting, pagination). Ver `src/components/jugadores/listado-jugadores.tsx` como referencia. Docs en `node_modules/@tanstack/react-table/skills/`.
- **shadcn/ui** estilo `radix-nova` (Tailwind 4). Formularios con `Field`/`FieldLabel`/`FieldError` + react-hook-form + zod v4.
- **Supabase CLI 3.x**: apunta a la base local por defecto → **siempre `--remote`** (`npm run db:push`, `db:seed`, `db:tipos` ya lo incluyen). Sin Docker en la máquina.
- **Permisos:** los proyectos nuevos de Supabase **no** dan GRANT automático sobre `public` a `authenticated`/`service_role`. La migración `..._000006_permisos_explicitos.sql` lo resuelve y deja default privileges. Si una tabla nueva da "permission denied", revisar eso primero.
- **Pruebas del SQL sin Supabase:** `npm run db:probar` levanta Postgres 17 en memoria (PGlite) con stubs de auth/storage, aplica migraciones + seed y corre ~62 chequeos de reglas y RLS (`scripts/db/probar.mjs`). Agregar chequeos ahí cuando se cambie el SQL.
- **Tipos:** `npm run db:tipos` (desde Supabase). `db:tipos:local` genera desde las migraciones si no hay conexión.
- **Lógica de negocio en la base** (triggers): historial de hándicap, auditoría, cobro automático al anotar jugador, anulación al quitar/cancelar, actualización al cambiar precio, invalidación de links al cambiar monto o estado, eventos de cobro. Funciones listas: `generar_cuotas_sociales`, `procesar_vencimientos`, `crear_link_pago`, `registrar_pago_mp`, `pago_publico`, `buscar_jugadores`, `buscar_jugadores_lista`, `generar_todos_contra_todos`. Vistas: `jugadores_resumen`, `actividades_resumen`, `equipos_resumen`, `posiciones`, `goleadores_torneo`.
- **Storage:** buckets privados `fotos`, `documentos`, `comprobantes`. Se sube **desde el navegador** con la sesión del usuario (`src/lib/storage.ts`, evita el límite de 4,5 MB de las funciones) y se registra con una server action. Se muestran con URLs firmadas (`src/lib/supabase/urls-firmadas.ts`).
- **Marca:** paleta del sitio del club (marino `#14233F`, dorado `#C6A35A`, crema `#F2E7D6`), tipografías Cormorant Garamond (títulos), Cinzel (marca) y Work Sans (texto). Escudo en `public/marca/`. Tokens en `src/app/globals.css`.
- **Layout:** contenido hasta 1600 px de ancho; sidebar en desktop, barra superior + barra inferior en el celular.

---

## 4. Cambios pedidos por el cliente (ya hechos o acordados)

### Hechos (etapa 2)
- Listado de jugadores **paginado de a 8**, **filtros colapsables**, columnas **Jugador, Tipo, Hándicap, Apto, Acciones** (ojo = ver ficha, lápiz = editar).
- Ficha: sin barra de scroll visible en las pestañas; **solo el menú "Enviar"** (se sacó el botón de WhatsApp suelto).
- Menú **Enviar**: recordatorio de pago por WhatsApp (wa.me) o mail (mailto), mensaje libre por WhatsApp; cada envío se registra como evento `enviado` en los cobros. "Link de pago" figura deshabilitado ("etapa 5").
- Login con botón para **mostrar/ocultar contraseña**.
- Textos de mensajes en `src/lib/mensajes.ts`: el medio principal es **Mercado Pago**; `mensajeRecordatorio(nombre, cobros, linkPago?)` y `mensajeLinkPago(...)` ya aceptan el link.

### Hechos / decididos (etapa 3)
- Listado de actividades (solo prácticas y clases) en **lista** paginada de a 8 o **calendario semanal** (lunes a domingo; en el celular, agenda por día; "+" en cada día crea una actividad con esa fecha). Filtros colapsables: tipo, estado, desde/hasta (solo en lista).
- **Asistencia libre**: se marca en cualquier momento (no hace falta que la actividad haya pasado). Cuando está toda marcada se ofrece finalizar.
- **Quitar a un jugador que ya pagó**: se permite, con aviso ("ya pagó, el pago queda registrado en su cuenta corriente"). Qué hacer con esa plata (devolverla o dejarla como saldo a favor) queda para la **etapa 5**.
- El **tipo** de una actividad no se cambia después de creada (lo impide la base). El profesor no puede ser alumno de su propia clase.
- Las clases no tienen equipos. Eliminar un equipo deja a sus jugadores anotados, sin equipo.
- Funciones nuevas (`000007`): `guardar_equipo` (crea/renombra el equipo y deja exactamente esos jugadores, en una transacción) y `agregar_participantes` (alta masiva, ignora a los ya anotados).

- **Ajustes pedidos al revisar la etapa 3** (migración `000008`):
  - Botón "Editar" visible en cada equipo (antes estaba solo en el menú ⋮).
  - **Partidos en prácticas**: pestaña "Partidos" con cruces equipo vs equipo, hora y cancha opcionales, y **resultado** (goles). Muestra G/E/P de cada equipo. Se reusa la tabla `partidos` (la categoría pasó a ser opcional: obligatoria en torneos, prohibida en prácticas; las clases no tienen partidos). Los partidos de práctica no entran en `posiciones`.
  - ~~Color de camiseta por partido~~ → **cambió**: la camiseta es del equipo (ver abajo).
  - **Precio especial por jugador** (`participaciones.precio`, null = el de la actividad), desde el menú del jugador. Ajusta su cobro impago; con 0 lo anula; no se puede cambiar si ya pagó. Al cambiar el precio de la actividad, los que tienen precio especial no cambian.
  - Si hay anotados sin equipo, se muestra un aviso con "Armar equipo" (también en la tarjeta "Sin equipo"), y en el modal esos jugadores aparecen primero. Sin al menos 2 equipos no se pueden crear partidos.
  - La tarjeta de los anotados sin equipo se llama "Anotados sin equipo" (no es un equipo): "Armar equipo con estos" abre el modal con esos jugadores precargados, y el tacho los quita a todos de la actividad.
  - Eliminar equipo (tacho en cada equipo): "Solo el equipo" (los jugadores quedan sin equipo) o "Equipo y jugadores" (también los quita de la actividad; los impagos se anulan y los pagos quedan registrados). No se puede si el equipo tiene partidos con resultado.
  - El precio de la actividad se muestra como **precio base**, con cuántos pagan otro precio. Al agregar jugadores (sueltos o "Agregar varios") se puede poner un precio para ellos.
  - **Camiseta del equipo** (`equipos.color`, migración `000009`): se elige **solo al armar el equipo** (si el nombre es un color, se sincroniza); los equipos sin color que se llaman como uno lo toman de su nombre. El partido **no** elige camiseta: copia la de cada equipo en `partidos.color_a/color_b` y la tarjeta muestra la del equipo.
  - Ventana de partido compacta: dos selects "Seleccionar equipo" (el elegido de un lado no aparece en el otro; los equipos que ya tienen otro partido no se ofrecen, salvo con "Mostrar también los que ya tienen partido" para revanchas/finales) con los goles al lado, y hora/cancha abajo.
  - Equipos y partidos aplican a **todas las actividades salvo clases**: en la etapa 4 los torneos usan los mismos componentes.

### Hecho en la etapa 4 (Torneos)
- `/torneos`: listado en tarjetas y alta/edición (nombre, inicio y fin, precio base, notas). Detalle con pestañas **General, Categorías, Equipos, Fixture, Posiciones, Cobros**.
- **Categorías**: nombre, tope de hándicap, **formato** (`puntos`, `zonas_llave`, `eliminacion`) y puntos por ganar/empatar/perder (3/1/0 por defecto). Zonas (crear, renombrar, eliminar) y asignación de equipos a zona.
- **Equipos**: el mismo panel y modal de prácticas (`TabParticipantes`/`ModalEquipo` con la prop `categorias`), agrupados por categoría, con categoría y zona en el modal y aviso si superan el tope.
- **Fixture**: por categoría, fase de grupos por zona ("Todos contra todos") y **llave** en columnas por fase. Cada lado de un partido es un equipo, "Ganador/Perdedor de [partido]" o "N.º de [zona]" (`partidos.desde_*`). Los partidos se nombran solos ("Cuartos 1", "Semi 2", "Final", `src/lib/torneos/nombres.ts`).
- **Avance automático** en la base (migración `000010`): un trigger BEFORE completa los equipos desde su origen y uno AFTER recalcula los dependientes cuando cambia un resultado o termina una zona (`zona_terminada`). En la llave no puede haber empate.
- **Resultado**: goles, goles por chukker opcionales (tienen que sumar el total) y goleadores (tienen que jugar en el partido), todo en `guardar_resultado`.
- **Posiciones**: vista `posiciones` por puntos (puntos → diferencia → goles a favor), marca a los que pasan a la llave; goleadores por categoría; campeón cuando se juega la final.
- **Rotación a la americana (prácticas)** (rehecha según el modelo del cliente): grilla con ✓ / **BAJA** por chukker, fila **"HC en cancha"** (suma del hándicap de los que juegan cada chukker) y "Handicap total" por equipo; el reparto automático pone las bajas **de a 2 chukkers seguidos** (1-2, 3-4, 5-6) si los chukkers son pares, y cada uno descansa un tramo antes de repetir. El botón "Rotación" está en todos los partidos de práctica con los dos equipos. Detalle técnico: tabla `partido_descansos`; cada partido tiene `chukkers` (4 por defecto). Si un equipo tiene más de 4, aparece "Rotación": grilla chukker × jugador, reparto automático parejo (descansan primero los de menor hándicap; con 5 en 4 chukkers el de mayor hándicap juega todos) y edición a mano. **Solo prácticas**; si en torneos también rotan, se reusa `ContenidoRotacion`.

### Para la etapa 4 (Torneos) — decisiones
- **Decidido (27/11/2026):**
  - Los torneos son **otra sección** (`/torneos`): no aparecen en el listado ni en el calendario de Actividades.
  - **Formato por categoría:** por **puntos** (todos contra todos, en una o más zonas), **eliminación directa** (llave: p. ej. 1 vs 5, 6 vs 3, y los ganadores se cruzan), o **zonas + llave** (p. ej. dos zonas de 4 y avanzan los dos primeros).
  - **Avance automático según resultados:** cada lado de un partido puede ser un equipo, "Ganador del partido X" o "Puesto N de la zona Y"; cuando se carga el resultado (o termina la zona) el equipo se completa solo.
- **Pedido para prácticas (aclaración del cliente):** los partidos suelen ser de 4 por equipo, pero puede haber 5 en cada uno o 5 vs 4. Se juega **"a la americana"**: todos juegan, pero cada uno descansa un chukker. Hace falta una **rotación por chukker** (quién descansa en cada uno).
- `/actividades` no muestra torneos; el inicio y la ficha del jugador los muestran sin enlace (o enlazan a `/torneos`). Al hacer la etapa 4, decidir si aparecen en el listado/calendario de actividades.
- Reutilizar `ModalEquipo`, `SelectorJugadores`, `ModalAgregarVarios` y `TabPartidos`/`SelectorCamiseta` (los partidos de torneo además llevan categoría, zona y fase) (`src/components/actividades/detalle/`), y `guardar_equipo`, que ya sirve para torneos.

### Pedido para la etapa 6 (Exportaciones)
- **Exportar la planilla de rotación** como imagen, igual al modelo del cliente: logo, "PRÁCTICA · N CHUKKERS", club, día y hora; por equipo, nombre, handicap total, jugadores con hándicap, ✓/BAJA por chukker y fila "HC EN CANCHA".
- **Exportar los partidos de una práctica a PNG** (pedido al revisar la etapa 3): logo del club, fecha y hora de la actividad, y cada partido con sus dos equipos; de cada equipo: nombre, camiseta (color), hándicap total y jugadores (con su hándicap). Hacerlo con `next/og` como el resto de las imágenes; botón "Exportar imagen" en la pestaña Partidos. **Formato: horizontal** (p. ej. 1920×1080). Se tiene que poder exportar **todos los partidos** en una imagen **o un partido solo** (botón en cada tarjeta de partido). Si son muchos partidos, la imagen de "todos" tiene que acomodarlos (grilla o varias imágenes).

### Acordado para la etapa 5 (Cobros) — rediseño del cobro desde la ficha
Botón **"Cobrar"** en la ficha (hoy deshabilitado en `tab-cuenta-corriente.tsx`) → modal:
1. **Qué cobra:** lista de cobros pendientes/vencidos con checkboxes (todos marcados = "cancelar todo lo adeudado"). El admin puede elegir cuáles (ej. solo "Torneo $50.000"). **Monto editable** para **pago parcial** (ej. debe $200.000 y paga $125.000): se aplica a los cobros elegidos, **del más viejo al más nuevo**; el que queda a medias conserva su saldo y sigue pendiente/vencido.
2. **Cómo paga:**
   - **Mercado Pago:** se genera el link y **se envía automáticamente por mail** con un texto personalizado (ej. "Hola Juan, te enviamos el link para pagar Copa Apertura por $50.000") + opción de WhatsApp / copiar link. Pasa a pagado solo por webhook.
   - **Efectivo / Transferencia:** se registra pagado en el momento (fecha, nota, comprobante opcional); opcional mail de recibo.
3. Todo queda en el historial del cobro y en la cuenta corriente.

Implica cambios de esquema: tabla **`pagos`** + monto aplicado/saldo por cobro (hoy un cobro está pagado entero o no; `links_pago` tiene monto fijo = suma de cobros). Revisar `crear_link_pago`, `registrar_pago_mp`, `jugadores_resumen.deuda` y `actividades_resumen` para que usen saldos.

### Mails automáticos
- Proveedor elegido: **Resend** (está en el Marketplace de Vercel; se puede provisionar desde ahí).
- **Pendiente de definir:** el dominio de envío. Para mandar a cualquier destinatario hay que verificar un dominio (DNS). Opciones: `elcardopoloclub.com` (ideal, requiere acceso al DNS del club), un dominio del desarrollador para la demo, o enviar todo a la casilla propia durante la demo.

---

## 5. Pendientes de infraestructura
- Pasar el repo de GitHub a **privado** o cambiar la contraseña del usuario de demo antes de mostrarlo.
- Desactivar "Allow new users to sign up" en Supabase (Authentication) si no se hizo.
- Los documentos del seed no tienen archivo adjunto (aparecen "Sin archivo adjunto").

---

## 6. Etapa 3 — Actividades (hecha; referencia)
Según la especificación (Módulo 2), excepto `equipo_jugadores` (eliminada). El esquema, triggers, `actividades_resumen` y `buscar_jugadores_lista` ya existen. Reutilizar:
- `AltaRapidaJugador` (`src/components/jugadores/alta-rapida.tsx`) con la prop `onCreado`.
- `InsigniaApto` para el aviso de apto vencido al anotar (aviso, no bloqueo).
- El patrón de listado paginado de jugadores para el listado de actividades.
La ruta `/actividades` hoy es un placeholder (`src/components/app/proximamente.tsx`).
