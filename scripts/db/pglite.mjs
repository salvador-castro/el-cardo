// Levanta una base Postgres 17 en memoria (PGlite) con stubs mínimos de Supabase
// (roles, auth, storage) y aplica las migraciones del proyecto. Sirve para probar
// el SQL y generar tipos sin Docker ni conexión a Supabase.
import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { unaccent } from '@electric-sql/pglite/contrib/unaccent'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

const STUBS = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;
create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (
  instance_id uuid, id uuid primary key, aud text, role text, email text, encrypted_password text,
  email_confirmed_at timestamptz, raw_app_meta_data jsonb, raw_user_meta_data jsonb,
  created_at timestamptz, updated_at timestamptz, confirmation_token text, recovery_token text,
  email_change_token_new text, email_change text
);
create table auth.identities (
  id uuid primary key, provider_id text, user_id uuid references auth.users, identity_data jsonb, provider text,
  last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant execute on function auth.uid() to anon, authenticated, service_role;
create schema storage;
grant usage on schema storage to anon, authenticated, service_role;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
grant all on storage.objects to authenticated;
-- Igual que los proyectos nuevos de Supabase: sin permisos automáticos sobre tablas de public.
-- (Las funciones sí quedan ejecutables por PUBLIC, como en cualquier Postgres.)
`

export async function crearBase({ seed = false, log = true } = {}) {
  const db = new PGlite({ extensions: { pg_trgm, unaccent, pgcrypto } })
  await db.exec(STUBS)

  const migDir = path.join(ROOT, 'supabase/migrations')
  for (const f of fs.readdirSync(migDir).filter(f => f.endsWith('.sql')).sort()) {
    try {
      await db.exec(fs.readFileSync(path.join(migDir, f), 'utf8'))
      if (log) console.log('OK  ', f)
    } catch (e) {
      throw new Error(`Falló ${f}: ${e.message}`)
    }
  }

  if (seed) {
    try {
      await db.exec(fs.readFileSync(path.join(ROOT, 'supabase/seed.sql'), 'utf8'))
      if (log) console.log('OK   seed.sql')
    } catch (e) {
      throw new Error(`Falló seed.sql: ${e.message} ${e.where ?? ''}`)
    }
  }

  return db
}
