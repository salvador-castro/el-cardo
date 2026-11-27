# El Cardo Polo Club — Gestión

Sistema interno para administrar el club: jugadores, actividades, torneos y cobros con Mercado Pago.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind 4 + shadcn/ui · Supabase (Postgres, Auth, Storage) · Mercado Pago Checkout Pro · Vercel.

## Puesta en marcha

1. Instalar dependencias:

   ```bash
   npm install
   ```

2. Copiar `.env.example` a `.env.local` y completar las claves de Supabase (Project Settings → API Keys).

3. Vincular el proyecto de Supabase y aplicar migraciones + datos de demo:

   ```bash
   npx supabase login
   npx supabase link --project-ref <ref-del-proyecto>
   npm run db:seed      # aplica migraciones y supabase/seed.sql
   npm run db:tipos     # regenera src/types/database.ts desde Supabase
   ```

   > En Supabase: Authentication → Sign In / Providers → desactivar "Allow new users to sign up".
   > Los usuarios se crean desde el panel y necesitan una fila en `perfiles` para entrar.

4. Levantar la app:

   ```bash
   npm run dev
   ```

   Usuario de demo: `admin@elcardo.test` / `ElCardo2026!`

## Scripts

| Script | Qué hace |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` · `npm run typecheck` | ESLint y TypeScript |
| `npm run db:probar` | Aplica migraciones + seed en un Postgres 17 en memoria (PGlite) y prueba reglas de negocio y RLS. No necesita Supabase. |
| `npm run db:tipos:local` | Genera `src/types/database.ts` desde las migraciones (sin Supabase). |
| `npm run db:tipos` | Genera los tipos desde el proyecto linkeado (`supabase gen types`). |
| `npm run db:push` / `db:seed` | Aplica migraciones (y seed) al proyecto linkeado. |

## Estructura

```
supabase/
  migrations/   esquema, funciones y triggers, vistas, seguridad (RLS + Storage), datos iniciales
  seed.sql      datos de demo (fechas relativas al día en que se corre)
scripts/db/     PGlite: pruebas del SQL y generador de tipos
src/
  proxy.ts      protección de rutas (ex middleware)
  app/login     login
  app/(app)/    módulos protegidos (layout con sidebar + navegación móvil)
  lib/supabase  clientes: browser, server (RLS) y admin (service role, solo servidor)
```

## Reglas que viven en la base

- Historial de hándicap automático (trigger).
- Al anotar a un jugador en una actividad con precio se crea su cobro; al quitarlo o cancelar la actividad, los impagos se anulan; al cambiar el precio se actualizan los pendientes.
- Un jugador no puede estar dos veces en la misma actividad (ni en dos equipos del mismo torneo).
- Cuota social: el cambio de monto rige desde el mes siguiente; `generar_cuotas_sociales()` es idempotente.
- Cobros: nunca se borran; cambiar el monto o cancelarlos invalida sus links de pago; "pagado por Mercado Pago" solo lo marca el webhook (`registrar_pago_mp`, idempotente).
- RLS en todas las tablas: solo usuarios con perfil. Los anónimos no acceden a nada.
