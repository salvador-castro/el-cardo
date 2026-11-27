"use client"

import { CheckIcon, PlusIcon, SearchIcon, ZapIcon } from "lucide-react"
import { useMemo, useRef, useState } from "react"

import type { JugadorCreado } from "@/app/(app)/jugadores/actions"
import { AltaRapidaJugador } from "@/components/jugadores/alta-rapida"
import { InsigniaApto } from "@/components/jugadores/insignias"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { JugadorOpcion } from "@/lib/actividades/constantes"
import { formatearHandicap, normalizarBusqueda } from "@/lib/formato"
import { cn } from "@/lib/utils"

const MAXIMO_VISIBLES = 40

export function aJugadorOpcion(j: JugadorCreado): JugadorOpcion {
  return { ...j, tipo: "externo", apto_estado: "sin_apto", activo: true }
}

// Buscador de jugadores activos con selección múltiple. Avisa (sin bloquear) si el apto está vencido.
export function SelectorJugadores({
  jugadores,
  seleccionados,
  onToggle,
  notas,
  bloqueados,
  onCreado,
  autoFocus,
  destacados,
  soloBusqueda = false,
}: {
  jugadores: JugadorOpcion[]
  seleccionados: string[]
  onToggle: (j: JugadorOpcion) => void
  // Aclaración junto al nombre (p. ej. "En Azul", "Ya anotado").
  notas?: Map<string, string>
  // No se pueden elegir (p. ej. ya anotados o el profesor).
  bloqueados?: Set<string>
  // Alta rápida: el jugador nuevo se agrega a la lista y se selecciona.
  onCreado?: (j: JugadorOpcion) => void
  autoFocus?: boolean
  // Aparecen primero (p. ej. los anotados que todavía no tienen equipo).
  destacados?: Set<string>
  // Compacto: sin búsqueda solo muestra los destacados; con búsqueda, pocos resultados.
  // Al elegir uno se limpia el buscador para seguir con el próximo.
  soloBusqueda?: boolean
}) {
  const [q, setQ] = useState("")
  const buscador = useRef<HTMLInputElement>(null)
  const elegidos = useMemo(() => new Set(seleccionados), [seleccionados])

  const resultados = useMemo(() => {
    const terminos = normalizarBusqueda(q).split(/\s+/).filter(Boolean)
    return jugadores
      .filter((j) => j.activo)
      .filter((j) => {
        if (!terminos.length) return !soloBusqueda || ((destacados?.has(j.id) ?? false) && !elegidos.has(j.id))
        const texto = normalizarBusqueda(`${j.nombre} ${j.apellido} ${j.club_origen ?? ""}`)
        return terminos.every((t) => texto.includes(t))
      })
      .sort(
        (a, b) =>
          Number(destacados?.has(b.id) ?? false) - Number(destacados?.has(a.id) ?? false) ||
          a.apellido.localeCompare(b.apellido, "es") ||
          a.nombre.localeCompare(b.nombre, "es"),
      )
  }, [jugadores, q, destacados, soloBusqueda, elegidos])

  const limite = soloBusqueda ? 8 : MAXIMO_VISIBLES
  const sinBusqueda = q.trim() === ""

  const elegir = (j: JugadorOpcion) => {
    onToggle(j)
    if (soloBusqueda && !elegidos.has(j.id) && !sinBusqueda) {
      setQ("")
      buscador.current?.focus()
    }
  }

  const altaRapida = onCreado && (
    <AltaRapidaJugador
      nombreInicial={q}
      onCreado={(j) => {
        onCreado(aJugadorOpcion(j))
        setQ("")
      }}
      trigger={
        <Button type="button" variant="ghost" size="sm" className="text-dorado-oscuro">
          <ZapIcon /> Alta rápida
        </Button>
      }
    />
  )

  return (
    <div className="rounded-xl border">
      <div
        className={cn(
          "flex items-center gap-2 p-2",
          !(soloBusqueda && sinBusqueda && resultados.length === 0) && "border-b",
        )}
      >
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            ref={buscador}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre o club"
            className="h-10 pl-9"
            aria-label="Buscar jugadores"
            autoFocus={autoFocus}
          />
        </div>
        {altaRapida}
      </div>

      {soloBusqueda && sinBusqueda && resultados.length === 0 ? null : soloBusqueda && sinBusqueda ? (
        <p className="px-3 pt-2 text-xs font-medium text-muted-foreground">Anotados sin equipo</p>
      ) : null}
      {soloBusqueda && sinBusqueda && resultados.length === 0 ? null : resultados.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted-foreground">
          {q ? <>No hay jugadores activos que coincidan con «{q}».</> : <>No hay jugadores activos.</>}
          {onCreado && q && (
            <AltaRapidaJugador
              nombreInicial={q}
              onCreado={(j) => {
                onCreado(aJugadorOpcion(j))
                setQ("")
              }}
              trigger={
                <Button type="button" variant="outline" size="sm">
                  <PlusIcon /> Dar de alta a «{q}»
                </Button>
              }
            />
          )}
        </div>
      ) : (
        <ul className="max-h-72 overflow-y-auto p-1" aria-label="Jugadores">
          {resultados.slice(0, limite).map((j) => {
            const elegido = elegidos.has(j.id)
            const bloqueado = bloqueados?.has(j.id) ?? false
            const nota = notas?.get(j.id)
            return (
              <li key={j.id}>
                <button
                  type="button"
                  onClick={() => elegir(j)}
                  disabled={bloqueado}
                  aria-pressed={elegido}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50",
                    elegido && "bg-dorado/10 hover:bg-dorado/15",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded border",
                      elegido ? "border-marino bg-marino text-crema" : "border-input",
                    )}
                    aria-hidden
                  >
                    {elegido && <CheckIcon className="size-3.5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {j.apellido}, {j.nombre}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[nota, j.club_origen].filter(Boolean).join(" · ") || " "}
                    </span>
                  </span>
                  {j.apto_estado !== "vigente" && <InsigniaApto estado={j.apto_estado} compacta />}
                  <span className="w-8 text-right font-heading text-lg font-semibold tabular-nums">
                    {formatearHandicap(j.handicap)}
                  </span>
                </button>
              </li>
            )
          })}
          {resultados.length > limite && (
            <li className="px-3 py-2 text-center text-xs text-muted-foreground">
              Y {resultados.length - limite} más: escribí para filtrar.
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
