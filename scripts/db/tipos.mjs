// Genera src/types/database.ts a partir de las migraciones (vía PGlite), con el mismo
// formato que `supabase gen types typescript`. Se usa mientras no haya proyecto linkeado;
// con el proyecto linkeado, preferir `npm run db:tipos` (genera desde Supabase).
// Uso: npm run db:tipos:local
import fs from 'node:fs'
import path from 'node:path'
import { crearBase, ROOT } from './pglite.mjs'

const db = await crearBase({ log: false })
const q = async (sql) => (await db.query(sql)).rows

const enums = await q(`
  select t.typname as nombre, array_agg(e.enumlabel order by e.enumsortorder) as valores
  from pg_type t join pg_enum e on e.enumtypid = t.oid
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public'
  group by t.typname order by t.typname`)
const enumNames = new Set(enums.map(e => e.nombre))

const relaciones = await q(`
  select c.relname as nombre, c.relkind as tipo
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'v')
  order by c.relname`)

const columnas = await q(`
  select c.relname as tabla, a.attname as columna, a.attnum as orden,
         format_type(a.atttypid, a.atttypmod) as tipo_fmt,
         t.typname as tipo, t.typcategory as categoria,
         et.typname as elem_tipo,
         not a.attnotnull as nullable,
         a.atthasdef as tiene_default,
         a.attidentity as identity,
         a.attgenerated as generada
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_type t on t.oid = a.atttypid
  left join pg_type et on et.oid = t.typelem and t.typcategory = 'A'
  where n.nspname = 'public' and c.relkind in ('r', 'v') and a.attnum > 0 and not a.attisdropped
  order by c.relname, a.attnum`)

const fks = await q(`
  select con.conname as nombre, c.relname as tabla, rc.relname as ref_tabla,
         array(select a.attname from unnest(con.conkey) with ordinality k(n, i)
               join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.n order by k.i) as columnas,
         array(select a.attname from unnest(con.confkey) with ordinality k(n, i)
               join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.n order by k.i) as ref_columnas,
         exists (
           select 1 from pg_index ix
           where ix.indrelid = con.conrelid and ix.indisunique and ix.indpred is null
             and (select array_agg(x order by x) from unnest(ix.indkey::int2[]) x)
               = (select array_agg(x order by x) from unnest(con.conkey) x)
         ) as uno_a_uno
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_class rc on rc.oid = con.confrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_namespace rn on rn.oid = rc.relnamespace
  where con.contype = 'f' and n.nspname = 'public' and rn.nspname = 'public'
  order by c.relname, con.conname`)

const funciones = await q(`
  select p.proname as nombre,
         coalesce(p.proargnames, array[]::text[]) as arg_nombres,
         coalesce(p.proargmodes::text[], array[]::text[]) as arg_modos,
         array(select t.typname from unnest(coalesce(p.proallargtypes, p.proargtypes::oid[])) with ordinality x(oid, i)
               join pg_type t on t.oid = x.oid order by x.i) as arg_tipos,
         p.pronargs as n_in, p.pronargdefaults as n_defaults,
         rt.typname as ret_tipo, rt.typtype as ret_typtype, p.proretset as setof
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_type rt on rt.oid = p.prorettype
  where n.nspname = 'public' and rt.typname <> 'trigger' and p.prokind = 'f'
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  order by p.proname`)

function tsBase(tipo, elem) {
  if (elem) return `${tsBase(elem)}[]`
  if (enumNames.has(tipo)) return `Database["public"]["Enums"]["${tipo}"]`
  switch (tipo) {
    case 'int2': case 'int4': case 'int8': case 'float4': case 'float8': case 'numeric':
      return 'number'
    case 'bool':
      return 'boolean'
    case 'json': case 'jsonb':
      return 'Json'
    case 'void':
      return 'undefined'
    default:
      return 'string'
  }
}

const ind = (n) => '  '.repeat(n)
const porTabla = (t) => columnas.filter(c => c.tabla === t)
const tipoTabla = new Map(relaciones.map(r => [r.nombre, r.tipo]))

function relationships(tabla, n) {
  const rels = fks.filter(f => f.tabla === tabla)
  if (!rels.length) return `${ind(n)}Relationships: []`
  const items = rels.map(f => [
    `${ind(n + 1)}{`,
    `${ind(n + 2)}foreignKeyName: "${f.nombre}"`,
    `${ind(n + 2)}columns: [${f.columnas.map(c => `"${c}"`).join(', ')}]`,
    `${ind(n + 2)}isOneToOne: ${f.uno_a_uno}`,
    `${ind(n + 2)}referencedRelation: "${f.ref_tabla}"`,
    `${ind(n + 2)}referencedColumns: [${f.ref_columnas.map(c => `"${c}"`).join(', ')}]`,
    `${ind(n + 1)}},`,
  ].join('\n'))
  return `${ind(n)}Relationships: [\n${items.join('\n')}\n${ind(n)}]`
}

let out = []
out.push(`// Generado por scripts/db/tipos.mjs — no editar a mano.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {`)

for (const r of relaciones.filter(r => r.tipo === 'r')) {
  const cols = porTabla(r.nombre)
  const row = cols.map(c => `${ind(4)}${c.columna}: ${tsBase(c.tipo, c.elem_tipo)}${c.nullable ? ' | null' : ''}`)
  const ins = cols.map(c => {
    if (c.generada === 's' || c.identity === 'a') return `${ind(4)}${c.columna}?: never`
    const opt = c.nullable || c.tiene_default || c.identity === 'd'
    return `${ind(4)}${c.columna}${opt ? '?' : ''}: ${tsBase(c.tipo, c.elem_tipo)}${c.nullable ? ' | null' : ''}`
  })
  const upd = cols.map(c => {
    if (c.generada === 's' || c.identity === 'a') return `${ind(4)}${c.columna}?: never`
    return `${ind(4)}${c.columna}?: ${tsBase(c.tipo, c.elem_tipo)}${c.nullable ? ' | null' : ''}`
  })
  out.push(`${ind(3)}${r.nombre}: {
${ind(3)}  Row: {
${row.map(l => '  ' + l).join('\n')}
${ind(3)}  }
${ind(3)}  Insert: {
${ins.map(l => '  ' + l).join('\n')}
${ind(3)}  }
${ind(3)}  Update: {
${upd.map(l => '  ' + l).join('\n')}
${ind(3)}  }
${relationships(r.nombre, 4)}
${ind(3)}}`)
}
out.push(`${ind(2)}}
${ind(2)}Views: {`)

for (const r of relaciones.filter(r => r.tipo === 'v')) {
  const cols = porTabla(r.nombre)
  const row = cols.map(c => `${ind(5)}${c.columna}: ${tsBase(c.tipo, c.elem_tipo)} | null`)
  out.push(`${ind(3)}${r.nombre}: {
${ind(4)}Row: {
${row.join('\n')}
${ind(4)}}
${ind(4)}Relationships: []
${ind(3)}}`)
}
out.push(`${ind(2)}}
${ind(2)}Functions: {`)

for (const f of funciones) {
  const args = []
  const outCols = []
  const nIn = f.n_in
  let inIdx = 0
  f.arg_tipos.forEach((t, i) => {
    const modo = f.arg_modos[i] ?? 'i'
    const nombre = f.arg_nombres[i]
    if (modo === 'i' || modo === 'b') {
      const opcional = inIdx >= nIn - f.n_defaults
      args.push(`${ind(5)}${nombre}${opcional ? '?' : ''}: ${tsBase(t.replace(/^_/, ''), t.startsWith('_') ? t.slice(1) : null)}`)
      inIdx++
    }
    if (modo === 't' || modo === 'o' || modo === 'b') {
      outCols.push(`${ind(6)}${nombre}: ${tsBase(t.replace(/^_/, ''), t.startsWith('_') ? t.slice(1) : null)}`)
    }
  })
  let ret
  if (outCols.length) {
    ret = `{\n${outCols.join('\n')}\n${ind(5)}}[]`
  } else if (f.ret_typtype === 'c' && tipoTabla.get(f.ret_tipo) === 'r') {
    ret = `Database["public"]["Tables"]["${f.ret_tipo}"]["Row"]${f.setof ? '[]' : ''}`
  } else {
    ret = tsBase(f.ret_tipo.replace(/^_/, ''), f.ret_tipo.startsWith('_') ? f.ret_tipo.slice(1) : null) + (f.setof ? '[]' : '')
  }
  out.push(`${ind(3)}${f.nombre}: {
${ind(4)}Args: ${args.length ? `{\n${args.join('\n')}\n${ind(4)}}` : 'never'}
${ind(4)}Returns: ${ret}
${ind(3)}}`)
}

out.push(`${ind(2)}}
${ind(2)}Enums: {
${enums.map(e => `${ind(3)}${e.nombre}:\n${e.valores.map(v => `${ind(4)}| "${v}"`).join('\n')}`).join('\n')}
${ind(2)}}
${ind(2)}CompositeTypes: {
${ind(3)}[_ in never]: never
${ind(2)}}
${ind(1)}}
}

type PublicSchema = Database["public"]

export type Tables<T extends keyof (PublicSchema["Tables"] & PublicSchema["Views"])> =
  (PublicSchema["Tables"] & PublicSchema["Views"])[T] extends { Row: infer R } ? R : never

export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T] extends { Insert: infer I } ? I : never

export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T] extends { Update: infer U } ? U : never

export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]

export const Constants = {
  public: {
    Enums: {
${enums.map(e => `      ${e.nombre}: [${e.valores.map(v => `"${v}"`).join(', ')}],`).join('\n')}
    },
  },
} as const
`)

const destino = path.join(ROOT, 'src/types/database.ts')
fs.mkdirSync(path.dirname(destino), { recursive: true })
fs.writeFileSync(destino, out.join('\n'))
console.log('Tipos generados en', path.relative(ROOT, destino))
