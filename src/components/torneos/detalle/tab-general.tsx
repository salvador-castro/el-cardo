import { CalendarClockIcon, LayersIcon } from "lucide-react"

import { Camiseta } from "@/components/actividades/camiseta"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { CategoriaDetalle, EquipoDetalle } from "@/lib/actividades/detalle"
import { formatearFechaLarga, formatearHora } from "@/lib/formato"
import { ETIQUETA_FORMATO, type Goleador, type PartidoTorneo } from "@/lib/torneos/constantes"
import { nombresDePartidos, textoOrigen } from "@/lib/torneos/nombres"

export function TabGeneral({
  categorias,
  equipos,
  partidos,
  goleadores,
}: {
  categorias: CategoriaDetalle[]
  equipos: EquipoDetalle[]
  partidos: PartidoTorneo[]
  goleadores: Goleador[]
}) {
  const porId = new Map(equipos.map((e) => [e.id, e]))
  const nombres = nombresDePartidos(partidos)
  const zonas = new Map(categorias.flatMap((c) => c.zonas.map((z) => [z.id, z.nombre] as const)))
  const nombreCategoria = new Map(categorias.map((c) => [c.id, c.nombre]))
  const proximos = partidos
    .filter((p) => p.estado !== "jugado" && p.inicio)
    .sort((a, b) => a.inicio!.localeCompare(b.inicio!))
    .slice(0, 6)
  const lado = (p: PartidoTorneo, l: "a" | "b") => {
    const id = l === "a" ? p.equipo_a_id : p.equipo_b_id
    const e = id ? porId.get(id) : null
    return { e, texto: e?.nombre ?? textoOrigen(p, l, nombres, zonas) ?? "A definir" }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-heading text-xl font-semibold">
            <LayersIcon className="size-5 text-dorado-oscuro" /> Categorías
          </CardTitle>
        </CardHeader>
        <CardContent>
          {categorias.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay categorías: empezá por la pestaña Categorías.</p>
          ) : (
            <ul className="divide-y">
              {categorias.map((c) => {
                const ps = partidos.filter((p) => p.categoria_id === c.id)
                return (
                  <li key={c.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{c.nombre}</p>
                      <p className="text-xs text-muted-foreground">
                        {ETIQUETA_FORMATO[c.formato]}
                        {c.zonas.length > 0 && ` · ${c.zonas.length} zonas`}
                      </p>
                    </div>
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {equipos.filter((e) => e.categoria_id === c.id).length} equipos ·{" "}
                      {ps.filter((p) => p.estado === "jugado").length}/{ps.length} jugados
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-heading text-xl font-semibold">
            <CalendarClockIcon className="size-5 text-dorado-oscuro" /> Próximos partidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {proximos.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay partidos por jugar con día y hora.</p>
          ) : (
            <ul className="divide-y">
              {proximos.map((p) => {
                const [a, b] = [lado(p, "a"), lado(p, "b")]
                return (
                  <li key={p.id} className="py-2.5">
                    <p className="text-xs text-muted-foreground">
                      {formatearFechaLarga(p.inicio)} · {formatearHora(p.inicio)} h · {nombreCategoria.get(p.categoria_id ?? "")}{" "}
                      · {nombres.get(p.id)}
                      {p.cancha && ` · ${p.cancha}`}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm font-medium">
                      <Camiseta color={a.e?.color ?? null} className="size-4" /> {a.texto}
                      <span className="text-muted-foreground">vs</span>
                      <Camiseta color={b.e?.color ?? null} className="size-4" /> {b.texto}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {goleadores.length > 0 && (
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-heading text-xl font-semibold">Goleadores del torneo</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="grid gap-x-6 sm:grid-cols-2">
              {goleadores.slice(0, 6).map((g, i) => (
                <li key={`${g.categoria_id}-${g.jugador_id}`} className="flex items-center gap-3 border-b py-2 text-sm">
                  <span className="w-5 text-muted-foreground tabular-nums">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {g.jugador} <span className="text-muted-foreground">· {nombreCategoria.get(g.categoria_id ?? "")}</span>
                  </span>
                  <span className="font-heading text-lg font-semibold tabular-nums">{g.goles}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
