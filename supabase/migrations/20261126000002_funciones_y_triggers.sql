-- =====================================================================
-- Funciones, triggers y reglas de negocio
-- =====================================================================

-- ---------------------------------------------------------------------
-- Acceso
-- ---------------------------------------------------------------------

-- Todo usuario autenticado con perfil es admin.
create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.perfiles where id = (select auth.uid()));
$$;

-- ---------------------------------------------------------------------
-- Auditoría genérica
-- ---------------------------------------------------------------------

create or replace function public.tg_set_created_by()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_by := coalesce(new.created_by, auth.uid());
  return new;
end;
$$;

create or replace function public.tg_set_updated()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger jugadores_created_by before insert on public.jugadores
  for each row execute function public.tg_set_created_by();
create trigger jugadores_updated before update on public.jugadores
  for each row execute function public.tg_set_updated();

create trigger jugador_documentos_created_by before insert on public.jugador_documentos
  for each row execute function public.tg_set_created_by();

create trigger configuracion_updated before update on public.configuracion
  for each row execute function public.tg_set_updated();

create trigger actividades_created_by before insert on public.actividades
  for each row execute function public.tg_set_created_by();
create trigger actividades_updated before update on public.actividades
  for each row execute function public.tg_set_updated();

create trigger equipos_created_by before insert on public.equipos
  for each row execute function public.tg_set_created_by();

create trigger participaciones_created_by before insert on public.participaciones
  for each row execute function public.tg_set_created_by();

create trigger partidos_updated before update on public.partidos
  for each row execute function public.tg_set_updated();

create trigger cobros_created_by before insert on public.cobros
  for each row execute function public.tg_set_created_by();
create trigger cobros_updated before update on public.cobros
  for each row execute function public.tg_set_updated();

create trigger links_pago_created_by before insert on public.links_pago
  for each row execute function public.tg_set_created_by();
create trigger links_pago_updated before update on public.links_pago
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------
-- Jugadores: historial de hándicap
-- ---------------------------------------------------------------------

create or replace function public.tg_handicap_historial()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.handicap is distinct from old.handicap then
    insert into public.handicap_historial (jugador_id, handicap_anterior, handicap_nuevo, created_by)
    values (
      new.id,
      case when tg_op = 'UPDATE' then old.handicap end,
      new.handicap,
      auth.uid()
    );
  end if;
  return null;
end;
$$;

create trigger jugadores_handicap_historial
  after insert or update of handicap on public.jugadores
  for each row execute function public.tg_handicap_historial();

-- ---------------------------------------------------------------------
-- Cuota social: el cambio de monto rige desde el mes siguiente
-- ---------------------------------------------------------------------

create or replace function public.tg_cuota_social_historial()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.cuota_social_monto is distinct from old.cuota_social_monto then
    insert into public.cuota_social_historial (monto, vigente_desde, created_by)
    values (
      new.cuota_social_monto,
      case
        -- La configuración inicial rige desde el mes en curso.
        when tg_op = 'INSERT' then date_trunc('month', public.hoy_ar())::date
        else (date_trunc('month', public.hoy_ar()) + interval '1 month')::date
      end,
      auth.uid()
    );
  end if;
  return null;
end;
$$;

create trigger configuracion_cuota_historial
  after insert or update of cuota_social_monto on public.configuracion
  for each row execute function public.tg_cuota_social_historial();

create or replace function public.monto_cuota_social(p_periodo text)
returns numeric
language sql
stable
set search_path = ''
as $$
  select h.monto
  from public.cuota_social_historial h
  where h.vigente_desde <= to_date(p_periodo || '-01', 'YYYY-MM-DD')
  order by h.vigente_desde desc, h.created_at desc
  limit 1;
$$;

create or replace function public.nombre_periodo(p_periodo text)
returns text
language sql
immutable
set search_path = ''
as $$
  select (array[
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ])[split_part(p_periodo, '-', 2)::int] || ' ' || split_part(p_periodo, '-', 1);
$$;

-- Genera la cuota social del periodo para todos los socios activos. Idempotente.
create or replace function public.generar_cuotas_sociales(p_periodo text default null)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_periodo text := coalesce(p_periodo, to_char(public.hoy_ar(), 'YYYY-MM'));
  v_monto numeric;
  v_dia smallint;
  v_vencimiento date;
  v_cantidad integer;
begin
  if v_periodo !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Periodo inválido: %. Usá el formato AAAA-MM.', v_periodo;
  end if;

  v_monto := public.monto_cuota_social(v_periodo);
  if v_monto is null then
    raise exception 'No hay un monto de cuota social vigente para %.', public.nombre_periodo(v_periodo);
  end if;

  select cuota_social_dia_vencimiento into v_dia from public.configuracion;
  v_vencimiento := to_date(v_periodo || '-01', 'YYYY-MM-DD') + (coalesce(v_dia, 10) - 1);

  insert into public.cobros (jugador_id, concepto, descripcion, periodo, monto, vencimiento, estado)
  select
    j.id,
    'cuota_social',
    'Cuota social ' || public.nombre_periodo(v_periodo),
    v_periodo,
    v_monto,
    v_vencimiento,
    case when v_vencimiento < public.hoy_ar() then 'vencido' else 'pendiente' end::public.estado_cobro
  from public.jugadores j
  where j.tipo = 'socio' and j.activo
  on conflict (jugador_id, periodo) where concepto = 'cuota_social' do nothing;

  get diagnostics v_cantidad = row_count;
  return v_cantidad;
end;
$$;

-- ---------------------------------------------------------------------
-- Actividades: validaciones
-- ---------------------------------------------------------------------

create or replace function public.tg_validar_actividad()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.profesor_id is not null
     and (tg_op = 'INSERT' or new.profesor_id is distinct from old.profesor_id) then
    if not exists (
      select 1 from public.jugadores where id = new.profesor_id and es_profesor and activo
    ) then
      raise exception 'El profesor elegido no está marcado como profesor o está inactivo.';
    end if;
  end if;
  return new;
end;
$$;

create trigger actividades_validar
  before insert or update on public.actividades
  for each row execute function public.tg_validar_actividad();

create or replace function public.tg_validar_participacion()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_actividad public.actividades;
begin
  select * into v_actividad from public.actividades where id = new.actividad_id;

  if tg_op = 'INSERT' then
    if v_actividad.estado = 'cancelada' then
      raise exception 'No se pueden agregar jugadores a una actividad cancelada.';
    end if;
    if not exists (select 1 from public.jugadores where id = new.jugador_id and activo) then
      raise exception 'El jugador está inactivo.';
    end if;
  end if;

  if v_actividad.profesor_id = new.jugador_id then
    raise exception 'El profesor de la clase no puede anotarse como alumno.';
  end if;

  return new;
end;
$$;

create trigger participaciones_validar
  before insert or update on public.participaciones
  for each row execute function public.tg_validar_participacion();

-- ---------------------------------------------------------------------
-- Cobros automáticos por actividad
-- ---------------------------------------------------------------------

-- Crea el cobro de una participación si corresponde (precio > 0, actividad no cancelada
-- y sin un cobro vigente). Devuelve true si lo creó.
create or replace function public.crear_cobro_participacion(p_participacion_id uuid)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_part public.participaciones;
  v_act public.actividades;
  v_dias smallint;
begin
  select * into v_part from public.participaciones where id = p_participacion_id;
  select * into v_act from public.actividades where id = v_part.actividad_id;

  if v_act.precio <= 0 or v_act.estado = 'cancelada' then
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
    v_act.precio,
    greatest((v_act.inicio at time zone 'America/Argentina/Buenos_Aires')::date, public.hoy_ar())
      + coalesce(v_dias, 7),
    case when v_part.bonificado then 'bonificado' else 'pendiente' end::public.estado_cobro
  );

  return true;
end;
$$;

create or replace function public.tg_participacion_cobro()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.crear_cobro_participacion(new.id);
    return null;
  end if;

  if tg_op = 'UPDATE' then
    if new.bonificado and not old.bonificado then
      update public.cobros
        set estado = 'bonificado'
        where participacion_id = new.id and estado in ('pendiente', 'vencido');
    elsif old.bonificado and not new.bonificado then
      update public.cobros
        set estado = case when vencimiento < public.hoy_ar() then 'vencido' else 'pendiente' end::public.estado_cobro
        where participacion_id = new.id and estado = 'bonificado';
    end if;
    return null;
  end if;

  -- DELETE (before): se anula lo que no se pagó.
  update public.cobros
    set estado = 'anulado',
        nota = concat_ws(' · ', nullif(nota, ''), 'Jugador quitado de la actividad')
    where participacion_id = old.id and estado in ('pendiente', 'vencido', 'bonificado');
  return old;
end;
$$;

create trigger participaciones_cobro_ins
  after insert on public.participaciones
  for each row execute function public.tg_participacion_cobro();

create trigger participaciones_cobro_upd
  after update of bonificado on public.participaciones
  for each row execute function public.tg_participacion_cobro();

create trigger participaciones_cobro_del
  before delete on public.participaciones
  for each row execute function public.tg_participacion_cobro();

-- Cambios en la actividad que afectan a los cobros: cancelación, reactivación y precio.
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
      update public.cobros
        set estado = 'anulado',
            nota = concat_ws(' · ', nullif(nota, ''), 'La actividad pasó a ser sin cargo')
        where actividad_id = new.id and participacion_id is not null
          and estado in ('pendiente', 'vencido', 'bonificado');
    else
      update public.cobros
        set monto = new.precio
        where actividad_id = new.id and participacion_id is not null
          and estado in ('pendiente', 'vencido', 'bonificado')
          and monto <> new.precio;
    end if;
  end if;

  -- Reactivación o precio que pasa de 0 a > 0: se crean los cobros que falten.
  if (old.estado = 'cancelada' or old.precio = 0) and new.precio > 0 then
    for v_part_id in select id from public.participaciones where actividad_id = new.id loop
      perform public.crear_cobro_participacion(v_part_id);
    end loop;
  end if;

  return null;
end;
$$;

create trigger actividades_cobros
  after update of estado, precio on public.actividades
  for each row execute function public.tg_actividad_cobros();

-- ---------------------------------------------------------------------
-- Cobros: validaciones, eventos e invalidación de links
-- ---------------------------------------------------------------------

create or replace function public.tg_validar_cobro()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- "Pagado por Mercado Pago" solo lo puede marcar el webhook (service role), nunca un usuario.
  if new.estado = 'pagado' and new.medio_pago = 'mercadopago'
     and current_user in ('authenticated', 'anon')
     and (tg_op = 'INSERT' or old.estado <> 'pagado' or old.medio_pago is distinct from 'mercadopago') then
    raise exception 'Un cobro solo se marca pagado por Mercado Pago cuando llega la confirmación del pago.';
  end if;

  if tg_op = 'UPDATE' then
    if old.estado = 'pagado' and old.medio_pago = 'mercadopago' and new.estado <> 'pagado'
       and current_user in ('authenticated', 'anon') then
      raise exception 'Un cobro pagado por Mercado Pago no se puede modificar.';
    end if;

    if new.monto <> old.monto and old.estado not in ('pendiente', 'vencido', 'bonificado') then
      raise exception 'Solo se puede cambiar el monto de un cobro pendiente.';
    end if;

    if new.jugador_id <> old.jugador_id then
      raise exception 'No se puede cambiar el jugador de un cobro.';
    end if;

    -- Si vuelve a estar impago, se limpian los datos del pago.
    if new.estado in ('pendiente', 'vencido') and old.estado = 'pagado' then
      new.medio_pago := null;
      new.pagado_at := null;
    end if;
  end if;

  return new;
end;
$$;

create trigger cobros_validar
  before insert or update on public.cobros
  for each row execute function public.tg_validar_cobro();

create or replace function public.tg_cobro_eventos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tipo public.tipo_evento_cobro;
  v_detalle text;
begin
  if tg_op = 'INSERT' then
    insert into public.cobro_eventos (cobro_id, tipo, detalle, usuario_id)
    values (
      new.id,
      'creado',
      new.descripcion || ' · $' || to_char(new.monto, 'FM999G999G990D00'),
      auth.uid()
    );
    if new.estado <> 'pendiente' then
      insert into public.cobro_eventos (cobro_id, tipo, usuario_id)
      values (new.id, new.estado::text::public.tipo_evento_cobro, auth.uid());
    end if;
    return null;
  end if;

  if new.monto <> old.monto then
    insert into public.cobro_eventos (cobro_id, tipo, detalle, usuario_id)
    values (
      new.id,
      'monto_modificado',
      '$' || to_char(old.monto, 'FM999G999G990D00') || ' → $' || to_char(new.monto, 'FM999G999G990D00'),
      auth.uid()
    );
  end if;

  if new.estado <> old.estado then
    v_tipo := case new.estado
      when 'pendiente' then 'reactivado'
      else new.estado::text::public.tipo_evento_cobro
    end;
    v_detalle := case
      when new.estado = 'pagado' then concat_ws(' · ', new.medio_pago::text, nullif(new.nota, ''))
      when new.estado in ('anulado', 'bonificado') then nullif(new.nota, '')
    end;
    insert into public.cobro_eventos (cobro_id, tipo, detalle, usuario_id)
    values (new.id, v_tipo, v_detalle, auth.uid());
  end if;

  return null;
end;
$$;

create trigger cobros_eventos
  after insert or update on public.cobros
  for each row execute function public.tg_cobro_eventos();

-- Si un cobro cambia de monto o deja de estar impago, sus links activos dejan de servir.
create or replace function public.tg_cobro_invalidar_links()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motivo text;
  v_link_id uuid;
begin
  if new.monto <> old.monto then
    v_motivo := 'Cambió el monto de un cobro del link';
  elsif new.estado <> old.estado and new.estado not in ('pendiente', 'vencido') then
    v_motivo := 'Un cobro del link pasó a ' || new.estado::text;
  else
    return null;
  end if;

  for v_link_id in
    update public.links_pago l
      set estado = 'anulado'
      where l.estado = 'activo'
        and exists (select 1 from public.link_pago_cobros lpc where lpc.link_id = l.id and lpc.cobro_id = new.id)
      returning l.id
  loop
    insert into public.cobro_eventos (cobro_id, link_id, tipo, detalle, usuario_id)
    select lpc.cobro_id, v_link_id, 'link_invalidado', v_motivo, auth.uid()
    from public.link_pago_cobros lpc
    where lpc.link_id = v_link_id;
  end loop;

  return null;
end;
$$;

create trigger cobros_invalidar_links
  after update of monto, estado on public.cobros
  for each row execute function public.tg_cobro_invalidar_links();

-- Marca vencidos los cobros pendientes con fecha pasada y los links expirados.
create or replace function public.procesar_vencimientos()
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_cobros integer;
  v_links integer;
begin
  update public.cobros
    set estado = 'vencido'
    where estado = 'pendiente' and vencimiento < public.hoy_ar();
  get diagnostics v_cobros = row_count;

  update public.links_pago
    set estado = 'vencido'
    where estado = 'activo' and expira_at < now();
  get diagnostics v_links = row_count;

  return jsonb_build_object('cobros_vencidos', v_cobros, 'links_vencidos', v_links);
end;
$$;

-- ---------------------------------------------------------------------
-- Links de pago
-- ---------------------------------------------------------------------

-- Crea (o reutiliza) un link de pago para uno o varios cobros impagos del mismo jugador.
-- La preferencia de Mercado Pago la crea después el servidor y la guarda en el link.
create or replace function public.crear_link_pago(p_cobro_ids uuid[])
returns public.links_pago
language plpgsql
set search_path = ''
as $$
declare
  v_jugadores integer;
  v_impagos integer;
  v_total numeric;
  v_jugador_id uuid;
  v_link public.links_pago;
  v_dias smallint;
begin
  if p_cobro_ids is null or cardinality(p_cobro_ids) = 0 then
    raise exception 'Elegí al menos un cobro.';
  end if;

  select count(distinct jugador_id), count(*) filter (where estado in ('pendiente', 'vencido')),
         sum(monto), min(jugador_id::text)::uuid
    into v_jugadores, v_impagos, v_total, v_jugador_id
    from public.cobros
    where id = any (p_cobro_ids);

  if v_impagos <> cardinality(p_cobro_ids) then
    raise exception 'Solo se pueden incluir cobros pendientes o vencidos.';
  end if;
  if v_jugadores <> 1 then
    raise exception 'Todos los cobros del link tienen que ser del mismo jugador.';
  end if;

  -- Reutiliza un link activo con exactamente los mismos cobros.
  select l.* into v_link
    from public.links_pago l
    where l.estado = 'activo'
      and l.expira_at > now()
      and l.jugador_id = v_jugador_id
      and (select array_agg(lpc.cobro_id order by lpc.cobro_id) from public.link_pago_cobros lpc where lpc.link_id = l.id)
          = (select array_agg(x order by x) from unnest(p_cobro_ids) x)
    order by l.created_at desc
    limit 1;

  if found then
    return v_link;
  end if;

  select dias_validez_link into v_dias from public.configuracion;

  insert into public.links_pago (jugador_id, monto_total, expira_at)
    values (v_jugador_id, v_total, now() + make_interval(days => coalesce(v_dias, 30)))
    returning * into v_link;

  insert into public.link_pago_cobros (link_id, cobro_id, monto)
    select v_link.id, c.id, c.monto from public.cobros c where c.id = any (p_cobro_ids);

  insert into public.cobro_eventos (cobro_id, link_id, tipo, usuario_id)
    select c, v_link.id, 'link_generado', auth.uid() from unnest(p_cobro_ids) c;

  return v_link;
end;
$$;

-- Lectura pública de un link (solo desde el servidor con service role).
create or replace function public.pago_publico(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'link_id', l.id,
    'estado', case when l.estado = 'activo' and l.expira_at < now() then 'vencido' else l.estado::text end,
    'monto_total', l.monto_total,
    'jugador', j.nombre || ' ' || j.apellido,
    'expira_at', l.expira_at,
    'pagado_at', l.pagado_at,
    'mp_preference_id', l.mp_preference_id,
    'mp_init_point', l.mp_init_point,
    'items', (
      select jsonb_agg(jsonb_build_object('descripcion', c.descripcion, 'monto', lpc.monto) order by c.vencimiento, c.descripcion)
      from public.link_pago_cobros lpc
      join public.cobros c on c.id = lpc.cobro_id
      where lpc.link_id = l.id
    )
  )
  from public.links_pago l
  join public.jugadores j on j.id = l.jugador_id
  where l.token = p_token;
$$;

-- Aplica un pago informado por Mercado Pago. Idempotente por mp_payment_id.
-- Devuelve: aplicado | ya_procesado | no_aprobado | a_revisar | link_inexistente
create or replace function public.registrar_pago_mp(
  p_payment_id text,
  p_link_id uuid,
  p_status text,
  p_monto numeric,
  p_payload jsonb
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.links_pago;
  v_previo text;
  v_resultado text;
  v_impagos boolean;
  v_total_actual numeric;
begin
  -- Serializa los pagos del mismo link.
  if p_link_id is not null then
    select * into v_link from public.links_pago where id = p_link_id for update;
  end if;

  select resultado into v_previo from public.pagos_mp where mp_payment_id = p_payment_id for update;
  if v_previo in ('aplicado', 'a_revisar') then
    return 'ya_procesado';
  end if;

  if p_status <> 'approved' then
    v_resultado := 'no_aprobado';
  elsif v_link.id is null then
    v_resultado := 'link_inexistente';
  else
    select coalesce(bool_and(c.estado in ('pendiente', 'vencido')), false), coalesce(sum(c.monto), 0)
      into v_impagos, v_total_actual
      from public.link_pago_cobros lpc
      join public.cobros c on c.id = lpc.cobro_id
      where lpc.link_id = v_link.id;

    if v_link.estado = 'pagado' or not v_impagos
       or (p_monto is not null and p_monto < v_total_actual) then
      -- Pago duplicado, sobre cobros ya cancelados o por un monto menor: se registra para revisar.
      v_resultado := 'a_revisar';
      insert into public.cobro_eventos (cobro_id, link_id, tipo, detalle)
        select lpc.cobro_id, v_link.id, 'pago_a_revisar',
               'Pago MP ' || p_payment_id || ' por $' || coalesce(to_char(p_monto, 'FM999G999G990D00'), '?')
               || ' — revisar posible devolución'
        from public.link_pago_cobros lpc
        where lpc.link_id = v_link.id;
    else
      -- Aunque el link haya vencido o se haya invalidado, el dinero entró: se aplica.
      update public.links_pago
        set estado = 'pagado', mp_payment_id = p_payment_id, pagado_at = now()
        where id = v_link.id;

      update public.cobros
        set estado = 'pagado', medio_pago = 'mercadopago', pagado_at = now(), mp_payment_id = p_payment_id
        where id in (select cobro_id from public.link_pago_cobros where link_id = v_link.id);

      v_resultado := 'aplicado';
    end if;
  end if;

  insert into public.pagos_mp (mp_payment_id, link_id, status, monto, resultado, payload)
    values (p_payment_id, v_link.id, p_status, p_monto, v_resultado, p_payload)
    on conflict (mp_payment_id) do update
      set status = excluded.status,
          monto = excluded.monto,
          resultado = excluded.resultado,
          payload = excluded.payload,
          link_id = excluded.link_id;

  return v_resultado;
end;
$$;

-- ---------------------------------------------------------------------
-- Búsqueda aproximada de jugadores (pg_trgm)
-- ---------------------------------------------------------------------

create or replace function public.buscar_jugadores(
  p_texto text,
  p_solo_activos boolean default true,
  p_limite integer default 10
)
returns table (
  id uuid,
  nombre text,
  apellido text,
  dni text,
  handicap smallint,
  tipo public.tipo_jugador,
  club_origen text,
  activo boolean,
  es_profesor boolean,
  similitud real
)
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  with q as (select public.normalizar_texto(trim(p_texto)) as t)
  select j.id, j.nombre, j.apellido, j.dni, j.handicap, j.tipo, j.club_origen, j.activo, j.es_profesor,
         greatest(similarity(j.busqueda, q.t), word_similarity(q.t, j.busqueda)) as similitud
  from public.jugadores j, q
  where length(q.t) > 0
    and (not p_solo_activos or j.activo)
    and (
      j.busqueda like '%' || q.t || '%'
      or greatest(similarity(j.busqueda, q.t), word_similarity(q.t, j.busqueda)) >= 0.35
    )
  order by (j.busqueda like q.t || '%') desc, similitud desc, j.apellido, j.nombre
  limit p_limite;
$$;

-- Para "Agregar varios": candidatos para cada nombre pegado.
create or replace function public.buscar_jugadores_lista(
  p_textos text[],
  p_por_texto integer default 3
)
returns table (
  indice integer,
  texto text,
  id uuid,
  nombre text,
  apellido text,
  handicap smallint,
  tipo public.tipo_jugador,
  club_origen text,
  similitud real
)
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select t.indice::integer, t.texto, b.id, b.nombre, b.apellido, b.handicap, b.tipo, b.club_origen, b.similitud
  from unnest(p_textos) with ordinality as t(texto, indice)
  cross join lateral public.buscar_jugadores(t.texto, true, p_por_texto) b
  order by t.indice, b.similitud desc;
$$;

-- ---------------------------------------------------------------------
-- Torneos: "todos contra todos" por zona (o categoría sin zonas)
-- ---------------------------------------------------------------------

create or replace function public.generar_todos_contra_todos(
  p_categoria_id uuid,
  p_zona_id uuid default null
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_actividad_id uuid;
  v_cantidad integer;
begin
  select actividad_id into v_actividad_id from public.torneo_categorias where id = p_categoria_id;
  if v_actividad_id is null then
    raise exception 'La categoría no existe.';
  end if;

  with eq as (
    select e.id, e.nombre
    from public.equipos e
    where e.categoria_id = p_categoria_id
      and (e.zona_id = p_zona_id or (p_zona_id is null and e.zona_id is null))
  ),
  pares as (
    select a.id as a_id, b.id as b_id, row_number() over (order by a.nombre, b.nombre) as n
    from eq a join eq b on a.id < b.id
    -- No se duplican cruces que ya existen.
    where not exists (
      select 1 from public.partidos p
      where p.categoria_id = p_categoria_id and p.fase = 'grupos'
        and ((p.equipo_a_id = a.id and p.equipo_b_id = b.id) or (p.equipo_a_id = b.id and p.equipo_b_id = a.id))
    )
  )
  insert into public.partidos (actividad_id, categoria_id, zona_id, fase, equipo_a_id, equipo_b_id, orden)
  select v_actividad_id, p_categoria_id, p_zona_id, 'grupos', a_id, b_id, n
  from pares;

  get diagnostics v_cantidad = row_count;
  return v_cantidad;
end;
$$;
