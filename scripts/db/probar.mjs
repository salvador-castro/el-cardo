// Prueba migraciones + seed + reglas de negocio + RLS sobre PGlite.
// Uso: npm run db:probar
import { crearBase } from './pglite.mjs'

let db
try {
  db = await crearBase({ seed: true })
} catch (e) {
  console.error(e.message)
  process.exit(1)
}

const q = async (sql, params) => (await db.query(sql, params)).rows
const show = async (label, sql) => {
  console.log(`\n# ${label}`)
  console.table(await q(sql))
}
let failures = 0
const check = (label, cond) => {
  console.log(cond ? 'PASS' : 'FAIL', label)
  if (!cond) failures++
}
const expectError = async (label, sql, match) => {
  try {
    await db.exec(sql)
    check(label + ' (no error raised)', false)
  } catch (e) {
    check(`${label} → "${e.message}"`, !match || e.message.includes(match))
  }
}

await show('Conteos', `
  select (select count(*) from jugadores) jugadores,
         (select count(*) from jugadores where es_profesor) profesores,
         (select count(*) from jugadores where tipo='externo') externos,
         (select count(*) from actividades) actividades,
         (select count(*) from participaciones) participaciones,
         (select count(*) from cobros) cobros,
         (select count(*) from cobro_eventos) eventos,
         (select count(*) from handicap_historial) hcp_hist`)
await show('Cobros por concepto/estado', `select concepto, estado, count(*), sum(monto) from cobros group by 1,2 order by 1,2`)
await show('Posiciones', `select c.nombre cat, z.nombre zona, p.posicion, p.equipo, p.pj, p.pg, p.pp, p.gf, p.gc, p.dif
  from posiciones p join torneo_categorias c on c.id=p.categoria_id left join torneo_zonas z on z.id=p.zona_id
  order by c.orden, z.orden nulls first, p.posicion`)
await show('Equipos torneo', `select nombre, categoria_nombre, zona_nombre, cantidad_jugadores, handicap_total, tope_handicap, excede_tope
  from equipos_resumen where categoria_id is not null order by categoria_nombre, nombre`)
await show('Jugadores con alerta', `select nombre, apellido, tipo, apto_estado, alerta_documentos, deuda, cobros_adeudados
  from jugadores_resumen where apto_estado <> 'vigente' or alerta_documentos is not null order by apellido`)
await show('Actividades', `select tipo, nombre, estado, participantes, presentes, monto_esperado, monto_cobrado, profesor_nombre
  from actividades_resumen order by inicio`)
await show('Búsqueda lista WhatsApp', `select indice, texto, nombre, apellido, round(similitud::numeric,2) sim
  from buscar_jugadores_lista(array['Juancho Bianchi','nico barrios','Sofia Herrera','lucia','Gonzalez'], 2)`)

// ---- Reglas ----
check('Hay 30 jugadores', Number((await q(`select count(*) c from jugadores`))[0].c) === 30)

// Cuotas idempotentes
const before = (await q(`select count(*) c from cobros where concepto='cuota_social'`))[0].c
const n = (await q(`select generar_cuotas_sociales() n`))[0].n
check(`generar_cuotas_sociales idempotente (insertó ${n})`, n === 0 && (await q(`select count(*) c from cobros where concepto='cuota_social'`))[0].c === before)

// Cambio de cuota rige desde el mes siguiente
await db.exec(`update configuracion set cuota_social_monto = 50000`)
const montos = await q(`select monto_cuota_social(to_char(hoy_ar(),'YYYY-MM')) actual,
  monto_cuota_social(to_char(hoy_ar() + interval '1 month','YYYY-MM')) siguiente`)
check(`cuota: mes actual ${montos[0].actual}, siguiente ${montos[0].siguiente}`, Number(montos[0].actual) === 45000 && Number(montos[0].siguiente) === 50000)

// Jugador en dos equipos del mismo torneo
await expectError('Jugador en dos equipos del mismo torneo', `
  insert into participaciones (actividad_id, jugador_id, equipo_id)
  select e.actividad_id, '00000000-0000-4000-a000-000000000001', e.id from equipos e where e.nombre = 'El Trébol'`, 'duplicate')

// Inactivo no se agrega
await expectError('Inactivo no se agrega', `
  insert into participaciones (actividad_id, jugador_id)
  select id, '00000000-0000-4000-a000-000000000015' from actividades where estado='programada' and tipo='practica'`, 'inactivo')

// Agregar a actividad con precio crea cobro
const act = (await q(`select id from actividades where estado='programada' and tipo='practica'`))[0].id
await db.exec(`insert into participaciones (actividad_id, jugador_id) values ('${act}', '00000000-0000-4000-a000-000000000019')`)
const cob = await q(`select estado, monto, vencimiento from cobros where actividad_id='${act}' and jugador_id='00000000-0000-4000-a000-000000000019'`)
check('Anotar jugador crea cobro pendiente', cob.length === 1 && cob[0].estado === 'pendiente')

// Link de pago para 2 cobros del mismo jugador, reutilización y pago MP
const imp = await q(`select id from cobros where jugador_id='00000000-0000-4000-a000-000000000019' and estado in ('pendiente','vencido') order by created_at limit 2`)
const ids = `array['${imp.map(r => r.id).join("','")}']::uuid[]`
const link = (await q(`select (crear_link_pago(${ids})).*`))[0]
check(`Link creado token=${link.token.length} chars, total ${link.monto_total}`, link.token.length >= 32)
const link2 = (await q(`select (crear_link_pago(${ids})).*`))[0]
check('Mismo set de cobros reutiliza el link', link2.id === link.id)
const pub = (await q(`select pago_publico($1) j`, [link.token]))[0].j
check(`pago_publico: ${pub.jugador}, ${pub.items.length} items, estado ${pub.estado}`, pub.items.length === imp.length && pub.estado === 'activo')

// Link individual del primer cobro → al pagarse el grupal, se invalida
const linkInd = (await q(`select (crear_link_pago(array['${imp[0].id}']::uuid[])).*`))[0]
const r1 = (await q(`select registrar_pago_mp('MP-1', '${link.id}', 'approved', ${link.monto_total}, '{}') r`))[0].r
const r2 = (await q(`select registrar_pago_mp('MP-1', '${link.id}', 'approved', ${link.monto_total}, '{}') r`))[0].r
check(`Pago MP aplicado (${r1}) e idempotente (${r2})`, r1 === 'aplicado' && r2 === 'ya_procesado')
const est = await q(`select estado, medio_pago from cobros where id = any(${ids})`)
check('Cobros del link quedan pagados por MP', est.every(e => e.estado === 'pagado' && e.medio_pago === 'mercadopago'))
const li = (await q(`select estado from links_pago where id='${linkInd.id}'`))[0].estado
check(`Link individual superpuesto se invalidó (${li})`, li === 'anulado')
const r3 = (await q(`select registrar_pago_mp('MP-2', '${linkInd.id}', 'approved', 1, '{}') r`))[0].r
check(`Segundo pago sobre cobro ya pagado queda a revisar (${r3})`, r3 === 'a_revisar')

// Cambio de monto invalida link
const pend = (await q(`select id from cobros where estado='pendiente' and participacion_id is null and concepto='otro' limit 1`))[0].id
const l3 = (await q(`select (crear_link_pago(array['${pend}']::uuid[])).*`))[0]
await db.exec(`update cobros set monto = monto + 1000 where id='${pend}'`)
check('Editar monto invalida el link', (await q(`select estado from links_pago where id='${l3.id}'`))[0].estado === 'anulado')

// ---- Etapa 3: equipos y participantes ----
const J = (n) => `00000000-0000-4000-a000-${String(n).padStart(12, '0')}`
const eq1 = (await q(`select guardar_equipo('${act}', 'Rojo', array['${J(3)}','${J(11)}','${J(12)}']::uuid[]) id`))[0].id
const enEq = await q(`select jugador_id from participaciones where equipo_id='${eq1}' order by jugador_id`)
check(`guardar_equipo crea el equipo con 3 jugadores (${enEq.length})`, enEq.length === 3)
check('guardar_equipo anota a los nuevos y les crea cobro',
  Number((await q(`select count(*) c from cobros where actividad_id='${act}' and jugador_id in ('${J(11)}','${J(12)}') and estado='pendiente'`))[0].c) === 2)
await q(`select guardar_equipo('${act}', 'Rojo', array['${J(3)}','${J(11)}']::uuid[], '${eq1}')`)
await db.exec(`update equipos set color = 'rojo' where id = '${eq1}'`)
check('El equipo guarda su camiseta', (await q(`select color from equipos where id='${eq1}'`))[0].color === 'rojo')
await expectError('Camiseta de equipo fuera de la lista', `update equipos set color = 'fucsia' where id = '${eq1}'`, 'equipos_color_valido')
const salio = await q(`select equipo_id from participaciones where actividad_id='${act}' and jugador_id='${J(12)}'`)
check('Quien sale del equipo sigue anotado sin equipo', salio.length === 1 && salio[0].equipo_id === null)
await expectError('Dos equipos con el mismo nombre', `select guardar_equipo('${act}', 'Rojo', '{}'::uuid[])`, 'duplicate')
const clase = (await q(`select id, profesor_id from actividades where tipo='clase' and estado='programada' limit 1`))[0]
await expectError('Las clases no tienen equipos', `select guardar_equipo('${clase.id}', 'A', '{}'::uuid[])`, 'clases no tienen')
const ag1 = (await q(`select agregar_participantes('${act}', array['${J(13)}','${J(14)}','${J(3)}']::uuid[]) n`))[0].n
const ag2 = (await q(`select agregar_participantes('${act}', array['${J(13)}','${J(14)}']::uuid[]) n`))[0].n
check(`agregar_participantes ignora a los ya anotados (${ag1} y ${ag2})`, ag1 === 2 && ag2 === 0)
await q(`select agregar_participantes('${act}', array['${J(12)}']::uuid[], '${eq1}')`)
check('agregar_participantes con equipo mueve al ya anotado',
  (await q(`select equipo_id from participaciones where actividad_id='${act}' and jugador_id='${J(12)}'`))[0].equipo_id === eq1)
await expectError('No se cambia el tipo de una actividad', `update actividades set tipo='clase' where id='${act}'`, 'tipo')
const alumno = (await q(`select jugador_id from participaciones where actividad_id='${clase.id}' limit 1`))[0].jugador_id
await db.exec(`update jugadores set es_profesor = true where id='${alumno}'`)
await expectError('El profesor no puede ser alumno de la misma clase', `update actividades set profesor_id='${alumno}' where id='${clase.id}'`, 'anotado como alumno')
await db.exec(`update jugadores set es_profesor = false where id='${alumno}'`)

// ---- Etapa 3 (ajustes): precio especial por jugador ----
const cobroDe = async (n) => (await q(`select c.estado, c.monto::numeric m from cobros c join participaciones p on p.id=c.participacion_id
  where p.actividad_id='${act}' and p.jugador_id='${J(n)}' and c.estado <> 'anulado'`))
await db.exec(`update participaciones set precio = 10000 where actividad_id='${act}' and jugador_id='${J(11)}'`)
check('Precio especial actualiza su cobro impago', Number((await cobroDe(11))[0]?.m) === 10000)
await db.exec(`update actividades set precio = 30000 where id='${act}'`)
check('Cambio de precio de la actividad respeta el precio especial',
  Number((await cobroDe(11))[0]?.m) === 10000 && Number((await cobroDe(12))[0]?.m) === 30000)
await db.exec(`update participaciones set precio = 0 where actividad_id='${act}' and jugador_id='${J(11)}'`)
check('Precio especial 0 anula su cobro', (await cobroDe(11)).length === 0)
await db.exec(`update participaciones set precio = null where actividad_id='${act}' and jugador_id='${J(11)}'`)
check('Volver al precio de la actividad crea el cobro', Number((await cobroDe(11))[0]?.m) === 30000)
await db.exec(`update cobros set estado='pagado', medio_pago='efectivo', pagado_at=now()
  where participacion_id = (select id from participaciones where actividad_id='${act}' and jugador_id='${J(13)}')`)
await expectError('No se cambia el precio de quien ya pagó',
  `update participaciones set precio = 1 where actividad_id='${act}' and jugador_id='${J(13)}'`, 'ya pagó')

// ---- Etapa 3 (ajustes): partidos de práctica ----
const eq2 = (await q(`select guardar_equipo('${act}', 'Azul', array['${J(14)}']::uuid[]) id`))[0].id
await db.exec(`insert into partidos (actividad_id, equipo_a_id, equipo_b_id, color_a, color_b, fase, goles_a, goles_b, estado)
  values ('${act}', '${eq1}', '${eq2}', 'blanco', 'azul', 'otro', 3, 2, 'jugado')`)
check('Partido de práctica con colores y resultado', Number((await q(`select count(*) c from partidos where actividad_id='${act}'`))[0].c) === 1)
check('Los partidos de práctica no entran en posiciones',
  Number((await q(`select count(*) c from posiciones where equipo_id in ('${eq1}','${eq2}')`))[0].c) === 0)
await expectError('Color de camiseta fuera de la lista', `insert into partidos (actividad_id, equipo_a_id, equipo_b_id, color_a, fase)
  values ('${act}', '${eq1}', '${eq2}', 'fucsia', 'otro')`, 'color_a')
await expectError('Las clases no tienen partidos', `insert into partidos (actividad_id, fase) values ('${clase.id}', 'otro')`, 'clases no tienen partidos')
const torneo = (await q(`select id from actividades where tipo='torneo' limit 1`))[0].id
await expectError('Partido de torneo sin categoría', `insert into partidos (actividad_id) values ('${torneo}')`, 'categoría')
await expectError('Borrar un equipo con partido jugado', `delete from equipos where id='${eq2}'`, 'partidos_jugado_con_resultado')

// Cancelar actividad anula pendientes
await db.exec(`update actividades set estado='cancelada' where id='${act}'`)
const canc = await q(`select estado, count(*) c from cobros where actividad_id='${act}' group by 1`)
check(`Cancelar actividad anula pendientes y respeta pagados (${JSON.stringify(canc)})`, canc.every(c => c.estado === 'anulado' || c.estado === 'pagado'))

// Quitar jugador anula su cobro
const pt = (await q(`select p.id, p.actividad_id from participaciones p join actividades a on a.id=p.actividad_id
  where a.tipo='clase' and a.estado='programada' limit 1`))[0]
await db.exec(`delete from participaciones where id='${pt.id}'`)
check('Quitar participante anula su cobro', (await q(`select count(*) c from cobros where actividad_id='${pt.actividad_id}' and estado='anulado'`))[0].c >= 1)

// Todos contra todos
const cat = (await q(`select id from torneo_categorias where nombre='Desarrollo'`))[0].id
const ttc = (await q(`select generar_todos_contra_todos('${cat}') n`))[0].n
check(`Todos contra todos no duplica cruces existentes (creó ${ttc})`, ttc === 0)

// ---- RLS ----
const admin = '00000000-0000-4000-a000-00000000a001'
await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${admin}', false);`)
check('Admin ve jugadores', Number((await q(`select count(*) c from jugadores_resumen`))[0].c) === 30)
const fin = (await q(`select a.id from actividades a where a.estado='finalizada' and a.tipo='practica'
  and not exists (select 1 from participaciones p where p.actividad_id=a.id and p.jugador_id='${J(5)}') limit 1`))[0].id
const agAdmin = (await q(`select agregar_participantes('${fin}', array['${J(5)}']::uuid[]) n`))[0].n
check(`Admin anota jugadores con agregar_participantes (${agAdmin})`, agAdmin === 1)
const del = await q(`with d as (delete from cobros returning 1) select count(*) c from d`).catch(() => [{ c: 0 }])
check('Delete de cobros no borra nada', Number(del[0].c) === 0)
await expectError('Admin no marca pagado por MP a mano', `update cobros set estado='pagado', medio_pago='mercadopago', pagado_at=now()
  where id = (select id from cobros where estado='vencido' limit 1)`, 'Mercado Pago')
await db.exec(`update cobros set estado='pagado', medio_pago='efectivo', pagado_at=now() where id = (select id from cobros where estado='vencido' limit 1)`)
check('Admin marca pagado en efectivo; evento con usuario', Number((await q(`select count(*) c from cobro_eventos where usuario_id='${admin}' and tipo='pagado'`))[0].c) === 1)
await expectError('Admin no llama pago_publico', `select pago_publico('x')`, 'permission')
await db.exec(`select set_config('request.jwt.claim.sub', '00000000-0000-4000-a000-0000000000ff', false);`)
check('Usuario sin perfil no ve nada', Number((await q(`select count(*) c from jugadores`))[0].c) === 0)
await db.exec(`reset role; set role anon;`)
await expectError('Anon no accede a tablas', `select * from jugadores`, 'permission')
await expectError('Anon no ejecuta funciones', `select generar_cuotas_sociales()`, 'permission')
await expectError('Anon no arma equipos', `select guardar_equipo(gen_random_uuid(), 'X', '{}'::uuid[])`, 'permission')
await db.exec(`reset role; set role service_role;`)
check('Service role puede leer pago_publico', (await q(`select pago_publico($1) j`, [link.token]))[0].j.estado === 'pagado')
await db.exec(`reset role;`)

console.log(failures ? `\n${failures} FALLAS` : '\nTodo OK')
process.exit(failures ? 1 : 0)
