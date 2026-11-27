import { TrophyIcon } from "lucide-react"

import { Camiseta } from "@/components/actividades/camiseta"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { CategoriaDetalle, EquipoDetalle } from "@/lib/actividades/detalle"
import type { FilaPosicion, Goleador, PartidoTorneo } from "@/lib/torneos/constantes"
import { cn } from "@/lib/utils"

export function TabPosiciones({
  categorias,
  equipos,
  posiciones,
  goleadores,
  partidos,
}: {
  categorias: CategoriaDetalle[]
  equipos: EquipoDetalle[]
  posiciones: FilaPosicion[]
  goleadores: Goleador[]
  partidos: PartidoTorneo[]
}) {
  if (categorias.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card px-6 py-14 text-center text-sm text-muted-foreground">
        Todavía no hay categorías.
      </div>
    )
  }

  const porId = new Map(equipos.map((e) => [e.id, e]))

  return (
    <div className="space-y-8">
      {categorias.map((c) => {
        const tablas = c.formato === "eliminacion" ? [] : c.zonas.length ? c.zonas : [{ id: null, nombre: "Grupo único", orden: 0 }]
        // Puestos de cada zona que pasan a la llave (según los cruces cargados).
        const clasifican = new Map<string, number>()
        for (const p of partidos.filter((x) => x.categoria_id === c.id)) {
          for (const [zona, puesto] of [
            [p.desde_a_zona, p.desde_a_puesto],
            [p.desde_b_zona, p.desde_b_puesto],
          ] as const) {
            if (zona && puesto) clasifican.set(zona, Math.max(clasifican.get(zona) ?? 0, puesto))
          }
        }
        const final = partidos.find((p) => p.categoria_id === c.id && p.fase === "final" && p.estado === "jugado")
        const campeon = final ? porId.get(((final.goles_a ?? 0) > (final.goles_b ?? 0) ? final.equipo_a_id : final.equipo_b_id) ?? "") : null
        const goleadoresCat = goleadores.filter((g) => g.categoria_id === c.id).slice(0, 10)

        return (
          <section key={c.id} className="space-y-3">
            <h3 className="border-b pb-2 font-heading text-2xl font-semibold">{c.nombre}</h3>

            {campeon && (
              <p className="flex items-center gap-2 rounded-xl border border-dorado/60 bg-dorado/10 px-4 py-3 font-medium">
                <TrophyIcon className="size-5 text-dorado-oscuro" /> Campeón: {campeon.nombre}
              </p>
            )}

            <div className="grid gap-4 xl:grid-cols-[1fr_20rem]">
              <div className="space-y-4">
                {tablas.length === 0 ? (
                  <p className="rounded-xl border border-dashed bg-card px-4 py-6 text-center text-sm text-muted-foreground">
                    Se juega por eliminación directa: el avance se ve en la llave (pestaña Fixture).
                  </p>
                ) : (
                  tablas.map((z) => {
                    const filas = posiciones
                      .filter((p) => p.categoria_id === c.id && (z.id ? p.zona_id === z.id : !p.zona_id))
                      .sort((a, b) => a.posicion - b.posicion)
                    const pasan = z.id ? (clasifican.get(z.id) ?? 0) : 0
                    return (
                      <Card key={z.id ?? "unico"} className="gap-0 py-0">
                        <CardHeader className="border-b py-3">
                          <CardTitle className="text-base font-semibold">
                            {z.nombre}
                            {pasan > 0 && (
                              <span className="ml-2 text-xs font-normal text-muted-foreground">
                                · {pasan === 1 ? "pasa el 1.º" : `pasan los ${pasan} primeros`} a la llave
                              </span>
                            )}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="overflow-x-auto px-0">
                          {filas.length === 0 ? (
                            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Sin equipos asignados.</p>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/40 hover:bg-muted/40">
                                  {["#", "Equipo", "PJ", "PG", "PE", "PP", "GF", "GC", "DIF", "PTS"].map((h) => (
                                    <TableHead
                                      key={h}
                                      className={cn("h-9 px-3 text-xs text-muted-foreground", h !== "Equipo" && "text-center")}
                                    >
                                      {h}
                                    </TableHead>
                                  ))}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {filas.map((f) => {
                                  const e = porId.get(f.equipo_id)
                                  const pasa = f.posicion <= pasan
                                  return (
                                    <TableRow key={f.equipo_id} className={cn(pasa && "bg-exito-suave/40")}>
                                      <TableCell className="px-3 text-center font-semibold tabular-nums">{f.posicion}</TableCell>
                                      <TableCell className="px-3">
                                        <span className="flex items-center gap-2 font-medium">
                                          <Camiseta color={e?.color ?? null} className="size-5" />
                                          {e?.nombre}
                                        </span>
                                      </TableCell>
                                      {[f.pj, f.pg, f.pe, f.pp, f.gf, f.gc, f.dif > 0 ? `+${f.dif}` : f.dif].map((v, i) => (
                                        <TableCell key={i} className="px-3 text-center tabular-nums">
                                          {v}
                                        </TableCell>
                                      ))}
                                      <TableCell className="px-3 text-center font-heading text-lg font-semibold tabular-nums">
                                        {f.pts}
                                      </TableCell>
                                    </TableRow>
                                  )
                                })}
                              </TableBody>
                            </Table>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })
                )}
                {tablas.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Puntos: {c.puntos_victoria} por ganar, {c.puntos_empate} por empatar y {c.puntos_derrota} por perder.
                    Desempate: diferencia de gol y goles a favor.
                  </p>
                )}
              </div>

              <Card className="gap-0 self-start py-0">
                <CardHeader className="border-b py-3">
                  <CardTitle className="text-base font-semibold">Goleadores</CardTitle>
                </CardHeader>
                <CardContent className="px-0">
                  {goleadoresCat.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-muted-foreground">Todavía no hay goleadores cargados.</p>
                  ) : (
                    <ol className="divide-y">
                      {goleadoresCat.map((g, i) => (
                        <li key={g.jugador_id} className="flex items-center gap-3 px-4 py-2 text-sm">
                          <span className="w-5 text-muted-foreground tabular-nums">{i + 1}</span>
                          <span className="min-w-0 flex-1 truncate">{g.jugador}</span>
                          <span className="font-heading text-lg font-semibold tabular-nums">{g.goles}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </CardContent>
              </Card>
            </div>
          </section>
        )
      })}
    </div>
  )
}
