-- =====================================================================
-- Datos de demo — El Cardo Polo Club
-- Las fechas son relativas al día en que se corre, así la demo siempre luce "al día".
-- Usuario de prueba: admin@elcardo.test / ElCardo2026!
-- =====================================================================

-- ---------------------------------------------------------------------
-- Usuario admin
-- ---------------------------------------------------------------------
do $$
declare
  v_id uuid := '00000000-0000-4000-a000-00000000a001';
begin
  if not exists (select 1 from auth.users where id = v_id) then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
      'admin@elcardo.test', extensions.crypt('ElCardo2026!', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{"nombre":"Admin Demo"}', now(), now(),
      '', '', '', ''
    );
    insert into auth.identities (
      id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_id::text, v_id,
      jsonb_build_object('sub', v_id::text, 'email', 'admin@elcardo.test', 'email_verified', true),
      'email', now(), now(), now()
    );
  end if;

  insert into public.perfiles (id, nombre, email)
  values (v_id, 'Admin Demo', 'admin@elcardo.test')
  on conflict (id) do nothing;
end;
$$;

-- ---------------------------------------------------------------------
-- Datos del club
-- ---------------------------------------------------------------------
do $$
declare
  hoy date := public.hoy_ar();
  -- Hora local -> timestamptz
  tz constant text := 'America/Argentina/Buenos_Aires';
  v_act uuid;
  v_torneo uuid;
  v_cat_copa uuid;
  v_cat_des uuid;
  v_zona_a uuid;
  v_zona_b uuid;
  v_eq uuid[];
  v_partido uuid;
  r record;
  i integer;
  -- Prácticas pasadas: días hacia atrás
  v_practicas integer[] := array[25, 21, 18, 14, 11, 7, 4];
  v_clases integer[] := array[23, 16, 9, 2];
begin
  if exists (select 1 from public.jugadores) then
    raise notice 'La base ya tiene jugadores: no se carga el seed.';
    return;
  end if;

  -- Historial de cuota social: antes 38.000, desde el mes pasado 45.000.
  delete from public.cuota_social_historial;
  insert into public.cuota_social_historial (monto, vigente_desde) values
    (38000, (date_trunc('month', hoy) - interval '6 months')::date),
    (45000, (date_trunc('month', hoy) - interval '1 month')::date);

  -- -------------------------------------------------------------------
  -- 30 jugadores (id fijo = ...a000-0000000000NN)
  -- -------------------------------------------------------------------
  create temp table s_jug (
    n int, nombre text, apellido text, dni text, tipo public.tipo_jugador, handicap smallint,
    profesor boolean, club text, mano public.mano, tel text, sangre text, obra text
  ) on commit drop;

  insert into s_jug values
    ( 1, 'Martín',     'Etchegaray', '28456123', 'socio',    3, true,  null,              'diestro', '+5493489401201', '0+',  'OSDE'),
    ( 2, 'Lucía',      'Ferreyra',   '31877456', 'socio',    1, true,  null,              'diestro', '+5493489401202', 'A+',  'Swiss Medical'),
    ( 3, 'Santiago',   'Álvarez',    '35123987', 'socio',    2, false, null,              'diestro', '+5493489401203', 'A+',  'OSDE'),
    ( 4, 'Juan Cruz',  'Bianchi',    '33654789', 'socio',    3, false, null,              'zurdo',   '+5493489401204', '0-',  'Galeno'),
    ( 5, 'Federico',   'Lanusse',    '29874563', 'socio',    2, false, null,              'diestro', '+5493489401205', 'B+',  'OSDE'),
    ( 6, 'Agustina',   'Rossi',      '38456712', 'socio',    0, false, null,              'diestro', '+5493489401206', '0+',  'Medifé'),
    ( 7, 'Benjamín',   'Uriarte',    '40123654', 'socio',    1, false, null,              'diestro', '+5493489401207', 'A-',  'OSDE'),
    ( 8, 'Joaquín',    'Pereyra',    '34789123', 'socio',    3, false, null,              'diestro', '+5493489401208', '0+',  'Swiss Medical'),
    ( 9, 'Valentina',  'Sosa',       '41256789', 'socio',   -1, false, null,              'diestro', '+5493489401209', 'AB+', 'Galeno'),
    (10, 'Ignacio',    'Castro',     '32569874', 'socio',    2, false, null,              'diestro', '+5493489401210', '0+',  'OSDE'),
    (11, 'Mateo',      'Gutiérrez',  '42365987', 'socio',    1, false, null,              'zurdo',   '+5493489401211', 'A+',  'Sancor Salud'),
    (12, 'Camila',     'Domínguez',  '39874125', 'socio',    0, false, null,              'diestro', '+5493489401212', 'B-',  'OSDE'),
    (13, 'Nicolás',    'Barrios',    '30258741', 'socio',    3, false, null,              'diestro', '+5493489401213', '0+',  'Swiss Medical'),
    (14, 'Francisco',  'Olivera',    '37741258', 'socio',    1, false, null,              'diestro', '+5493489401214', 'A+',  'OSDE'),
    (15, 'Pedro',      'Achával',    '27963852', 'socio',    2, false, null,              'diestro', '+5493489401215', '0+',  'Medifé'),
    (16, 'Diego',      'Morales',    '33147852', 'no_socio', 1, false, null,              'diestro', '+5491150401216', 'A+',  'OSDE'),
    (17, 'Rodrigo',    'Medina',     '36985214', 'no_socio', 0, false, null,              'diestro', '+5491150401217', '0+',  'Galeno'),
    (18, 'Sofía',      'Herrera',    '40789654', 'no_socio',-1, false, null,              'diestro', '+5491150401218', 'B+',  'Swiss Medical'),
    (19, 'Gonzalo',    'Ríos',       '31478523', 'no_socio', 2, false, null,              'zurdo',   '+5491150401219', '0-',  'OSDE'),
    (20, 'Emilia',     'Torres',     '45123698', 'alumno',  -2, false, null,              'diestro', '+5493489401220', 'A+',  'OSDE'),
    (21, 'Bautista',   'Acosta',     '43258741', 'alumno',  -1, false, null,              'diestro', '+5493489401221', '0+',  'Swiss Medical'),
    (22, 'Lautaro',    'Giménez',    '44789632', 'alumno',  -2, false, null,              'diestro', '+5493489401222', 'B+',  'Galeno'),
    (23, 'Delfina',    'Ruiz',       '42147896', 'alumno',  -1, false, null,              'diestro', '+5493489401223', 'A-',  'OSDE'),
    (24, 'Thiago',     'Romero',     '46325874', 'alumno',  -2, false, null,              'zurdo',   '+5493489401224', '0+',  'Medifé'),
    (25, 'Olivia',     'Navarro',    '45896321', 'alumno',  -2, false, null,              'diestro', '+5493489401225', 'AB-', 'OSDE'),
    (26, 'Hernán',     'Zubiaurre',  null,       'externo',  3, false, 'Los Talas',       'diestro', '+5492324401226', null,  null),
    (27, 'Marcos',     'Iturraspe',  null,       'externo',  2, false, 'San Javier',      'diestro', '+5492324401227', null,  null),
    (28, 'Julián',     'Ocampo',     null,       'externo',  1, false, 'La Esperanza',    'diestro', '+5492324401228', null,  null),
    (29, 'Tobías',     'Lynch',      null,       'externo',  0, false, 'Los Pingüinos',   'diestro', null,             null,  null),
    (30, 'Esteban',    'Grahn',      null,       'externo',  2, false, 'San Javier',      'zurdo',   null,             null,  null);

  insert into public.jugadores (
    id, nombre, apellido, dni, tipo, handicap, es_profesor, club_origen, mano, telefono, email,
    fecha_nacimiento, fecha_alta, grupo_sanguineo, obra_social, numero_afiliado,
    emergencia_nombre, emergencia_vinculo, emergencia_telefono, direccion
  )
  select
    ('00000000-0000-4000-a000-' || lpad(s.n::text, 12, '0'))::uuid,
    s.nombre, s.apellido, s.dni, s.tipo, s.handicap, s.profesor, s.club, s.mano, s.tel,
    case when s.tipo <> 'externo'
      then lower(public.normalizar_texto(replace(s.nombre, ' ', '') || '.' || replace(s.apellido, ' ', ''))) || '@mail.com' end,
    -- Alumnos más jóvenes
    case when s.tipo = 'alumno' then hoy - (365 * (14 + s.n % 6))
         when s.tipo <> 'externo' then hoy - (365 * (22 + s.n % 25)) end,
    hoy - (30 * (2 + s.n * 3)),
    s.sangre, s.obra,
    case when s.obra is not null then lpad((s.n * 7919)::text, 8, '0') || '/0' || (s.n % 4)::text end,
    case when s.tipo <> 'externo' then (array['María', 'Carlos', 'Laura', 'Jorge', 'Ana'])[1 + s.n % 5] || ' ' || s.apellido end,
    case when s.tipo <> 'externo' then (array['Madre', 'Padre', 'Pareja', 'Hermano/a', 'Madre'])[1 + s.n % 5] end,
    case when s.tipo <> 'externo' then '+54911' || (40000000 + s.n * 1373)::text end,
    case when s.tipo in ('socio', 'alumno') then (array['Ruta 9 km 82', 'Justa Lima 1450, Zárate', 'Belgrano 320, Campana', 'Av. Lavalle 2100, Zárate'])[1 + s.n % 4] end
  from s_jug s;

  -- Cambios de hándicap (quedan en el historial).
  update public.jugadores set handicap = 4 where id = '00000000-0000-4000-a000-000000000013';
  update public.jugadores set handicap = 4 where id = '00000000-0000-4000-a000-000000000001';
  update public.jugadores set handicap = 0 where id = '00000000-0000-4000-a000-000000000009';

  -- -------------------------------------------------------------------
  -- Documentos: aptos médicos (algunos vencidos o por vencer), seguros y deslindes
  -- -------------------------------------------------------------------
  insert into public.jugador_documentos (jugador_id, tipo, descripcion, archivo_path, archivo_nombre, vencimiento)
  select
    ('00000000-0000-4000-a000-' || lpad(s.n::text, 12, '0'))::uuid,
    'apto_medico', 'Apto físico anual', null, null,
    case
      when s.n in (5, 12, 17, 22) then hoy - (5 + s.n)          -- vencidos
      when s.n in (3, 9, 21) then hoy + (8 + s.n)               -- vencen en < 30 días
      else hoy + (90 + s.n * 7)
    end
  from s_jug s
  where s.tipo <> 'externo' and s.n <> 25;  -- Olivia no presentó apto

  insert into public.jugador_documentos (jugador_id, tipo, descripcion, vencimiento)
  select ('00000000-0000-4000-a000-' || lpad(s.n::text, 12, '0'))::uuid, 'seguro', 'Seguro de accidentes personales',
         case when s.n = 27 then hoy - 3 else hoy + 200 end
  from s_jug s where s.tipo = 'externo' or s.n % 3 = 0;

  insert into public.jugador_documentos (jugador_id, tipo, descripcion, vencimiento)
  select ('00000000-0000-4000-a000-' || lpad(s.n::text, 12, '0'))::uuid, 'deslinde', 'Deslinde de responsabilidad firmado', null
  from s_jug s;

  -- -------------------------------------------------------------------
  -- Prácticas pasadas (con equipos Blanco / Azul y asistencia)
  -- -------------------------------------------------------------------
  for i in 1 .. array_length(v_practicas, 1) loop
    insert into public.actividades (tipo, nombre, inicio, precio, estado)
    values (
      'practica',
      'Práctica ' || (array['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'])[extract(isodow from hoy - v_practicas[i])::int],
      ((hoy - v_practicas[i]) + time '16:30') at time zone tz,
      25000,
      'finalizada'
    )
    returning id into v_act;

    insert into public.equipos (actividad_id, nombre) values (v_act, 'Blanco'), (v_act, 'Azul');

    -- 8 jugadores rotando entre socios y no socios
    insert into public.participaciones (actividad_id, jugador_id, equipo_id, asistencia)
    select
      v_act,
      ('00000000-0000-4000-a000-' || lpad(x.n::text, 12, '0'))::uuid,
      (select e.id from public.equipos e where e.actividad_id = v_act
         and e.nombre = case when x.k % 2 = 0 then 'Blanco' else 'Azul' end),
      case when x.k = 7 and i % 3 = 0 then 'ausente' else 'presente' end::public.asistencia
    from (
      select k, 1 + ((i * 3 + k * 2) % 19) as n
      from generate_series(0, 7) k
    ) x
    on conflict (actividad_id, jugador_id) do nothing;
  end loop;

  -- Práctica programada (próxima)
  insert into public.actividades (tipo, nombre, inicio, precio, estado, notas)
  values ('practica', 'Práctica ' || (array['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'])[extract(isodow from hoy + 3)::int], ((hoy + 3) + time '16:30') at time zone tz, 25000, 'programada',
          'Traer casco y rodilleras. Caballos a cargo del club.')
  returning id into v_act;
  insert into public.participaciones (actividad_id, jugador_id)
  select v_act, ('00000000-0000-4000-a000-' || lpad(n::text, 12, '0'))::uuid
  from unnest(array[3, 4, 6, 8, 10, 16]) n;

  -- -------------------------------------------------------------------
  -- Clases (profesor + alumnos)
  -- -------------------------------------------------------------------
  for i in 1 .. array_length(v_clases, 1) loop
    insert into public.actividades (tipo, nombre, inicio, precio, estado, profesor_id)
    values (
      'clase',
      case when i % 2 = 0 then 'Clase Las Carderas' else 'Escuelita de polo' end,
      ((hoy - v_clases[i]) + time '10:00') at time zone tz,
      35000,
      'finalizada',
      case when i % 2 = 0 then '00000000-0000-4000-a000-000000000002'::uuid
           else '00000000-0000-4000-a000-000000000001'::uuid end
    )
    returning id into v_act;

    insert into public.participaciones (actividad_id, jugador_id, asistencia)
    select v_act, ('00000000-0000-4000-a000-' || lpad(n::text, 12, '0'))::uuid,
           case when n = 24 and i = 3 then 'ausente' else 'presente' end::public.asistencia
    from unnest(case when i % 2 = 0 then array[9, 18, 23, 25] else array[20, 21, 22, 24] end) n;
  end loop;

  insert into public.actividades (tipo, nombre, inicio, precio, estado, profesor_id)
  values ('clase', 'Escuelita de polo', ((hoy + 2) + time '10:00') at time zone tz, 35000, 'programada',
          '00000000-0000-4000-a000-000000000001')
  returning id into v_act;
  insert into public.participaciones (actividad_id, jugador_id)
  select v_act, ('00000000-0000-4000-a000-' || lpad(n::text, 12, '0'))::uuid
  from unnest(array[20, 22, 25]) n;

  -- -------------------------------------------------------------------
  -- Torneo: Copa Apertura El Cardo
  -- -------------------------------------------------------------------
  insert into public.actividades (tipo, nombre, inicio, fin, precio, estado, notas)
  values (
    'torneo', 'Copa Apertura El Cardo ' || extract(year from hoy),
    ((hoy - 3) + time '14:00') at time zone tz,
    ((hoy + 4) + time '19:00') at time zone tz,
    80000, 'programada',
    'Partidos de 4 chukkers. Premiación después de la final.'
  )
  returning id into v_torneo;

  insert into public.torneo_categorias (actividad_id, nombre, tope_handicap, orden, formato)
    values (v_torneo, 'Copa', 8, 1, 'zonas_llave') returning id into v_cat_copa;
  insert into public.torneo_categorias (actividad_id, nombre, tope_handicap, orden)
    values (v_torneo, 'Desarrollo', 2, 2) returning id into v_cat_des;

  insert into public.torneo_zonas (categoria_id, nombre, orden) values (v_cat_copa, 'Zona A', 1) returning id into v_zona_a;
  insert into public.torneo_zonas (categoria_id, nombre, orden) values (v_cat_copa, 'Zona B', 2) returning id into v_zona_b;

  -- Equipos: [nombre, categoría, zona, jugadores]
  create temp table s_eq (orden int, nombre text, categoria uuid, zona uuid, jugadores int[]) on commit drop;
  insert into s_eq values
    (1, 'Los Cardos',    v_cat_copa, v_zona_a, array[1, 6, 16, 26]),
    (2, 'El Trébol',     v_cat_copa, v_zona_a, array[4, 7, 27, 17]),
    (3, 'Santa Rita',    v_cat_copa, v_zona_b, array[8, 3, 28, 12]),
    (4, 'La Herradura',  v_cat_copa, v_zona_b, array[13, 5, 19, 30]),
    (5, 'Las Carderas',  v_cat_des,  null,     array[2, 9, 18, 23]),
    (6, 'Potrillos',     v_cat_des,  null,     array[10, 21, 20, 29]),
    (7, 'Los Teros',     v_cat_des,  null,     array[11, 14, 22, 24]);

  v_eq := array[]::uuid[];
  for r in select * from s_eq order by orden loop
    insert into public.equipos (actividad_id, nombre, categoria_id, zona_id)
    values (v_torneo, r.nombre, r.categoria, r.zona)
    returning id into v_act;
    v_eq := v_eq || v_act;

    insert into public.participaciones (actividad_id, jugador_id, equipo_id)
    select v_torneo, ('00000000-0000-4000-a000-' || lpad(n::text, 12, '0'))::uuid, v_act
    from unnest(r.jugadores) n;
  end loop;

  -- Fixture
  -- Copa — Zona A (jugado)
  insert into public.partidos (actividad_id, categoria_id, zona_id, fase, inicio, cancha, equipo_a_id, equipo_b_id,
                               goles_a, goles_b, goles_chukkers, estado, orden)
  values (v_torneo, v_cat_copa, v_zona_a, 'grupos', ((hoy - 3) + time '15:00') at time zone tz, 'Cancha 1',
          v_eq[1], v_eq[2], 7, 5, '[{"a":2,"b":1},{"a":1,"b":2},{"a":3,"b":1},{"a":1,"b":1}]', 'jugado', 1)
  returning id into v_partido;
  insert into public.goleadores (partido_id, jugador_id, cantidad) values
    (v_partido, '00000000-0000-4000-a000-000000000001', 4),
    (v_partido, '00000000-0000-4000-a000-000000000026', 3),
    (v_partido, '00000000-0000-4000-a000-000000000004', 3),
    (v_partido, '00000000-0000-4000-a000-000000000027', 2);

  -- Copa — Zona B (jugado)
  insert into public.partidos (actividad_id, categoria_id, zona_id, fase, inicio, cancha, equipo_a_id, equipo_b_id,
                               goles_a, goles_b, goles_chukkers, estado, orden)
  values (v_torneo, v_cat_copa, v_zona_b, 'grupos', ((hoy - 2) + time '15:00') at time zone tz, 'Cancha 1',
          v_eq[3], v_eq[4], 4, 9, '[{"a":1,"b":2},{"a":1,"b":3},{"a":2,"b":2},{"a":0,"b":2}]', 'jugado', 2)
  returning id into v_partido;
  insert into public.goleadores (partido_id, jugador_id, cantidad) values
    (v_partido, '00000000-0000-4000-a000-000000000013', 5),
    (v_partido, '00000000-0000-4000-a000-000000000019', 2),
    (v_partido, '00000000-0000-4000-a000-000000000008', 3);

  -- Copa — Final: 1.º de la Zona A vs 1.º de la Zona B (se completa sola al terminar cada zona)
  insert into public.partidos (actividad_id, categoria_id, fase, inicio, cancha, desde_a_zona, desde_a_puesto,
                               desde_b_zona, desde_b_puesto, orden)
  values (v_torneo, v_cat_copa, 'final', ((hoy + 4) + time '17:00') at time zone tz, 'Cancha 1',
          v_zona_a, 1, v_zona_b, 1, 10);

  -- Desarrollo — todos contra todos (2 jugados, 1 pendiente)
  insert into public.partidos (actividad_id, categoria_id, fase, inicio, cancha, equipo_a_id, equipo_b_id,
                               goles_a, goles_b, estado, orden)
  values
    (v_torneo, v_cat_des, 'grupos', ((hoy - 3) + time '16:30') at time zone tz, 'Cancha 2', v_eq[5], v_eq[6], 3, 2, 'jugado', 1),
    (v_torneo, v_cat_des, 'grupos', ((hoy - 1) + time '16:30') at time zone tz, 'Cancha 2', v_eq[7], v_eq[6], 5, 3, 'jugado', 2),
    (v_torneo, v_cat_des, 'grupos', ((hoy + 1) + time '16:30') at time zone tz, 'Cancha 2', v_eq[5], v_eq[7], null, null, 'programado', 3);

  -- -------------------------------------------------------------------
  -- Cobros de actividades: vencimiento a 7 días de la actividad; ~65 % pagados.
  -- -------------------------------------------------------------------
  update public.cobros c
    set vencimiento = (a.inicio at time zone tz)::date + 7
    from public.actividades a
    where a.id = c.actividad_id and a.estado = 'finalizada';

  update public.cobros c
    set estado = 'pagado',
        medio_pago = (array['efectivo', 'transferencia', 'mercadopago', 'transferencia'])[1 + abs(hashtext(c.id::text)) % 4]::public.medio_pago,
        pagado_at = least(now(), (a.inicio + make_interval(days => abs(hashtext(c.id::text)) % 6, hours => 2))),
        mp_payment_id = null
    from public.actividades a
    where a.id = c.actividad_id
      and (a.estado = 'finalizada' or a.tipo = 'torneo')
      and abs(hashtext(c.id::text || 'pago')) % 100 < case when a.tipo = 'torneo' then 50 else 65 end;

  -- Un alumno becado
  update public.participaciones set bonificado = true
    where jugador_id = '00000000-0000-4000-a000-000000000025';

  -- -------------------------------------------------------------------
  -- Cuotas sociales de los últimos 3 meses
  -- -------------------------------------------------------------------
  perform public.generar_cuotas_sociales(to_char(hoy - interval '2 months', 'YYYY-MM'));
  perform public.generar_cuotas_sociales(to_char(hoy - interval '1 month', 'YYYY-MM'));
  perform public.generar_cuotas_sociales(to_char(hoy, 'YYYY-MM'));

  update public.cobros c
    set estado = 'pagado',
        medio_pago = (array['transferencia', 'mercadopago', 'efectivo', 'transferencia'])[1 + abs(hashtext(c.id::text)) % 4]::public.medio_pago,
        pagado_at = least(now(), (c.vencimiento - (abs(hashtext(c.id::text)) % 8))::timestamp at time zone tz + interval '11 hours')
    where c.concepto = 'cuota_social'
      and abs(hashtext(c.id::text || 'cuota')) % 100 <
        case c.periodo
          when to_char(hoy - interval '2 months', 'YYYY-MM') then 85
          when to_char(hoy - interval '1 month', 'YYYY-MM') then 65
          else 40
        end;

  -- Un cobro manual de ejemplo
  insert into public.cobros (jugador_id, concepto, descripcion, monto, vencimiento)
  values ('00000000-0000-4000-a000-000000000016', 'otro', 'Pensión de caballo — 1 semana', 60000, hoy + 5);

  -- Pedro dejó el club: queda inactivo (con su historial).
  update public.jugadores set activo = false, notas = 'Se mudó al exterior.'
    where id = '00000000-0000-4000-a000-000000000015';

  -- Marca vencidos los impagos con fecha pasada.
  perform public.procesar_vencimientos();
end;
$$;
