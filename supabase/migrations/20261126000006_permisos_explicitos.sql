-- Los proyectos nuevos de Supabase ya no otorgan permisos automáticos sobre las tablas
-- de `public` a los roles de la API. Se otorgan explícitamente acá.
-- RLS sigue decidiendo qué filas ve cada uno (solo admins con perfil);
-- `anon` no recibe nada.

grant usage on schema public to authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges in schema public
  grant usage, select on sequences to authenticated, service_role;
alter default privileges in schema public
  grant execute on functions to authenticated, service_role;
