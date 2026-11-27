"use client"

import { AlertTriangleIcon, CheckIcon, Loader2Icon, ShuffleIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { guardarDescansos } from "@/app/(app)/actividades/actions"
import { Button } from "@/components/ui/button"
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { ColorCamiseta } from "@/lib/actividades/colores"
import { COLOR_CAMISETA } from "@/lib/actividades/colores"
import type { JugadorOpcion } from "@/lib/actividades/constantes"
import { sumaHandicap } from "@/lib/actividades/detalle"
import { formatearHandicap } from "@/lib/formato"
import { cn } from "@/lib/utils"

// En cancha juegan 4 por equipo.
export const EN_CANCHA = 4

export type Descanso = { jugador_id: string; chukker: number }

// Reparto automático "a la americana": las bajas van de a 2 chukkers seguidos (1-2, 3-4, 5-6) cuando la
// cantidad de chukkers es par; si es impar, de a uno. En cada tramo descansan (jugadores - 4), rotando
// desde los de menor hándicap, así nadie descansa dos veces antes de que descansen todos.
export function repartirDescansos(jugadores: JugadorOpcion[], chukkers: number): Descanso[] {
  const porTramo = Math.max(0, jugadores.length - EN_CANCHA)
  if (!porTramo) return []
  const largo = chukkers % 2 === 0 ? 2 : 1
  const orden = [...jugadores].sort((a, b) => a.handicap - b.handicap || a.apellido.localeCompare(b.apellido, "es"))
  const descansos: Descanso[] = []
  let i = 0
  for (let inicio = 1; inicio <= chukkers; inicio += largo) {
    for (let k = 0; k < porTramo; k++) {
      const jugador = orden[i % orden.length]
      for (let c = inicio; c < inicio + largo && c <= chukkers; c++) descansos.push({ jugador_id: jugador.id, chukker: c })
      i++
    }
  }
  return descansos
}

type EquipoRotacion = { nombre: string; color: ColorCamiseta | null; jugadores: JugadorOpcion[] }

export function ContenidoRotacion({
  partidoId,
  chukkers,
  equipos,
  inicial,
  onCerrar,
}: {
  partidoId: string
  chukkers: number
  equipos: EquipoRotacion[]
  inicial: Descanso[]
  onCerrar: () => void
}) {
  const router = useRouter()
  const [pendiente, startTransition] = useTransition()
  const [descansos, setDescansos] = useState<Set<string>>(
    () => new Set(inicial.filter((d) => d.chukker <= chukkers).map((d) => `${d.jugador_id}|${d.chukker}`)),
  )
  const columnas = Array.from({ length: chukkers }, (_, i) => i + 1)

  const baja = (jugadorId: string, c: number) => descansos.has(`${jugadorId}|${c}`)
  const alternar = (jugadorId: string, c: number) =>
    setDescansos((s) => {
      const n = new Set(s)
      const clave = `${jugadorId}|${c}`
      if (n.has(clave)) n.delete(clave)
      else n.add(clave)
      return n
    })

  const repartir = () => {
    const nuevos = equipos.flatMap((e) => repartirDescansos(e.jugadores, chukkers))
    setDescansos(new Set(nuevos.map((d) => `${d.jugador_id}|${d.chukker}`)))
  }

  const enCancha = (e: EquipoRotacion, c: number) => e.jugadores.filter((j) => !baja(j.id, c))

  // Aviso si en algún chukker no quedan 4 en cancha (cuando el equipo tiene 4 o más).
  const avisos = equipos.flatMap((e) =>
    columnas
      .map((c) => ({ c, n: enCancha(e, c).length }))
      .filter(({ n }) => e.jugadores.length >= EN_CANCHA && n !== EN_CANCHA)
      .map(({ c, n }) => `${e.nombre}: ${n} en cancha en el chukker ${c}`),
  )

  const guardar = () =>
    startTransition(async () => {
      const lista = [...descansos].map((clave) => {
        const [jugador_id, c] = clave.split("|")
        return { jugador_id, chukker: Number(c) }
      })
      const r = await guardarDescansos(partidoId, lista)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success("Rotación guardada.")
      onCerrar()
      router.refresh()
    })

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-heading text-2xl">Rotación · {chukkers} chukkers</DialogTitle>
        <DialogDescription>
          A la americana: juegan 4 por equipo y el resto queda de baja. Tocá una casilla para pasar de ✓ a BAJA.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-5">
        <Button variant="outline" onClick={repartir}>
          <ShuffleIcon /> Repartir automáticamente
          <span className="text-xs text-muted-foreground">{chukkers % 2 === 0 ? "(bajas de a 2 chukkers)" : ""}</span>
        </Button>

        {equipos.map((e) => {
          const oscuro = e.color === "negro" || e.color === "azul" || e.color === "bordo" || e.color === "verde"
          return (
            <section key={e.nombre} className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span
                  className="rounded-full border-2 border-marino px-4 py-1 text-sm font-semibold tracking-[0.15em] uppercase"
                  style={e.color ? { backgroundColor: COLOR_CAMISETA[e.color].hex, color: oscuro ? "#fff" : undefined } : undefined}
                >
                  {e.nombre}
                </span>
                <span className="text-sm text-muted-foreground">
                  Handicap total{" "}
                  <b className="font-heading text-2xl text-foreground tabular-nums">{formatearHandicap(sumaHandicap(e.jugadores))}</b>
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-separate border-spacing-1 text-sm">
                  <thead>
                    <tr>
                      <th />
                      {columnas.map((c) => (
                        <th key={c} className="min-w-14 px-1 text-center text-xs font-medium text-muted-foreground">
                          <span className="hidden sm:inline">Chukker </span>
                          <span className="sm:hidden">Ch. </span>
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {e.jugadores.map((j) => (
                      <tr key={j.id}>
                        <td className="rounded-md bg-muted/60 px-3 py-1.5">
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate font-medium">
                              {j.nombre} {j.apellido}
                            </span>
                            <span className="rounded-full bg-marino px-1.5 text-[0.7rem] font-semibold text-crema tabular-nums">
                              {formatearHandicap(j.handicap)}
                            </span>
                          </span>
                        </td>
                        {columnas.map((c) => {
                          const b = baja(j.id, c)
                          return (
                            <td key={c} className="p-0">
                              <button
                                type="button"
                                onClick={() => alternar(j.id, c)}
                                aria-pressed={b}
                                aria-label={`${j.nombre} ${j.apellido}, chukker ${c}: ${b ? "de baja" : "juega"}`}
                                className={cn(
                                  "flex h-9 w-full items-center justify-center rounded-md border text-xs font-bold tracking-wide transition-colors",
                                  b
                                    ? "border-destructive bg-card text-destructive"
                                    : "border-transparent bg-exito-suave text-exito hover:border-exito/40",
                                )}
                              >
                                {b ? "BAJA" : <CheckIcon className="size-4 stroke-3" />}
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                    <tr>
                      <td className="rounded-md bg-marino px-3 py-2 text-xs font-semibold tracking-wide text-crema uppercase">
                        HC en cancha
                      </td>
                      {columnas.map((c) => (
                        <td
                          key={c}
                          className="rounded-md border-2 border-marino text-center font-heading text-xl font-semibold tabular-nums"
                        >
                          {formatearHandicap(sumaHandicap(enCancha(e, c)))}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          )
        })}

        {avisos.length > 0 && (
          <div className="flex gap-2 rounded-lg bg-alerta-suave px-3 py-2 text-sm text-alerta">
            <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
            <ul>
              {avisos.slice(0, 4).map((a) => (
                <li key={a}>{a}.</li>
              ))}
              {avisos.length > 4 && <li>Y {avisos.length - 4} más.</li>}
            </ul>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" size="lg" onClick={onCerrar}>
          Cancelar
        </Button>
        <Button size="lg" onClick={guardar} disabled={pendiente} className="min-w-32">
          {pendiente && <Loader2Icon className="animate-spin" />}
          Guardar rotación
        </Button>
      </DialogFooter>
    </>
  )
}
