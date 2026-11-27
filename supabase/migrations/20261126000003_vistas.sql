-- =====================================================================
-- Vistas (todas con security_invoker: respetan RLS del usuario)
-- =====================================================================

-- Jugadores con deuda y estado de documentos.
create view public.jugadores_resumen
with (security_invoker = true) as
select
  j.*,
  coalesce(d.deuda, 0)::numeric(12, 2) as deuda,
  coalesce(d.cobros_adeudados, 0)::integer as cobros_adeudados,
  a.apto_vencimiento,
  case
    when a.apto_vencimiento is null then 'sin_apto'
    when a.apto_vencimiento < public.hoy_ar() then 'vencido'
    when a.apto_vencimiento < public.hoy_ar() + 30 then 'por_vencer'
    else 'vigente'
  end as apto_estado,
  docs.alerta as alerta_documentos
from public.jugadores j
left join lateral (
  select sum(c.monto) as deuda, count(*) as cobros_adeudados
  from public.cobros c
  where c.jugador_id = j.id and c.estado in ('pendiente', 'vencido')
) d on true
left join lateral (
  select max(doc.vencimiento) as apto_vencimiento
  from public.jugador_documentos doc
  where doc.jugador_id = j.id and doc.tipo = 'apto_medico'
) a on true
left join lateral (
  -- Se mira el documento más reciente de cada tipo.
  select case
    when bool_or(t.vencimiento < public.hoy_ar()) then 'vencido'
    when bool_or(t.vencimiento < public.hoy_ar() + 30) then 'por_vencer'
  end as alerta
  from (
    select doc.tipo, max(doc.vencimiento) as vencimiento
    from public.jugador_documentos doc
    where doc.jugador_id = j.id and doc.vencimiento is not null
    group by doc.tipo
  ) t
) docs on true;

-- Actividades con participantes y recaudación.
create view public.actividades_resumen
with (security_invoker = true) as
select
  a.*,
  case when p.id is not null then p.nombre || ' ' || p.apellido end as profesor_nombre,
  coalesce(part.participantes, 0)::integer as participantes,
  coalesce(part.presentes, 0)::integer as presentes,
  coalesce(c.esperado, 0)::numeric(12, 2) as monto_esperado,
  coalesce(c.cobrado, 0)::numeric(12, 2) as monto_cobrado
from public.actividades a
left join public.jugadores p on p.id = a.profesor_id
left join lateral (
  select count(*) as participantes, count(*) filter (where pa.asistencia = 'presente') as presentes
  from public.participaciones pa
  where pa.actividad_id = a.id
) part on true
left join lateral (
  select
    sum(co.monto) filter (where co.estado in ('pendiente', 'vencido', 'pagado')) as esperado,
    sum(co.monto) filter (where co.estado = 'pagado') as cobrado
  from public.cobros co
  where co.actividad_id = a.id
) c on true;

-- Equipos con hándicap total y control de tope de la categoría.
create view public.equipos_resumen
with (security_invoker = true) as
select
  e.*,
  cat.nombre as categoria_nombre,
  cat.tope_handicap,
  z.nombre as zona_nombre,
  coalesce(h.jugadores, 0)::integer as cantidad_jugadores,
  coalesce(h.handicap_total, 0)::integer as handicap_total,
  (cat.tope_handicap is not null and coalesce(h.handicap_total, 0) > cat.tope_handicap) as excede_tope
from public.equipos e
left join public.torneo_categorias cat on cat.id = e.categoria_id
left join public.torneo_zonas z on z.id = e.zona_id
left join lateral (
  select count(*) as jugadores, sum(j.handicap) as handicap_total
  from public.participaciones pa
  join public.jugadores j on j.id = pa.jugador_id
  where pa.equipo_id = e.id
) h on true;

-- Tabla de posiciones por zona (o por categoría si no tiene zonas).
-- Cuenta solo partidos de fase de grupos ya jugados. Orden: PG, DIF, GF.
create view public.posiciones
with (security_invoker = true) as
with resultados as (
  select p.equipo_a_id as equipo_id, p.goles_a as gf, p.goles_b as gc
  from public.partidos p
  where p.estado = 'jugado' and p.fase = 'grupos'
  union all
  select p.equipo_b_id, p.goles_b, p.goles_a
  from public.partidos p
  where p.estado = 'jugado' and p.fase = 'grupos'
),
tabla as (
  select
    e.actividad_id,
    e.categoria_id,
    e.zona_id,
    e.id as equipo_id,
    e.nombre as equipo,
    count(r.equipo_id)::integer as pj,
    count(*) filter (where r.gf > r.gc)::integer as pg,
    count(*) filter (where r.gf < r.gc)::integer as pp,
    count(*) filter (where r.gf = r.gc)::integer as pe,
    coalesce(sum(r.gf), 0)::integer as gf,
    coalesce(sum(r.gc), 0)::integer as gc
  from public.equipos e
  left join resultados r on r.equipo_id = e.id
  where e.categoria_id is not null
  group by e.actividad_id, e.categoria_id, e.zona_id, e.id, e.nombre
)
select
  t.*,
  (t.gf - t.gc)::integer as dif,
  row_number() over (
    partition by t.categoria_id, t.zona_id
    order by t.pg desc, (t.gf - t.gc) desc, t.gf desc, t.equipo
  )::integer as posicion
from tabla t;

-- Goleadores del torneo.
create view public.goleadores_torneo
with (security_invoker = true) as
select
  p.actividad_id,
  p.categoria_id,
  g.jugador_id,
  j.nombre || ' ' || j.apellido as jugador,
  sum(g.cantidad)::integer as goles
from public.goleadores g
join public.partidos p on p.id = g.partido_id
join public.jugadores j on j.id = g.jugador_id
group by p.actividad_id, p.categoria_id, g.jugador_id, j.nombre, j.apellido;
