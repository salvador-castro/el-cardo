-- Etapa 3 (ajustes del cliente):
--   1. Partidos también en prácticas (cruces + resultado), con color de camiseta por partido.
--   2. Precio especial por jugador en una actividad.

-- ---------------------------------------------------------------------
-- 1. Partidos en prácticas
-- ---------------------------------------------------------------------

-- La categoría solo la tienen los partidos de torneo.
alter table public.partidos alter column categoria_id drop not null;

-- Colores de camiseta (lista fija). Cambian en cada partido.
alter table public.partidos
  add column color_a text,
  add column color_b text,
  add constraint partidos_color_a_valido check (
    color_a is null or color_a in ('blanco', 'azul', 'celeste', 'rojo', 'bordo', 'verde', 'amarillo', 'naranja', 'negro', 'gris')
  ),
  add constraint partidos_color_b_valido check (
    color_b is null or color_b in ('blanco', 'azul', 'celeste', 'rojo', 'bordo', 'verde', 'amarillo', 'naranja', 'negro', 'gris')
  );

create or replace function public.tg_validar_partido()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_tipo public.tipo_actividad;
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
  return new;
end;
$$;

create trigger partidos_validar
  before insert or update on public.partidos
  for each row execute function public.tg_validar_partido();

-- ---------------------------------------------------------------------
-- 2. Precio especial por jugador
-- ---------------------------------------------------------------------

-- null = paga el precio de la actividad.
alter table public.participaciones
  add column precio numeric(12, 2) check (precio is null or precio >= 0);

-- El cobro usa el precio especial del jugador si lo tiene.
create or replace function public.crear_cobro_participacion(p_participacion_id uuid)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_part public.participaciones;
  v_act public.actividades;
  v_precio numeric(12, 2);
  v_dias smallint;
begin
  select * into v_part from public.participaciones where id = p_participacion_id;
  select * into v_act from public.actividades where id = v_part.actividad_id;
  v_precio := coalesce(v_part.precio, v_act.precio);

  if v_precio <= 0 or v_act.estado = 'cancelada' then
    return false;
  end if;

  if exists (
    select 1 from public.cobros
    where participacion_id = v_part.id and estado <> 'anulado'
  ) then
    return false;
  end if;

  select dias_vencimiento_actividad into v_dias from public.configuracion;

  insert into public.cobros (
    jugador_id, concepto, descripcion, actividad_id, participacion_id, monto, vencimiento, estado
  ) values (
    v_part.jugador_id,
    v_act.tipo::text::public.concepto_cobro,
    v_act.nombre,
    v_act.id,
    v_part.id,
    v_precio,
    greatest((v_act.inicio at time zone 'America/Argentina/Buenos_Aires')::date, public.hoy_ar())
      + coalesce(v_dias, 7),
    case when v_part.bonificado then 'bonificado' else 'pendiente' end::public.estado_cobro
  );

  return true;
end;
$$;

-- Cambio de precio de la actividad: solo afecta a quienes no tienen precio especial.
create or replace function public.tg_actividad_cobros()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_part_id uuid;
begin
  -- Cancelación: se anulan los cobros no pagados.
  if new.estado = 'cancelada' and old.estado <> 'cancelada' then
    update public.cobros
      set estado = 'anulado',
          nota = concat_ws(' · ', nullif(nota, ''), 'Actividad cancelada')
      where actividad_id = new.id and estado in ('pendiente', 'vencido', 'bonificado');
    return null;
  end if;

  if new.estado = 'cancelada' then
    return null;
  end if;

  if new.precio is distinct from old.precio then
    if new.precio = 0 then
      update public.cobros c
        set estado = 'anulado',
            nota = concat_ws(' · ', nullif(c.nota, ''), 'La actividad pasó a ser sin cargo')
        from public.participaciones p
        where p.id = c.participacion_id and p.precio is null
          and c.actividad_id = new.id
          and c.estado in ('pendiente', 'vencido', 'bonificado');
    else
      update public.cobros c
        set monto = new.precio
        from public.participaciones p
        where p.id = c.participacion_id and p.precio is null
          and c.actividad_id = new.id
          and c.estado in ('pendiente', 'vencido', 'bonificado')
          and c.monto <> new.precio;
    end if;
  end if;

  -- Reactivación o precio que pasa de 0 a > 0: se crean los cobros que falten.
  if old.estado = 'cancelada' or (old.precio = 0 and new.precio > 0) then
    for v_part_id in select id from public.participaciones where actividad_id = new.id loop
      perform public.crear_cobro_participacion(v_part_id);
    end loop;
  end if;

  return null;
end;
$$;

-- Cambio del precio especial de un jugador: se ajusta su cobro impago (el pagado no se toca).
create or replace function public.tg_participacion_precio()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_act public.actividades;
  v_precio numeric(12, 2);
begin
  select * into v_act from public.actividades where id = new.actividad_id;
  if v_act.estado = 'cancelada' then
    return null;
  end if;
  v_precio := coalesce(new.precio, v_act.precio);

  if v_precio = 0 then
    update public.cobros
      set estado = 'anulado',
          nota = concat_ws(' · ', nullif(nota, ''), 'Sin cargo para este jugador')
      where participacion_id = new.id and estado in ('pendiente', 'vencido', 'bonificado');
  else
    update public.cobros
      set monto = v_precio
      where participacion_id = new.id and estado in ('pendiente', 'vencido', 'bonificado')
        and monto <> v_precio;
    perform public.crear_cobro_participacion(new.id);
  end if;

  return null;
end;
$$;

create trigger participaciones_precio
  after update of precio on public.participaciones
  for each row
  when (new.precio is distinct from old.precio)
  execute function public.tg_participacion_precio();

-- Para el detalle: precio especial ya pagado no se puede cambiar.
create or replace function public.tg_validar_precio_participacion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.precio is distinct from old.precio and exists (
    select 1 from public.cobros where participacion_id = new.id and estado = 'pagado'
  ) then
    raise exception 'El jugador ya pagó esta actividad: no se puede cambiar su precio.';
  end if;
  return new;
end;
$$;

create trigger participaciones_validar_precio
  before update of precio on public.participaciones
  for each row execute function public.tg_validar_precio_participacion();
