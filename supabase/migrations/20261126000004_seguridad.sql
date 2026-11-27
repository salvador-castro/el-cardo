-- =====================================================================
-- Seguridad: RLS en todas las tablas, permisos de funciones y Storage
-- Regla: solo usuarios autenticados con perfil (admins) leen y escriben.
-- Los anónimos no acceden a nada. Lo que no se borra no tiene policy de delete.
-- =====================================================================

alter table public.perfiles enable row level security;
alter table public.jugadores enable row level security;
alter table public.jugador_documentos enable row level security;
alter table public.handicap_historial enable row level security;
alter table public.configuracion enable row level security;
alter table public.cuota_social_historial enable row level security;
alter table public.actividades enable row level security;
alter table public.torneo_categorias enable row level security;
alter table public.torneo_zonas enable row level security;
alter table public.equipos enable row level security;
alter table public.participaciones enable row level security;
alter table public.partidos enable row level security;
alter table public.goleadores enable row level security;
alter table public.cobros enable row level security;
alter table public.links_pago enable row level security;
alter table public.link_pago_cobros enable row level security;
alter table public.pagos_mp enable row level security;
alter table public.cobro_eventos enable row level security;

-- Perfiles: los admins ven todos; cada uno edita el suyo. Se crean desde el panel o por SQL.
create policy perfiles_select on public.perfiles
  for select to authenticated using (public.es_admin());
create policy perfiles_update on public.perfiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Jugadores: nunca se borran (se marcan inactivos).
create policy jugadores_select on public.jugadores
  for select to authenticated using (public.es_admin());
create policy jugadores_insert on public.jugadores
  for insert to authenticated with check (public.es_admin());
create policy jugadores_update on public.jugadores
  for update to authenticated using (public.es_admin()) with check (public.es_admin());

create policy jugador_documentos_all on public.jugador_documentos
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- Historiales: solo lectura (los escriben triggers).
create policy handicap_historial_select on public.handicap_historial
  for select to authenticated using (public.es_admin());
create policy cuota_social_historial_select on public.cuota_social_historial
  for select to authenticated using (public.es_admin());

create policy configuracion_select on public.configuracion
  for select to authenticated using (public.es_admin());
create policy configuracion_update on public.configuracion
  for update to authenticated using (public.es_admin()) with check (public.es_admin());

-- Actividades: se cancelan, no se borran.
create policy actividades_select on public.actividades
  for select to authenticated using (public.es_admin());
create policy actividades_insert on public.actividades
  for insert to authenticated with check (public.es_admin());
create policy actividades_update on public.actividades
  for update to authenticated using (public.es_admin()) with check (public.es_admin());

create policy torneo_categorias_all on public.torneo_categorias
  for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy torneo_zonas_all on public.torneo_zonas
  for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy equipos_all on public.equipos
  for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy participaciones_all on public.participaciones
  for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy partidos_all on public.partidos
  for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy goleadores_all on public.goleadores
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- Cobros: nunca se borran (se anulan o bonifican).
create policy cobros_select on public.cobros
  for select to authenticated using (public.es_admin());
create policy cobros_insert on public.cobros
  for insert to authenticated with check (public.es_admin());
create policy cobros_update on public.cobros
  for update to authenticated using (public.es_admin()) with check (public.es_admin());

create policy links_pago_select on public.links_pago
  for select to authenticated using (public.es_admin());
create policy links_pago_insert on public.links_pago
  for insert to authenticated with check (public.es_admin());
create policy links_pago_update on public.links_pago
  for update to authenticated using (public.es_admin()) with check (public.es_admin());

create policy link_pago_cobros_select on public.link_pago_cobros
  for select to authenticated using (public.es_admin());
create policy link_pago_cobros_insert on public.link_pago_cobros
  for insert to authenticated with check (public.es_admin());

-- Pagos de MP: los escribe el webhook (service role).
create policy pagos_mp_select on public.pagos_mp
  for select to authenticated using (public.es_admin());

-- Eventos: se agregan, nunca se editan ni se borran.
create policy cobro_eventos_select on public.cobro_eventos
  for select to authenticated using (public.es_admin());
create policy cobro_eventos_insert on public.cobro_eventos
  for insert to authenticated with check (public.es_admin());

-- ---------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------

-- Los anónimos no tocan ninguna tabla ni vista.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- Funciones: nada para anónimos.
revoke execute on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated, service_role;

-- Solo el servidor (service role) lee la página pública y registra pagos de MP.
revoke execute on function public.pago_publico(text) from authenticated;
revoke execute on function public.registrar_pago_mp(text, uuid, text, numeric, jsonb) from authenticated;

-- Lo que se cree más adelante tampoco queda expuesto a anónimos.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon, public;

-- ---------------------------------------------------------------------
-- Storage: buckets privados
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('fotos', 'fotos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('documentos', 'documentos', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
  ('comprobantes', 'comprobantes', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy storage_admin_select on storage.objects
  for select to authenticated
  using (bucket_id in ('fotos', 'documentos', 'comprobantes') and public.es_admin());
create policy storage_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id in ('fotos', 'documentos', 'comprobantes') and public.es_admin());
create policy storage_admin_update on storage.objects
  for update to authenticated
  using (bucket_id in ('fotos', 'documentos', 'comprobantes') and public.es_admin());
create policy storage_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id in ('fotos', 'documentos', 'comprobantes') and public.es_admin());
