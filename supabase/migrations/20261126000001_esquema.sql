-- =====================================================================
-- El Cardo Polo Club — esquema base
-- Extensiones, tipos, tablas, constraints e índices.
-- =====================================================================

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------

-- unaccent no es IMMUTABLE; este wrapper permite usarlo en columnas generadas e índices.
create or replace function public.normalizar_texto(texto text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(texto, '')));
$$;

-- Fecha "de hoy" en Argentina (los vencimientos son por día calendario local).
create or replace function public.hoy_ar()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Argentina/Buenos_Aires')::date;
$$;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------

create type public.tipo_jugador as enum ('socio', 'no_socio', 'alumno', 'externo');
create type public.mano as enum ('diestro', 'zurdo');
create type public.tipo_documento as enum ('apto_medico', 'seguro', 'deslinde', 'otro');
create type public.tipo_actividad as enum ('practica', 'clase', 'torneo');
create type public.estado_actividad as enum ('programada', 'finalizada', 'cancelada');
create type public.asistencia as enum ('presente', 'ausente');
create type public.fase_partido as enum ('grupos', 'cuartos', 'semi', 'final', 'otro');
create type public.estado_partido as enum ('programado', 'jugado', 'suspendido');
create type public.concepto_cobro as enum ('cuota_social', 'practica', 'clase', 'torneo', 'otro');
create type public.estado_cobro as enum ('pendiente', 'pagado', 'vencido', 'anulado', 'bonificado');
create type public.medio_pago as enum ('mercadopago', 'efectivo', 'transferencia');
create type public.estado_link as enum ('activo', 'pagado', 'vencido', 'anulado');
create type public.tipo_evento_cobro as enum (
  'creado',
  'link_generado',
  'enviado',
  'pagado',
  'vencido',
  'anulado',
  'bonificado',
  'reactivado',
  'monto_modificado',
  'link_invalidado',
  'pago_a_revisar'
);

-- ---------------------------------------------------------------------
-- Perfiles (usuarios del sistema; todos son admin)
-- ---------------------------------------------------------------------

create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null,
  email text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Jugadores
-- ---------------------------------------------------------------------

create table public.jugadores (
  id uuid primary key default gen_random_uuid(),
  -- Personales
  nombre text not null check (length(trim(nombre)) > 0),
  apellido text not null check (length(trim(apellido)) > 0),
  dni text unique check (dni is null or dni ~ '^[0-9]{6,9}$'),
  fecha_nacimiento date,
  foto_path text,
  telefono text,
  email text,
  direccion text,
  -- Club
  tipo public.tipo_jugador not null default 'socio',
  activo boolean not null default true,
  fecha_alta date not null default public.hoy_ar(),
  club_origen text,
  es_profesor boolean not null default false,
  notas text,
  -- Polo
  handicap smallint not null default 0 check (handicap between -2 and 10),
  mano public.mano,
  -- Emergencia
  emergencia_nombre text,
  emergencia_vinculo text,
  emergencia_telefono text,
  grupo_sanguineo text check (
    grupo_sanguineo is null
    or grupo_sanguineo in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-')
  ),
  obra_social text,
  numero_afiliado text,
  -- Búsqueda
  busqueda text generated always as (
    public.normalizar_texto(nombre || ' ' || apellido || ' ' || coalesce(dni, ''))
  ) stored,
  -- Auditoría
  created_at timestamptz not null default now(),
  created_by uuid references public.perfiles (id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.perfiles (id)
);

create index jugadores_busqueda_trgm on public.jugadores using gin (busqueda extensions.gin_trgm_ops);
create index jugadores_apellido_idx on public.jugadores (apellido, nombre);
create index jugadores_activo_idx on public.jugadores (activo);

create table public.jugador_documentos (
  id uuid primary key default gen_random_uuid(),
  jugador_id uuid not null references public.jugadores (id),
  tipo public.tipo_documento not null,
  descripcion text,
  archivo_path text,
  archivo_nombre text,
  vencimiento date,
  created_at timestamptz not null default now(),
  created_by uuid references public.perfiles (id)
);

create index jugador_documentos_jugador_idx on public.jugador_documentos (jugador_id, tipo, vencimiento desc);

create table public.handicap_historial (
  id uuid primary key default gen_random_uuid(),
  jugador_id uuid not null references public.jugadores (id),
  handicap_anterior smallint,
  handicap_nuevo smallint not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.perfiles (id)
);

create index handicap_historial_jugador_idx on public.handicap_historial (jugador_id, created_at desc);

-- ---------------------------------------------------------------------
-- Configuración (una sola fila) e historial de cuota social
-- ---------------------------------------------------------------------

create table public.configuracion (
  id boolean primary key default true check (id),
  cuota_social_monto numeric(12, 2) not null check (cuota_social_monto > 0),
  cuota_social_dia_vencimiento smallint not null default 10 check (cuota_social_dia_vencimiento between 1 and 28),
  precio_practica numeric(12, 2) not null default 0 check (precio_practica >= 0),
  precio_clase numeric(12, 2) not null default 0 check (precio_clase >= 0),
  precio_torneo numeric(12, 2) not null default 0 check (precio_torneo >= 0),
  -- Días para el vencimiento de un cobro por actividad (desde la fecha de la actividad).
  dias_vencimiento_actividad smallint not null default 7 check (dias_vencimiento_actividad between 0 and 90),
  -- Días de validez de un link de pago.
  dias_validez_link smallint not null default 30 check (dias_validez_link between 1 and 180),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.perfiles (id)
);

create table public.cuota_social_historial (
  id uuid primary key default gen_random_uuid(),
  monto numeric(12, 2) not null check (monto > 0),
  -- Primer día del mes desde el que rige.
  vigente_desde date not null check (extract(day from vigente_desde) = 1),
  created_at timestamptz not null default now(),
  created_by uuid references public.perfiles (id)
);

create index cuota_social_historial_vigencia_idx on public.cuota_social_historial (vigente_desde desc, created_at desc);

-- ---------------------------------------------------------------------
-- Actividades
-- ---------------------------------------------------------------------

create table public.actividades (
  id uuid primary key default gen_random_uuid(),
  tipo public.tipo_actividad not null,
  nombre text not null check (length(trim(nombre)) > 0),
  inicio timestamptz not null,
  fin timestamptz,
  precio numeric(12, 2) not null default 0 check (precio >= 0),
  estado public.estado_actividad not null default 'programada',
  notas text,
  profesor_id uuid references public.jugadores (id),
  created_at timestamptz not null default now(),
  created_by uuid references public.perfiles (id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.perfiles (id),
  constraint actividades_profesor_solo_clase check (profesor_id is null or tipo = 'clase'),
  constraint actividades_fin_valido check (fin is null or fin >= inicio)
);

create index actividades_inicio_idx on public.actividades (inicio desc);
create index actividades_tipo_estado_idx on public.actividades (tipo, estado);
create index actividades_profesor_idx on public.actividades (profesor_id) where profesor_id is not null;

-- ---------------------------------------------------------------------
-- Torneos: categorías y zonas
-- ---------------------------------------------------------------------

create table public.torneo_categorias (
  id uuid primary key default gen_random_uuid(),
  actividad_id uuid not null references public.actividades (id) on delete cascade,
  nombre text not null check (length(trim(nombre)) > 0),
  tope_handicap smallint check (tope_handicap is null or tope_handicap between -8 and 40),
  orden smallint not null default 0,
  created_at timestamptz not null default now(),
  unique (actividad_id, nombre),
  unique (id, actividad_id)
);

create table public.torneo_zonas (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references public.torneo_categorias (id) on delete cascade,
  nombre text not null check (length(trim(nombre)) > 0),
  orden smallint not null default 0,
  created_at timestamptz not null default now(),
  unique (categoria_id, nombre),
  unique (id, categoria_id)
);

-- ---------------------------------------------------------------------
-- Equipos y participaciones
-- ---------------------------------------------------------------------

create table public.equipos (
  id uuid primary key default gen_random_uuid(),
  actividad_id uuid not null references public.actividades (id) on delete cascade,
  nombre text not null check (length(trim(nombre)) > 0),
  categoria_id uuid,
  zona_id uuid,
  created_at timestamptz not null default now(),
  created_by uuid references public.perfiles (id),
  unique (actividad_id, nombre),
  unique (id, actividad_id),
  -- La categoría tiene que ser del mismo torneo.
  foreign key (categoria_id, actividad_id) references public.torneo_categorias (id, actividad_id),
  -- La zona tiene que ser de la misma categoría.
  foreign key (zona_id, categoria_id) references public.torneo_zonas (id, categoria_id),
  constraint equipos_zona_requiere_categoria check (zona_id is null or categoria_id is not null)
);

create index equipos_actividad_idx on public.equipos (actividad_id);
create index equipos_categoria_idx on public.equipos (categoria_id) where categoria_id is not null;

-- Historial de lo que hizo cada jugador. Un jugador aparece una sola vez por actividad,
-- por eso no puede estar en dos equipos de la misma actividad (ni del mismo torneo).
create table public.participaciones (
  id uuid primary key default gen_random_uuid(),
  actividad_id uuid not null references public.actividades (id) on delete cascade,
  jugador_id uuid not null references public.jugadores (id),
  equipo_id uuid,
  asistencia public.asistencia,
  bonificado boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references public.perfiles (id),
  unique (actividad_id, jugador_id),
  -- El equipo tiene que ser de la misma actividad. Al borrar el equipo, el jugador queda sin equipo.
  foreign key (equipo_id, actividad_id) references public.equipos (id, actividad_id)
    on delete set null (equipo_id)
);

create index participaciones_jugador_idx on public.participaciones (jugador_id);
create index participaciones_equipo_idx on public.participaciones (equipo_id) where equipo_id is not null;

-- ---------------------------------------------------------------------
-- Partidos y goleadores
-- ---------------------------------------------------------------------

create table public.partidos (
  id uuid primary key default gen_random_uuid(),
  actividad_id uuid not null references public.actividades (id) on delete cascade,
  categoria_id uuid not null,
  zona_id uuid,
  fase public.fase_partido not null default 'grupos',
  inicio timestamptz,
  cancha text,
  equipo_a_id uuid,
  equipo_b_id uuid,
  placeholder_a text,
  placeholder_b text,
  goles_a smallint check (goles_a is null or goles_a >= 0),
  goles_b smallint check (goles_b is null or goles_b >= 0),
  -- Ej.: [{"a": 2, "b": 1}, {"a": 0, "b": 3}, ...] — un elemento por chukker.
  goles_chukkers jsonb check (goles_chukkers is null or jsonb_typeof(goles_chukkers) = 'array'),
  estado public.estado_partido not null default 'programado',
  orden smallint not null default 0,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.perfiles (id),
  foreign key (categoria_id, actividad_id) references public.torneo_categorias (id, actividad_id) on delete cascade,
  foreign key (zona_id, categoria_id) references public.torneo_zonas (id, categoria_id) on delete set null (zona_id),
  foreign key (equipo_a_id, actividad_id) references public.equipos (id, actividad_id) on delete set null (equipo_a_id),
  foreign key (equipo_b_id, actividad_id) references public.equipos (id, actividad_id) on delete set null (equipo_b_id),
  constraint partidos_equipos_distintos check (equipo_a_id is null or equipo_b_id is null or equipo_a_id <> equipo_b_id),
  constraint partidos_jugado_con_resultado check (
    estado <> 'jugado' or (goles_a is not null and goles_b is not null and equipo_a_id is not null and equipo_b_id is not null)
  )
);

create index partidos_actividad_idx on public.partidos (actividad_id, categoria_id, inicio);

create table public.goleadores (
  id uuid primary key default gen_random_uuid(),
  partido_id uuid not null references public.partidos (id) on delete cascade,
  jugador_id uuid not null references public.jugadores (id),
  cantidad smallint not null check (cantidad > 0),
  unique (partido_id, jugador_id)
);

-- ---------------------------------------------------------------------
-- Cobros
-- ---------------------------------------------------------------------

create table public.cobros (
  id uuid primary key default gen_random_uuid(),
  jugador_id uuid not null references public.jugadores (id),
  concepto public.concepto_cobro not null,
  descripcion text not null check (length(trim(descripcion)) > 0),
  actividad_id uuid references public.actividades (id),
  participacion_id uuid references public.participaciones (id) on delete set null,
  periodo text check (periodo is null or periodo ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  monto numeric(12, 2) not null check (monto > 0),
  vencimiento date not null,
  estado public.estado_cobro not null default 'pendiente',
  medio_pago public.medio_pago,
  pagado_at timestamptz,
  nota text,
  comprobante_path text,
  mp_payment_id text,
  created_at timestamptz not null default now(),
  created_by uuid references public.perfiles (id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.perfiles (id),
  constraint cobros_periodo_solo_cuota check ((concepto = 'cuota_social') = (periodo is not null)),
  constraint cobros_pagado_completo check (
    estado <> 'pagado' or (medio_pago is not null and pagado_at is not null)
  )
);

-- Una sola cuota social por jugador y periodo.
create unique index cobros_cuota_unica on public.cobros (jugador_id, periodo) where concepto = 'cuota_social';
-- Un solo cobro vigente por participación.
create unique index cobros_participacion_unica on public.cobros (participacion_id)
  where participacion_id is not null and estado <> 'anulado';
create index cobros_jugador_idx on public.cobros (jugador_id, estado);
create index cobros_actividad_idx on public.cobros (actividad_id) where actividad_id is not null;
create index cobros_estado_venc_idx on public.cobros (estado, vencimiento);
create index cobros_pagado_at_idx on public.cobros (pagado_at) where pagado_at is not null;

-- ---------------------------------------------------------------------
-- Links de pago (Mercado Pago)
-- ---------------------------------------------------------------------

create table public.links_pago (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default encode(extensions.gen_random_bytes(32), 'hex')
    check (length(token) >= 32),
  jugador_id uuid not null references public.jugadores (id),
  monto_total numeric(12, 2) not null check (monto_total > 0),
  estado public.estado_link not null default 'activo',
  mp_preference_id text,
  mp_init_point text,
  mp_payment_id text unique,
  expira_at timestamptz not null,
  pagado_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references public.perfiles (id),
  updated_at timestamptz not null default now()
);

create index links_pago_jugador_idx on public.links_pago (jugador_id, estado);

create table public.link_pago_cobros (
  link_id uuid not null references public.links_pago (id) on delete cascade,
  cobro_id uuid not null references public.cobros (id),
  monto numeric(12, 2) not null check (monto > 0),
  primary key (link_id, cobro_id)
);

create index link_pago_cobros_cobro_idx on public.link_pago_cobros (cobro_id);

-- Registro de cada pago informado por Mercado Pago (idempotencia y auditoría).
create table public.pagos_mp (
  mp_payment_id text primary key,
  link_id uuid references public.links_pago (id),
  status text not null,
  monto numeric(12, 2),
  resultado text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

create table public.cobro_eventos (
  id bigint generated always as identity primary key,
  cobro_id uuid not null references public.cobros (id),
  link_id uuid references public.links_pago (id),
  tipo public.tipo_evento_cobro not null,
  detalle text,
  usuario_id uuid references public.perfiles (id),
  created_at timestamptz not null default now()
);

create index cobro_eventos_cobro_idx on public.cobro_eventos (cobro_id, created_at);
