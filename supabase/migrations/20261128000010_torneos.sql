-- Etapa 4: torneos (formato por categoría, puntos, llaves con avance automático)
-- y rotación "a la americana" en los partidos de práctica.

-- ---------------------------------------------------------------------
-- Categorías: formato y puntos
-- ---------------------------------------------------------------------

alter table public.torneo_categorias
  add column formato text not null default 'puntos'
    check (formato in ('puntos', 'eliminacion', 'zonas_llave')),
  add column puntos_victoria smallint not null default 3 check (puntos_victoria between 0 and 20),
  add column puntos_empate smallint not null default 1 check (puntos_empate between 0 and 20),
  add column puntos_derrota smallint not null default 0 check (puntos_derrota between 0 and 20);

-- ---------------------------------------------------------------------
-- Partidos: chukkers y origen de cada lado ("Ganador del partido X", "1.º de la Zona A")
-- ---------------------------------------------------------------------

alter table public.partidos
  add column chukkers smallint not null default 4 check (chukkers between 1 and 8),
  add column desde_a_partido uuid references public.partidos (id) on delete set null,
  add column desde_a_resultado text check (desde_a_resultado in ('ganador', 'perdedor')),
  add column desde_a_zona uuid references public.torneo_zonas (id) on delete set null,
  add column desde_a_puesto smallint check (desde_a_puesto between 1 and 32),
  add column desde_b_partido uuid references public.partidos (id) on delete set null,
  add column desde_b_resultado text check (desde_b_resultado in ('ganador', 'perdedor')),
  add column desde_b_zona uuid references public.torneo_zonas (id) on delete set null,
  add column desde_b_puesto smallint check (desde_b_puesto between 1 and 32),
  add constraint partidos_origen_a_unico check (desde_a_partido is null or desde_a_zona is null),
  add constraint partidos_origen_b_unico check (desde_b_partido is null or desde_b_zona is null),
  add constraint partidos_origen_a_completo check (
    (desde_a_partido is null or desde_a_resultado is not null) and (desde_a_zona is null or desde_a_puesto is not null)
  ),
  add constraint partidos_origen_b_completo check (
    (desde_b_partido is null or desde_b_resultado is not null) and (desde_b_zona is null or desde_b_puesto is not null)
  ),
  add constraint partidos_no_depende_de_si check (desde_a_partido is distinct from id and desde_b_partido is distinct from id);

create index partidos_desde_a_partido_idx on public.partidos (desde_a_partido) where desde_a_partido is not null;
create index partidos_desde_b_partido_idx on public.partidos (desde_b_partido) where desde_b_partido is not null;
create index partidos_desde_zona_idx on public.partidos (desde_a_zona, desde_b_zona);

-- ---------------------------------------------------------------------
-- Posiciones por puntos (configurables por categoría)
-- Orden: puntos, diferencia de gol, goles a favor.
-- ---------------------------------------------------------------------

drop view public.posiciones;

create view public.posiciones
with (security_invoker = true) as
with resultados as (
  select p.equipo_a_id as equipo_id, p.goles_a as gf, p.goles_b as gc
  from public.partidos p
  where p.estado = 'jugado' and p.fase = 'grupos' and p.categoria_id is not null
  union all
  select p.equipo_b_id, p.goles_b, p.goles_a
  from public.partidos p
  where p.estado = 'jugado' and p.fase = 'grupos' and p.categoria_id is not null
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
    count(*) filter (where r.gf = r.gc)::integer as pe,
    count(*) filter (where r.gf < r.gc)::integer as pp,
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
  (t.pg * c.puntos_victoria + t.pe * c.puntos_empate + t.pp * c.puntos_derrota)::integer as pts,
  row_number() over (
    partition by t.categoria_id, t.zona_id
    order by (t.pg * c.puntos_victoria + t.pe * c.puntos_empate + t.pp * c.puntos_derrota) desc,
             (t.gf - t.gc) desc, t.gf desc, t.equipo
  )::integer as posicion
from tabla t
join public.torneo_categorias c on c.id = t.categoria_id;

-- Una zona está terminada cuando tiene partidos de grupos y están todos jugados.
create or replace function public.zona_terminada(p_zona_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from public.partidos where zona_id = p_zona_id and fase = 'grupos')
     and not exists (
       select 1 from public.partidos where zona_id = p_zona_id and fase = 'grupos' and estado <> 'jugado'
     );
$$;

-- ---------------------------------------------------------------------
-- Validaciones del partido (amplía la de la migración 000008)
-- ---------------------------------------------------------------------

create or replace function public.tg_validar_partido()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_tipo public.tipo_actividad;
  v_equipo uuid;
  v_cat uuid;
  v_zona uuid;
begin
  select tipo into v_tipo from public.actividades where id = new.actividad_id;
  if v_tipo = 'clase' then
    raise exception 'Las clases no tienen partidos.';
  end if;
  if v_tipo = 'torneo' and new.categoria_id is null then
    raise exception 'Elegí la categoría del partido.';
  end if;
  if v_tipo = 'practica' and (new.categoria_id is not null or new.zona_id is not null) then
    raise exception 'Los partidos de práctica no tienen categoría ni zona.';
  end if;
  if v_tipo = 'practica' and (new.desde_a_partido is not null or new.desde_b_partido is not null
                              or new.desde_a_zona is not null or new.desde_b_zona is not null) then
    raise exception 'Los partidos de práctica no tienen llave.';
  end if;

  if v_tipo = 'torneo' then
    -- Los equipos tienen que ser de la categoría (y de la zona, en fase de grupos).
    foreach v_equipo in array array[new.equipo_a_id, new.equipo_b_id] loop
      continue when v_equipo is null;
      select categoria_id, zona_id into v_cat, v_zona from public.equipos where id = v_equipo;
      if v_cat is distinct from new.categoria_id then
        raise exception 'Los dos equipos tienen que ser de la categoría del partido.';
      end if;
      if new.fase = 'grupos' and new.zona_id is not null and v_zona is distinct from new.zona_id then
        raise exception 'Los dos equipos tienen que ser de la zona del partido.';
      end if;
    end loop;

    -- En eliminación no hay empate.
    if new.estado = 'jugado' and new.fase <> 'grupos' and new.goles_a = new.goles_b then
      raise exception 'En la llave no puede haber empate: cargá el gol del desempate.';
    end if;

    -- Los orígenes tienen que ser del mismo torneo.
    if (new.desde_a_partido is not null and not exists (
          select 1 from public.partidos where id = new.desde_a_partido and actividad_id = new.actividad_id))
       or (new.desde_b_partido is not null and not exists (
          select 1 from public.partidos where id = new.desde_b_partido and actividad_id = new.actividad_id)) then
      raise exception 'El partido de origen no es de este torneo.';
    end if;
    if (new.desde_a_zona is not null and not exists (
          select 1 from public.torneo_zonas z join public.torneo_categorias c on c.id = z.categoria_id
          where z.id = new.desde_a_zona and c.actividad_id = new.actividad_id))
       or (new.desde_b_zona is not null and not exists (
          select 1 from public.torneo_zonas z join public.torneo_categorias c on c.id = z.categoria_id
          where z.id = new.desde_b_zona and c.actividad_id = new.actividad_id)) then
      raise exception 'La zona de origen no es de este torneo.';
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Avance automático
-- Antes de guardar un partido que todavía no se jugó, sus equipos se calculan
-- desde el origen de cada lado. Cuando cambia un resultado, se recalculan los
-- partidos que dependen de él (por partido o por zona).
-- ---------------------------------------------------------------------

create or replace function public.equipo_desde_origen(
  p_partido uuid,
  p_resultado text,
  p_zona uuid,
  p_puesto smallint
)
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_origen public.partidos;
  v_equipo uuid;
begin
  if p_partido is not null then
    select * into v_origen from public.partidos where id = p_partido;
    if v_origen.estado <> 'jugado' or v_origen.goles_a = v_origen.goles_b then
      return null;
    end if;
    if (v_origen.goles_a > v_origen.goles_b) = (p_resultado = 'ganador') then
      return v_origen.equipo_a_id;
    end if;
    return v_origen.equipo_b_id;
  end if;

  if p_zona is not null then
    if not public.zona_terminada(p_zona) then
      return null;
    end if;
    select equipo_id into v_equipo from public.posiciones where zona_id = p_zona and posicion = p_puesto;
    return v_equipo;
  end if;

  return null;
end;
$$;

create or replace function public.tg_partido_resolver_origen()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.estado = 'jugado' then
    return new;
  end if;
  if new.desde_a_partido is not null or new.desde_a_zona is not null then
    new.equipo_a_id := public.equipo_desde_origen(new.desde_a_partido, new.desde_a_resultado, new.desde_a_zona, new.desde_a_puesto);
  end if;
  if new.desde_b_partido is not null or new.desde_b_zona is not null then
    new.equipo_b_id := public.equipo_desde_origen(new.desde_b_partido, new.desde_b_resultado, new.desde_b_zona, new.desde_b_puesto);
  end if;
  return new;
end;
$$;

-- Se ejecuta antes que la validación (los triggers corren en orden alfabético).
create trigger partidos_a_resolver_origen
  before insert or update on public.partidos
  for each row execute function public.tg_partido_resolver_origen();

create or replace function public.tg_partido_avanzar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and new.estado is not distinct from old.estado
     and new.goles_a is not distinct from old.goles_a
     and new.goles_b is not distinct from old.goles_b
     and new.equipo_a_id is not distinct from old.equipo_a_id
     and new.equipo_b_id is not distinct from old.equipo_b_id then
    return null;
  end if;

  -- Partidos que esperan al ganador o perdedor de este.
  update public.partidos set updated_at = now()
    where estado <> 'jugado' and (desde_a_partido = new.id or desde_b_partido = new.id);

  -- Partidos que esperan las posiciones de esta zona.
  if new.zona_id is not null and new.fase = 'grupos' then
    update public.partidos set updated_at = now()
      where estado <> 'jugado' and (desde_a_zona = new.zona_id or desde_b_zona = new.zona_id);
  end if;

  return null;
end;
$$;

create trigger partidos_avanzar
  after insert or update on public.partidos
  for each row execute function public.tg_partido_avanzar();

-- Si cambia la zona de un equipo, sus posiciones también.
create or replace function public.tg_equipo_zona_avanzar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.partidos set updated_at = now()
    where estado <> 'jugado'
      and (desde_a_zona in (old.zona_id, new.zona_id) or desde_b_zona in (old.zona_id, new.zona_id));
  return null;
end;
$$;

create trigger equipos_zona_avanzar
  after update of zona_id on public.equipos
  for each row
  when (new.zona_id is distinct from old.zona_id)
  execute function public.tg_equipo_zona_avanzar();

-- ---------------------------------------------------------------------
-- Goleadores: tienen que jugar en uno de los dos equipos del partido
-- ---------------------------------------------------------------------

create or replace function public.tg_validar_goleador()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.partidos p
    join public.participaciones pa on pa.actividad_id = p.actividad_id and pa.jugador_id = new.jugador_id
    where p.id = new.partido_id and pa.equipo_id in (p.equipo_a_id, p.equipo_b_id)
  ) then
    raise exception 'El goleador tiene que jugar en uno de los dos equipos del partido.';
  end if;
  return new;
end;
$$;

create trigger goleadores_validar
  before insert or update on public.goleadores
  for each row execute function public.tg_validar_goleador();

-- ---------------------------------------------------------------------
-- Rotación "a la americana" (prácticas): quién descansa en cada chukker
-- ---------------------------------------------------------------------

create table public.partido_descansos (
  partido_id uuid not null references public.partidos (id) on delete cascade,
  jugador_id uuid not null references public.jugadores (id),
  chukker smallint not null check (chukker between 1 and 8),
  primary key (partido_id, jugador_id, chukker)
);

alter table public.partido_descansos enable row level security;
create policy partido_descansos_all on public.partido_descansos
  for all to authenticated using (public.es_admin()) with check (public.es_admin());
grant select, insert, update, delete on public.partido_descansos to authenticated, service_role;

create or replace function public.tg_validar_descanso()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_chukkers smallint;
begin
  select chukkers into v_chukkers from public.partidos where id = new.partido_id;
  if new.chukker > v_chukkers then
    raise exception 'El partido tiene % chukkers.', v_chukkers;
  end if;
  if not exists (
    select 1
    from public.partidos p
    join public.participaciones pa on pa.actividad_id = p.actividad_id and pa.jugador_id = new.jugador_id
    where p.id = new.partido_id and pa.equipo_id in (p.equipo_a_id, p.equipo_b_id)
  ) then
    raise exception 'El jugador no juega en ninguno de los dos equipos del partido.';
  end if;
  return new;
end;
$$;

create trigger partido_descansos_validar
  before insert or update on public.partido_descansos
  for each row execute function public.tg_validar_descanso();

-- Reemplaza la rotación completa de un partido.
create or replace function public.guardar_descansos(p_partido_id uuid, p_descansos jsonb)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_cantidad integer;
begin
  delete from public.partido_descansos where partido_id = p_partido_id;
  insert into public.partido_descansos (partido_id, jugador_id, chukker)
    select p_partido_id, (d ->> 'jugador_id')::uuid, (d ->> 'chukker')::smallint
    from jsonb_array_elements(coalesce(p_descansos, '[]'::jsonb)) as d;
  get diagnostics v_cantidad = row_count;
  return v_cantidad;
end;
$$;

-- Cargar resultado con goleadores en una sola transacción.
create or replace function public.guardar_resultado(
  p_partido_id uuid,
  p_goles_a smallint,
  p_goles_b smallint,
  p_goles_chukkers jsonb default null,
  p_goleadores jsonb default '[]'::jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.partidos
    set goles_a = p_goles_a,
        goles_b = p_goles_b,
        goles_chukkers = case when p_goles_a is null then null else p_goles_chukkers end,
        estado = case when p_goles_a is null or p_goles_b is null then 'programado' else 'jugado' end::public.estado_partido
    where id = p_partido_id;
  if not found then
    raise exception 'El partido no existe.';
  end if;

  delete from public.goleadores where partido_id = p_partido_id;
  if p_goles_a is not null then
    insert into public.goleadores (partido_id, jugador_id, cantidad)
      select p_partido_id, (g ->> 'jugador_id')::uuid, (g ->> 'cantidad')::smallint
      from jsonb_array_elements(coalesce(p_goleadores, '[]'::jsonb)) as g
      where (g ->> 'cantidad')::smallint > 0;
  end if;
end;
$$;

revoke execute on function public.guardar_descansos(uuid, jsonb) from anon, public;
revoke execute on function public.guardar_resultado(uuid, smallint, smallint, jsonb, jsonb) from anon, public;
revoke execute on function public.zona_terminada(uuid) from anon, public;
revoke execute on function public.equipo_desde_origen(uuid, text, uuid, smallint) from anon, public;
grant execute on function public.guardar_descansos(uuid, jsonb) to authenticated, service_role;
grant execute on function public.guardar_resultado(uuid, smallint, smallint, jsonb, jsonb) to authenticated, service_role;
grant execute on function public.zona_terminada(uuid) to authenticated, service_role;
grant execute on function public.equipo_desde_origen(uuid, text, uuid, smallint) to authenticated, service_role;
grant select on public.posiciones to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Datos existentes: los cruces cargados como texto "Ganador Zona X" pasan a
-- esperar al 1.º de esa zona, y esas categorías quedan como "zonas y llave".
-- ---------------------------------------------------------------------

update public.partidos p
  set desde_a_zona = z.id, desde_a_puesto = 1, placeholder_a = null
  from public.torneo_zonas z
  where z.categoria_id = p.categoria_id
    and p.estado <> 'jugado' and p.equipo_a_id is null and p.desde_a_zona is null
    and lower(p.placeholder_a) = lower('Ganador ' || z.nombre);

update public.partidos p
  set desde_b_zona = z.id, desde_b_puesto = 1, placeholder_b = null
  from public.torneo_zonas z
  where z.categoria_id = p.categoria_id
    and p.estado <> 'jugado' and p.equipo_b_id is null and p.desde_b_zona is null
    and lower(p.placeholder_b) = lower('Ganador ' || z.nombre);

update public.torneo_categorias c
  set formato = 'zonas_llave'
  where exists (select 1 from public.torneo_zonas z where z.categoria_id = c.id)
    and exists (select 1 from public.partidos p where p.categoria_id = c.id and p.fase <> 'grupos');
