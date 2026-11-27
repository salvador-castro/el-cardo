-- Etapa 5A: modelo de pagos.
--   - Un pago (efectivo, transferencia o Mercado Pago) se aplica a uno o varios cobros
--     (pago_aplicaciones), del más viejo al más nuevo. Se admiten pagos parciales.
--   - El estado de un cobro sale de lo aplicado: pagado cuando el saldo llega a 0.
--   - Si un cobro con pagos se anula (jugador quitado, actividad cancelada), lo pagado
--     queda como saldo a favor del jugador, que se puede usar o devolver.

-- ---------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------

alter table public.cobros
  add column monto_pagado numeric(12, 2) not null default 0 check (monto_pagado >= 0);

create table public.pagos (
  id uuid primary key default gen_random_uuid(),
  jugador_id uuid not null references public.jugadores (id),
  monto numeric(12, 2) not null check (monto > 0),
  medio public.medio_pago not null,
  pagado_at timestamptz not null default now(),
  nota text,
  comprobante_path text,
  mp_payment_id text unique,
  link_id uuid references public.links_pago (id),
  anulado boolean not null default false,
  anulado_motivo text,
  anulado_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references public.perfiles (id) default auth.uid()
);

create index pagos_jugador_idx on public.pagos (jugador_id, pagado_at desc);

create table public.pago_aplicaciones (
  pago_id uuid not null references public.pagos (id) on delete cascade,
  cobro_id uuid not null references public.cobros (id),
  monto numeric(12, 2) not null check (monto > 0),
  created_at timestamptz not null default now(),
  primary key (pago_id, cobro_id)
);

create index pago_aplicaciones_cobro_idx on public.pago_aplicaciones (cobro_id);

create table public.devoluciones (
  id uuid primary key default gen_random_uuid(),
  jugador_id uuid not null references public.jugadores (id),
  monto numeric(12, 2) not null check (monto > 0),
  medio public.medio_pago not null check (medio <> 'mercadopago'),
  fecha date not null default public.hoy_ar(),
  nota text,
  created_at timestamptz not null default now(),
  created_by uuid references public.perfiles (id) default auth.uid()
);

create index devoluciones_jugador_idx on public.devoluciones (jugador_id);

alter type public.tipo_evento_cobro add value if not exists 'pago_parcial';
alter type public.tipo_evento_cobro add value if not exists 'pago_anulado';

alter table public.pagos enable row level security;
alter table public.pago_aplicaciones enable row level security;
alter table public.devoluciones enable row level security;

-- Los pagos no se borran: se anulan. Las aplicaciones solo las escriben las funciones.
create policy pagos_select on public.pagos for select to authenticated using (public.es_admin());
create policy pagos_update on public.pagos for update to authenticated using (public.es_admin()) with check (public.es_admin());
create policy pago_aplicaciones_select on public.pago_aplicaciones for select to authenticated using (public.es_admin());
create policy devoluciones_select on public.devoluciones for select to authenticated using (public.es_admin());

grant select, update on public.pagos to authenticated;
grant select on public.pago_aplicaciones, public.devoluciones to authenticated;
grant all on public.pagos, public.pago_aplicaciones, public.devoluciones to service_role;

-- ---------------------------------------------------------------------
-- Datos existentes: cada cobro pagado pasa a tener su pago.
-- (Se hace antes de crear las validaciones nuevas.)
-- ---------------------------------------------------------------------

-- Pagos de Mercado Pago: uno por mp_payment_id (un link puede pagar varios cobros).
with mp as (
  select mp_payment_id, min(jugador_id::text)::uuid as jugador_id, sum(monto) as monto, max(pagado_at) as pagado_at
  from public.cobros
  where estado = 'pagado' and mp_payment_id is not null
  group by mp_payment_id
)
insert into public.pagos (jugador_id, monto, medio, pagado_at, mp_payment_id, nota, created_by)
select jugador_id, monto, 'mercadopago', pagado_at, mp_payment_id, 'Pago registrado antes del modelo de pagos', null
from mp;

insert into public.pago_aplicaciones (pago_id, cobro_id, monto)
select p.id, c.id, c.monto
from public.cobros c
join public.pagos p on p.mp_payment_id = c.mp_payment_id
where c.estado = 'pagado' and c.mp_payment_id is not null;

-- El resto: un pago por cobro.
do $$
declare
  r record;
  v_pago uuid;
begin
  for r in
    select * from public.cobros where estado = 'pagado' and mp_payment_id is null
  loop
    insert into public.pagos (jugador_id, monto, medio, pagado_at, nota, comprobante_path, created_by)
      values (r.jugador_id, r.monto, coalesce(r.medio_pago, 'efectivo'), coalesce(r.pagado_at, r.updated_at), r.nota,
              r.comprobante_path, r.updated_by)
      returning id into v_pago;
    insert into public.pago_aplicaciones (pago_id, cobro_id, monto) values (v_pago, r.id, r.monto);
  end loop;
end;
$$;

update public.cobros set monto_pagado = monto where estado = 'pagado';

-- ---------------------------------------------------------------------
-- Recálculo del cobro a partir de sus pagos
-- ---------------------------------------------------------------------

create or replace function public.recalcular_cobro(p_cobro_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_cobro public.cobros;
  v_pagado numeric(12, 2);
  v_ultimo public.pagos;
begin
  select * into v_cobro from public.cobros where id = p_cobro_id;
  if not found then
    return;
  end if;

  select coalesce(sum(pa.monto), 0) into v_pagado
    from public.pago_aplicaciones pa
    join public.pagos p on p.id = pa.pago_id and not p.anulado
    where pa.cobro_id = p_cobro_id;

  select p.* into v_ultimo
    from public.pago_aplicaciones pa
    join public.pagos p on p.id = pa.pago_id and not p.anulado
    where pa.cobro_id = p_cobro_id
    order by p.pagado_at desc, p.created_at desc
    limit 1;

  -- Habilita los cambios de estado que solo puede hacer el recálculo.
  perform set_config('app.recalculando', '1', true);

  if v_cobro.estado in ('anulado', 'bonificado') then
    update public.cobros set monto_pagado = v_pagado where id = p_cobro_id and monto_pagado <> v_pagado;
  elsif v_pagado >= v_cobro.monto then
    update public.cobros
      set monto_pagado = v_pagado,
          estado = 'pagado',
          medio_pago = v_ultimo.medio,
          pagado_at = v_ultimo.pagado_at,
          mp_payment_id = v_ultimo.mp_payment_id
      where id = p_cobro_id;
  else
    update public.cobros
      set monto_pagado = v_pagado,
          estado = case when vencimiento < public.hoy_ar() then 'vencido' else 'pendiente' end::public.estado_cobro,
          medio_pago = null,
          pagado_at = null,
          mp_payment_id = null
      where id = p_cobro_id;
  end if;

  perform set_config('app.recalculando', '0', true);
end;
$$;

create or replace function public.tg_aplicacion_recalcular()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalcular_cobro(old.cobro_id);
    return null;
  end if;
  perform public.recalcular_cobro(new.cobro_id);
  if tg_op = 'UPDATE' and old.cobro_id <> new.cobro_id then
    perform public.recalcular_cobro(old.cobro_id);
  end if;
  return null;
end;
$$;

create trigger pago_aplicaciones_recalcular
  after insert or update or delete on public.pago_aplicaciones
  for each row execute function public.tg_aplicacion_recalcular();

-- Pagos: Mercado Pago solo lo registra el sistema; se anulan pero no se borran.
create or replace function public.tg_validar_pago()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.medio = 'mercadopago' and current_user in ('authenticated', 'anon') then
    raise exception 'Los pagos de Mercado Pago se registran solos cuando llega la confirmación.';
  end if;
  if tg_op = 'UPDATE' then
    if new.monto <> old.monto or new.jugador_id <> old.jugador_id or new.medio <> old.medio then
      raise exception 'Un pago no se puede modificar: anulalo y registralo de nuevo.';
    end if;
    if old.anulado and not new.anulado then
      raise exception 'Un pago anulado no se puede reactivar.';
    end if;
    if new.anulado and not old.anulado then
      if old.medio = 'mercadopago' and current_user in ('authenticated', 'anon') then
        raise exception 'Un pago de Mercado Pago no se puede anular desde acá: hacé la devolución en Mercado Pago.';
      end if;
      new.anulado_at := now();
    end if;
  end if;
  return new;
end;
$$;

create trigger pagos_validar
  before insert or update on public.pagos
  for each row execute function public.tg_validar_pago();

create or replace function public.tg_pago_anulado()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_cobro uuid;
begin
  for v_cobro in select cobro_id from public.pago_aplicaciones where pago_id = new.id loop
    insert into public.cobro_eventos (cobro_id, tipo, detalle, usuario_id)
      values (v_cobro, 'pago_anulado',
              '$' || to_char(new.monto, 'FM999G999G990D00') || coalesce(' · ' || nullif(new.anulado_motivo, ''), ''),
              auth.uid());
    perform public.recalcular_cobro(v_cobro);
  end loop;
  return null;
end;
$$;

create trigger pagos_anulado
  after update of anulado on public.pagos
  for each row
  when (new.anulado and not old.anulado)
  execute function public.tg_pago_anulado();

-- ---------------------------------------------------------------------
-- Validación de cobros (reemplaza la de la migración 000002)
-- ---------------------------------------------------------------------

create or replace function public.tg_validar_cobro()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_recalculo boolean := coalesce(current_setting('app.recalculando', true), '0') = '1';
begin
  if tg_op = 'INSERT' then
    if new.estado = 'pagado' then
      raise exception 'Un cobro nuevo no puede estar pagado: registrá el pago después de crearlo.';
    end if;
    new.monto_pagado := 0;
    return new;
  end if;

  if new.jugador_id <> old.jugador_id then
    raise exception 'No se puede cambiar el jugador de un cobro.';
  end if;

  -- El estado "pagado" (y volver de "pagado" a impago) solo lo decide el recálculo según los pagos.
  if not v_recalculo then
    if new.monto_pagado <> old.monto_pagado then
      raise exception 'Lo pagado de un cobro se calcula con sus pagos.';
    end if;
    if new.estado = 'pagado' and old.estado <> 'pagado' then
      raise exception 'Para marcar un cobro como pagado, registrá el pago.';
    end if;
    if old.estado = 'pagado' and new.estado in ('pendiente', 'vencido') then
      raise exception 'Para que un cobro vuelva a estar impago, anulá su pago.';
    end if;
  end if;

  if new.monto <> old.monto then
    if old.estado not in ('pendiente', 'vencido', 'bonificado') then
      raise exception 'Solo se puede cambiar el monto de un cobro impago.';
    end if;
    if new.monto < new.monto_pagado then
      raise exception 'El monto no puede ser menor que lo ya pagado ($%).', to_char(new.monto_pagado, 'FM999G999G990D00');
    end if;
  end if;

  return new;
end;
$$;

-- Si cambia el monto de un cobro y ya está cubierto por sus pagos, pasa a pagado.
create or replace function public.tg_cobro_monto_recalcular()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.estado in ('pendiente', 'vencido') and new.monto_pagado > 0 and new.monto_pagado >= new.monto then
    perform public.recalcular_cobro(new.id);
  end if;
  return null;
end;
$$;

create trigger cobros_monto_recalcular
  after update of monto on public.cobros
  for each row
  when (new.monto is distinct from old.monto)
  execute function public.tg_cobro_monto_recalcular();

-- Eventos: además de los de siempre, los pagos parciales.
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
    values (new.id, 'creado', new.descripcion || ' · $' || to_char(new.monto, 'FM999G999G990D00'), auth.uid());
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

  -- Pago parcial: aumentó lo pagado pero el cobro sigue impago.
  if new.monto_pagado > old.monto_pagado and new.estado in ('pendiente', 'vencido') then
    insert into public.cobro_eventos (cobro_id, tipo, detalle, usuario_id)
    values (
      new.id,
      'pago_parcial',
      'Pagó $' || to_char(new.monto_pagado - old.monto_pagado, 'FM999G999G990D00') || ' · saldo $'
        || to_char(new.monto - new.monto_pagado, 'FM999G999G990D00'),
      auth.uid()
    );
  end if;

  if new.estado <> old.estado then
    v_tipo := case new.estado when 'pendiente' then 'reactivado' else new.estado::text::public.tipo_evento_cobro end;
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

-- Links: también dejan de servir si cambia lo pagado del cobro (pago parcial por otro medio).
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
  elsif new.monto_pagado <> old.monto_pagado then
    v_motivo := 'Se registró un pago de un cobro del link';
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

drop trigger cobros_invalidar_links on public.cobros;
create trigger cobros_invalidar_links
  after update of monto, estado, monto_pagado on public.cobros
  for each row execute function public.tg_cobro_invalidar_links();

-- ---------------------------------------------------------------------
-- Actividades: al quitar a un jugador o cancelar, también se anula lo pagado
-- (queda como saldo a favor). El cambio de precio respeta lo ya pagado.
-- ---------------------------------------------------------------------

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

  -- DELETE (before): se anula el cobro; si tenía pagos, quedan como saldo a favor.
  update public.cobros
    set estado = 'anulado',
        nota = concat_ws(' · ', nullif(nota, ''),
                         case when monto_pagado > 0 then 'Jugador quitado de la actividad: lo pagado queda a favor'
                              else 'Jugador quitado de la actividad' end)
    where participacion_id = old.id and estado in ('pendiente', 'vencido', 'bonificado', 'pagado');
  return old;
end;
$$;

create or replace function public.tg_actividad_cobros()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_part_id uuid;
begin
  -- Cancelación: se anulan los cobros; lo pagado queda como saldo a favor.
  if new.estado = 'cancelada' and old.estado <> 'cancelada' then
    update public.cobros
      set estado = 'anulado',
          nota = concat_ws(' · ', nullif(nota, ''),
                           case when monto_pagado > 0 then 'Actividad cancelada: lo pagado queda a favor'
                                else 'Actividad cancelada' end)
      where actividad_id = new.id and estado in ('pendiente', 'vencido', 'bonificado', 'pagado');
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
      -- Nunca por debajo de lo ya pagado.
      update public.cobros c
        set monto = greatest(new.precio, c.monto_pagado)
        from public.participaciones p
        where p.id = c.participacion_id and p.precio is null
          and c.actividad_id = new.id
          and c.estado in ('pendiente', 'vencido', 'bonificado')
          and c.monto <> greatest(new.precio, c.monto_pagado);
    end if;
  end if;

  if old.estado = 'cancelada' or (old.precio = 0 and new.precio > 0) then
    for v_part_id in select id from public.participaciones where actividad_id = new.id loop
      perform public.crear_cobro_participacion(v_part_id);
    end loop;
  end if;

  return null;
end;
$$;

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
      set monto = greatest(v_precio, monto_pagado)
      where participacion_id = new.id and estado in ('pendiente', 'vencido', 'bonificado')
        and monto <> greatest(v_precio, monto_pagado);
    perform public.crear_cobro_participacion(new.id);
  end if;

  return null;
end;
$$;

-- ---------------------------------------------------------------------
-- Saldo a favor
-- ---------------------------------------------------------------------

-- Lo que un pago todavía tiene sin aplicar (o liberado porque su cobro se anuló).
create or replace function public.disponible_pago(p_pago_id uuid)
returns numeric
language sql
stable
set search_path = ''
as $$
  select p.monto - coalesce((
    select sum(pa.monto)
    from public.pago_aplicaciones pa
    join public.cobros c on c.id = pa.cobro_id and c.estado <> 'anulado'
    where pa.pago_id = p.id
  ), 0)
  from public.pagos p
  where p.id = p_pago_id and not p.anulado;
$$;

create or replace function public.saldo_a_favor(p_jugador_id uuid)
returns numeric
language sql
stable
set search_path = ''
as $$
  select greatest(0,
    coalesce((select sum(public.disponible_pago(p.id)) from public.pagos p where p.jugador_id = p_jugador_id and not p.anulado), 0)
    - coalesce((select sum(d.monto) from public.devoluciones d where d.jugador_id = p_jugador_id), 0)
  )::numeric(12, 2);
$$;

-- ---------------------------------------------------------------------
-- Registrar un pago y aplicarlo a cobros (del más viejo al más nuevo)
-- ---------------------------------------------------------------------

-- Aplica un monto de un pago a los cobros elegidos. Devuelve lo que sobró (0 si se aplicó todo).
create or replace function public.aplicar_monto(p_pago_id uuid, p_cobro_ids uuid[], p_monto numeric)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_resto numeric := p_monto;
  v_cobro record;
  v_aplica numeric;
begin
  for v_cobro in
    select id, monto - monto_pagado as saldo
    from public.cobros
    where id = any (p_cobro_ids) and estado in ('pendiente', 'vencido') and monto > monto_pagado
    order by vencimiento, created_at
  loop
    exit when v_resto <= 0;
    v_aplica := least(v_resto, v_cobro.saldo);
    insert into public.pago_aplicaciones (pago_id, cobro_id, monto)
      values (p_pago_id, v_cobro.id, v_aplica)
      on conflict (pago_id, cobro_id) do update set monto = public.pago_aplicaciones.monto + excluded.monto;
    v_resto := v_resto - v_aplica;
  end loop;
  return v_resto;
end;
$$;

create or replace function public.registrar_pago(
  p_jugador_id uuid,
  p_monto numeric,
  p_medio public.medio_pago,
  p_cobro_ids uuid[],
  p_fecha date default null,
  p_nota text default null,
  p_comprobante_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deuda numeric;
  v_ajenos integer;
  v_pago uuid;
  v_cuando timestamptz;
begin
  -- Corre con permisos propios (escribe aplicaciones); solo la puede usar un admin o el sistema.
  if auth.uid() is not null and not public.es_admin() then
    raise exception 'No tenés permisos para registrar pagos.';
  end if;
  if p_medio = 'mercadopago' then
    raise exception 'Los pagos de Mercado Pago se registran solos cuando llega la confirmación.';
  end if;
  if p_monto is null or p_monto <= 0 then
    raise exception 'Ingresá el monto del pago.';
  end if;
  if p_cobro_ids is null or cardinality(p_cobro_ids) = 0 then
    raise exception 'Elegí al menos un cobro.';
  end if;

  select count(*) filter (where jugador_id <> p_jugador_id or estado not in ('pendiente', 'vencido')),
         coalesce(sum(monto - monto_pagado) filter (where jugador_id = p_jugador_id and estado in ('pendiente', 'vencido')), 0)
    into v_ajenos, v_deuda
    from public.cobros
    where id = any (p_cobro_ids);
  if v_ajenos > 0 then
    raise exception 'Solo se pueden pagar cobros pendientes o vencidos del jugador.';
  end if;
  if p_monto > v_deuda then
    raise exception 'El monto ($%) supera lo adeudado en los cobros elegidos ($%).',
      to_char(p_monto, 'FM999G999G990D00'), to_char(v_deuda, 'FM999G999G990D00');
  end if;

  v_cuando := case
    when p_fecha is null or p_fecha = public.hoy_ar() then now()
    else (p_fecha + time '12:00') at time zone 'America/Argentina/Buenos_Aires'
  end;

  insert into public.pagos (jugador_id, monto, medio, pagado_at, nota, comprobante_path)
    values (p_jugador_id, p_monto, p_medio, v_cuando, nullif(trim(p_nota), ''), nullif(p_comprobante_path, ''))
    returning id into v_pago;

  perform public.aplicar_monto(v_pago, p_cobro_ids, p_monto);
  return v_pago;
end;
$$;

-- Usa el saldo a favor del jugador para pagar cobros. Devuelve cuánto se aplicó.
create or replace function public.usar_saldo_a_favor(p_jugador_id uuid, p_cobro_ids uuid[], p_monto numeric default null)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_saldo numeric := public.saldo_a_favor(p_jugador_id);
  v_deuda numeric;
  v_objetivo numeric;
  v_resto numeric;
  v_pago record;
  v_usar numeric;
  v_sobra numeric;
begin
  -- Corre con permisos propios (escribe aplicaciones); solo la puede usar un admin o el sistema.
  if auth.uid() is not null and not public.es_admin() then
    raise exception 'No tenés permisos para registrar pagos.';
  end if;
  select coalesce(sum(monto - monto_pagado), 0) into v_deuda
    from public.cobros
    where id = any (p_cobro_ids) and jugador_id = p_jugador_id and estado in ('pendiente', 'vencido');

  v_objetivo := least(coalesce(p_monto, v_saldo), v_saldo, v_deuda);
  if v_objetivo <= 0 then
    raise exception 'No hay saldo a favor para aplicar a esos cobros.';
  end if;

  v_resto := v_objetivo;
  for v_pago in
    select id, public.disponible_pago(id) as disponible
    from public.pagos
    where jugador_id = p_jugador_id and not anulado
    order by pagado_at, created_at
  loop
    exit when v_resto <= 0;
    continue when v_pago.disponible <= 0;
    v_usar := least(v_resto, v_pago.disponible);
    v_sobra := public.aplicar_monto(v_pago.id, p_cobro_ids, v_usar);
    v_resto := v_resto - (v_usar - v_sobra);
    exit when v_sobra > 0;
  end loop;

  return v_objetivo - v_resto;
end;
$$;

create or replace function public.registrar_devolucion(
  p_jugador_id uuid,
  p_monto numeric,
  p_medio public.medio_pago,
  p_nota text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_saldo numeric := public.saldo_a_favor(p_jugador_id);
  v_id uuid;
begin
  -- Corre con permisos propios (escribe aplicaciones); solo la puede usar un admin o el sistema.
  if auth.uid() is not null and not public.es_admin() then
    raise exception 'No tenés permisos para registrar pagos.';
  end if;

  if p_monto is null or p_monto <= 0 then
    raise exception 'Ingresá el monto de la devolución.';
  end if;
  if p_monto > v_saldo then
    raise exception 'La devolución ($%) supera el saldo a favor ($%).',
      to_char(p_monto, 'FM999G999G990D00'), to_char(v_saldo, 'FM999G999G990D00');
  end if;
  insert into public.devoluciones (jugador_id, monto, medio, nota)
    values (p_jugador_id, p_monto, p_medio, nullif(trim(p_nota), ''))
    returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Links de pago: ahora por el saldo de cada cobro y con monto parcial opcional
-- ---------------------------------------------------------------------

drop function public.crear_link_pago(uuid[]);

create or replace function public.crear_link_pago(p_cobro_ids uuid[], p_monto numeric default null)
returns public.links_pago
language plpgsql
set search_path = ''
as $$
declare
  v_jugadores integer;
  v_impagos integer;
  v_deuda numeric;
  v_total numeric;
  v_jugador_id uuid;
  v_link public.links_pago;
  v_dias smallint;
  v_resto numeric;
  v_cobro record;
begin
  if p_cobro_ids is null or cardinality(p_cobro_ids) = 0 then
    raise exception 'Elegí al menos un cobro.';
  end if;

  select count(distinct jugador_id), count(*) filter (where estado in ('pendiente', 'vencido')),
         sum(monto - monto_pagado), min(jugador_id::text)::uuid
    into v_jugadores, v_impagos, v_deuda, v_jugador_id
    from public.cobros
    where id = any (p_cobro_ids);

  if v_impagos <> cardinality(p_cobro_ids) then
    raise exception 'Solo se pueden incluir cobros pendientes o vencidos.';
  end if;
  if v_jugadores <> 1 then
    raise exception 'Todos los cobros del link tienen que ser del mismo jugador.';
  end if;

  v_total := coalesce(p_monto, v_deuda);
  if v_total <= 0 or v_total > v_deuda then
    raise exception 'El monto del link tiene que ser mayor a 0 y no superar lo adeudado ($%).', to_char(v_deuda, 'FM999G999G990D00');
  end if;

  -- Reutiliza un link activo con los mismos cobros y el mismo monto.
  select l.* into v_link
    from public.links_pago l
    where l.estado = 'activo'
      and l.expira_at > now()
      and l.jugador_id = v_jugador_id
      and l.monto_total = v_total
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

  -- Reparte el monto del link entre los cobros, del más viejo al más nuevo.
  v_resto := v_total;
  for v_cobro in
    select id, monto - monto_pagado as saldo from public.cobros where id = any (p_cobro_ids) order by vencimiento, created_at
  loop
    exit when v_resto <= 0;
    insert into public.link_pago_cobros (link_id, cobro_id, monto) values (v_link.id, v_cobro.id, least(v_resto, v_cobro.saldo));
    v_resto := v_resto - least(v_resto, v_cobro.saldo);
  end loop;

  insert into public.cobro_eventos (cobro_id, link_id, tipo, detalle, usuario_id)
    select lpc.cobro_id, v_link.id, 'link_generado', 'Por $' || to_char(lpc.monto, 'FM999G999G990D00'), auth.uid()
    from public.link_pago_cobros lpc where lpc.link_id = v_link.id;

  return v_link;
end;
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
  v_cubre boolean;
  v_pago uuid;
begin
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
    -- Cada cobro del link tiene que seguir impago y con saldo suficiente para lo asignado.
    select coalesce(bool_and(c.estado in ('pendiente', 'vencido') and c.monto - c.monto_pagado >= lpc.monto), false)
      into v_cubre
      from public.link_pago_cobros lpc
      join public.cobros c on c.id = lpc.cobro_id
      where lpc.link_id = v_link.id;

    if v_link.estado = 'pagado' or not v_cubre or (p_monto is not null and p_monto < v_link.monto_total) then
      v_resultado := 'a_revisar';
      insert into public.cobro_eventos (cobro_id, link_id, tipo, detalle)
        select lpc.cobro_id, v_link.id, 'pago_a_revisar',
               'Pago MP ' || p_payment_id || ' por $' || coalesce(to_char(p_monto, 'FM999G999G990D00'), '?')
               || ' — revisar posible devolución'
        from public.link_pago_cobros lpc
        where lpc.link_id = v_link.id;
    else
      -- Primero el link (para que el pago no lo invalide), después el pago y sus aplicaciones.
      update public.links_pago
        set estado = 'pagado', mp_payment_id = p_payment_id, pagado_at = now()
        where id = v_link.id;

      insert into public.pagos (jugador_id, monto, medio, mp_payment_id, link_id, nota)
        values (v_link.jugador_id, v_link.monto_total, 'mercadopago', p_payment_id, v_link.id, 'Mercado Pago')
        returning id into v_pago;

      insert into public.pago_aplicaciones (pago_id, cobro_id, monto)
        select v_pago, lpc.cobro_id, lpc.monto from public.link_pago_cobros lpc where lpc.link_id = v_link.id;

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
-- Vistas: deuda por saldo, saldo a favor y cobrado con pagos parciales
-- ---------------------------------------------------------------------

drop view public.jugadores_resumen;

create view public.jugadores_resumen
with (security_invoker = true) as
select
  j.*,
  coalesce(d.deuda, 0)::numeric(12, 2) as deuda,
  coalesce(d.cobros_adeudados, 0)::integer as cobros_adeudados,
  public.saldo_a_favor(j.id) as saldo_a_favor,
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
  select sum(c.monto - c.monto_pagado) as deuda, count(*) as cobros_adeudados
  from public.cobros c
  where c.jugador_id = j.id and c.estado in ('pendiente', 'vencido')
) d on true
left join lateral (
  select max(doc.vencimiento) as apto_vencimiento
  from public.jugador_documentos doc
  where doc.jugador_id = j.id and doc.tipo = 'apto_medico'
) a on true
left join lateral (
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

drop view public.actividades_resumen;

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
    sum(co.monto_pagado) filter (where co.estado in ('pendiente', 'vencido', 'pagado')) as cobrado
  from public.cobros co
  where co.actividad_id = a.id
) c on true;

grant select on public.jugadores_resumen, public.actividades_resumen to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Permisos de las funciones nuevas
-- ---------------------------------------------------------------------

revoke execute on function public.recalcular_cobro(uuid) from anon, public;
revoke execute on function public.aplicar_monto(uuid, uuid[], numeric) from anon, public, authenticated;
revoke execute on function public.disponible_pago(uuid) from anon, public;
revoke execute on function public.saldo_a_favor(uuid) from anon, public;
revoke execute on function public.registrar_pago(uuid, numeric, public.medio_pago, uuid[], date, text, text) from anon, public;
revoke execute on function public.usar_saldo_a_favor(uuid, uuid[], numeric) from anon, public;
revoke execute on function public.registrar_devolucion(uuid, numeric, public.medio_pago, text) from anon, public;
revoke execute on function public.crear_link_pago(uuid[], numeric) from anon, public;
revoke execute on function public.registrar_pago_mp(text, uuid, text, numeric, jsonb) from anon, public, authenticated;

grant execute on function public.recalcular_cobro(uuid) to authenticated, service_role;
grant execute on function public.aplicar_monto(uuid, uuid[], numeric) to service_role;
grant execute on function public.disponible_pago(uuid) to authenticated, service_role;
grant execute on function public.saldo_a_favor(uuid) to authenticated, service_role;
grant execute on function public.registrar_pago(uuid, numeric, public.medio_pago, uuid[], date, text, text) to authenticated, service_role;
grant execute on function public.usar_saldo_a_favor(uuid, uuid[], numeric) to authenticated, service_role;
grant execute on function public.registrar_devolucion(uuid, numeric, public.medio_pago, text) to authenticated, service_role;
grant execute on function public.crear_link_pago(uuid[], numeric) to authenticated, service_role;
grant execute on function public.registrar_pago_mp(text, uuid, text, numeric, jsonb) to service_role;
