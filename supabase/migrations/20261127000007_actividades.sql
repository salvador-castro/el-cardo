-- Etapa 3: actividades (prácticas y clases), equipos y participantes.

-- ---------------------------------------------------------------------
-- Validación de la actividad: profesor y tipo
-- ---------------------------------------------------------------------

create or replace function public.tg_validar_actividad()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.tipo is distinct from old.tipo then
    raise exception 'No se puede cambiar el tipo de una actividad.';
  end if;

  if new.profesor_id is not null
     and (tg_op = 'INSERT' or new.profesor_id is distinct from old.profesor_id) then
    if not exists (
      select 1 from public.jugadores where id = new.profesor_id and es_profesor and activo
    ) then
      raise exception 'El profesor elegido no está marcado como profesor o está inactivo.';
    end if;
    if tg_op = 'UPDATE' and exists (
      select 1 from public.participaciones where actividad_id = new.id and jugador_id = new.profesor_id
    ) then
      raise exception 'El profesor elegido está anotado como alumno en esta clase. Quitalo de los alumnos primero.';
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Armar equipo: crea o renombra el equipo y deja exactamente esos jugadores.
-- Los que ya estaban en la actividad se mueven al equipo; los nuevos se anotan
-- (y se les crea el cobro por trigger). Los que salen del equipo siguen anotados,
-- sin equipo. Todo en una transacción.
-- ---------------------------------------------------------------------

create or replace function public.guardar_equipo(
  p_actividad_id uuid,
  p_nombre text,
  p_jugadores uuid[],
  p_equipo_id uuid default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_act public.actividades;
  v_id uuid;
  v_jugadores uuid[] := coalesce(p_jugadores, '{}');
begin
  select * into v_act from public.actividades where id = p_actividad_id;
  if not found then
    raise exception 'La actividad no existe.';
  end if;
  if v_act.estado = 'cancelada' then
    raise exception 'La actividad está cancelada.';
  end if;
  if v_act.tipo = 'clase' then
    raise exception 'Las clases no tienen equipos.';
  end if;
  if length(trim(coalesce(p_nombre, ''))) = 0 then
    raise exception 'Ingresá el nombre del equipo.';
  end if;

  if p_equipo_id is null then
    insert into public.equipos (actividad_id, nombre)
      values (p_actividad_id, trim(p_nombre))
      returning id into v_id;
  else
    update public.equipos set nombre = trim(p_nombre)
      where id = p_equipo_id and actividad_id = p_actividad_id
      returning id into v_id;
    if v_id is null then
      raise exception 'El equipo no existe.';
    end if;
  end if;

  -- Los que salen del equipo quedan anotados sin equipo.
  update public.participaciones set equipo_id = null
    where equipo_id = v_id and not (jugador_id = any (v_jugadores));

  -- Los que ya estaban anotados se mueven al equipo.
  update public.participaciones set equipo_id = v_id
    where actividad_id = p_actividad_id
      and jugador_id = any (v_jugadores)
      and equipo_id is distinct from v_id;

  -- Los nuevos se anotan.
  insert into public.participaciones (actividad_id, jugador_id, equipo_id)
    select p_actividad_id, j, v_id from unnest(v_jugadores) as j
    on conflict (actividad_id, jugador_id) do nothing;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Agregar varios jugadores a la vez (alumnos, "Agregar varios" de WhatsApp).
-- Los ya anotados se ignoran, salvo que se indique un equipo: en ese caso se mueven.
-- Devuelve cuántos jugadores se anotaron.
-- ---------------------------------------------------------------------

create or replace function public.agregar_participantes(
  p_actividad_id uuid,
  p_jugadores uuid[],
  p_equipo_id uuid default null
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_cantidad integer;
begin
  if p_equipo_id is not null and not exists (
    select 1 from public.equipos where id = p_equipo_id and actividad_id = p_actividad_id
  ) then
    raise exception 'El equipo no es de esta actividad.';
  end if;

  with nuevos as (
    insert into public.participaciones (actividad_id, jugador_id, equipo_id)
      select p_actividad_id, j, p_equipo_id from unnest(coalesce(p_jugadores, '{}')) as j
      on conflict (actividad_id, jugador_id) do nothing
      returning 1
  )
  select count(*) into v_cantidad from nuevos;

  if p_equipo_id is not null then
    update public.participaciones set equipo_id = p_equipo_id
      where actividad_id = p_actividad_id
        and jugador_id = any (p_jugadores)
        and equipo_id is distinct from p_equipo_id;
  end if;

  return v_cantidad;
end;
$$;

revoke execute on function public.guardar_equipo(uuid, text, uuid[], uuid) from anon, public;
revoke execute on function public.agregar_participantes(uuid, uuid[], uuid) from anon, public;
grant execute on function public.guardar_equipo(uuid, text, uuid[], uuid) to authenticated, service_role;
grant execute on function public.agregar_participantes(uuid, uuid[], uuid) to authenticated, service_role;
