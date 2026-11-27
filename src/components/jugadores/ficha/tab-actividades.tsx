import { CalendarDaysIcon, GraduationCapIcon, TrophyIcon, UsersIcon, type LucideIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatearFecha, formatearHora } from "@/lib/formato"
import { cn } from "@/lib/utils"
import type { Enums } from "@/types/database"

type TipoActividad = Enums<"tipo_actividad">
type EstadoActividad = Enums<"estado_actividad">

type Participacion = {
  id: string
  asistencia: Enums<"asistencia"> | null
  bonificado: boolean
  equipo: { nombre: string } | null
  actividad: { id: string; tipo: TipoActividad; nombre: string; inicio: string; estado: EstadoActividad }
}

type Clase = {
  id: string | null
  tipo: TipoActividad | null
  nombre: string | null
  inicio: string | null
  estado: EstadoActividad | null
  participantes: number | null
  presentes: number | null
}

const TIPO: Record<TipoActividad, { etiqueta: string; icono: LucideIcon }> = {
  practica: { etiqueta: "Práctica", icono: UsersIcon },
  clase: { etiqueta: "Clase", icono: GraduationCapIcon },
  torneo: { etiqueta: "Torneo", icono: TrophyIcon },
}

export function TabActividades({
  participaciones,
  clases,
  esProfesor,
}: {
  participaciones: Participacion[]
  clases: Clase[]
  esProfesor: boolean
}) {
  const conAsistencia = participaciones.filter((p) => p.asistencia)
  const presentes = conAsistencia.filter((p) => p.asistencia === "presente").length
  const porTipo = (t: TipoActividad) => participaciones.filter((p) => p.actividad.tipo === t).length

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Resumen etiqueta="Prácticas" valor={porTipo("practica")} />
        <Resumen etiqueta="Clases" valor={porTipo("clase")} />
        <Resumen etiqueta="Torneos" valor={porTipo("torneo")} />
        <Resumen
          etiqueta="Asistencia"
          valor={conAsistencia.length ? `${Math.round((presentes / conAsistencia.length) * 100)} %` : "—"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-xl font-semibold">Como jugador</CardTitle>
        </CardHeader>
        <CardContent>
          {participaciones.length ? (
            <ul className="divide-y divide-border">
              {participaciones.map((p) => {
                const { icono: Icono, etiqueta } = TIPO[p.actividad.tipo]
                return (
                  <li key={p.id} className={cn("flex items-center gap-3 py-3", p.actividad.estado === "cancelada" && "opacity-50")}>
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-marino">
                      <Icono className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{p.actividad.nombre}</p>
                      <p className="text-xs text-muted-foreground">
                        {etiqueta} · {formatearFecha(p.actividad.inicio)} {formatearHora(p.actividad.inicio)} h
                        {p.equipo && ` · Equipo ${p.equipo.nombre}`}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {p.actividad.estado === "cancelada" ? (
                        <Badge variant="outline">Cancelada</Badge>
                      ) : p.asistencia === "presente" ? (
                        <Badge className="bg-exito-suave text-exito">Presente</Badge>
                      ) : p.asistencia === "ausente" ? (
                        <Badge className="bg-peligro-suave text-destructive">Ausente</Badge>
                      ) : p.actividad.estado === "programada" ? (
                        <Badge variant="secondary">Anotado</Badge>
                      ) : null}
                      {p.bonificado && <span className="text-[0.7rem] text-muted-foreground">Bonificado</span>}
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <Vacio texto="Todavía no participó de ninguna actividad." />
          )}
        </CardContent>
      </Card>

      {(esProfesor || clases.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-xl font-semibold">Clases dictadas</CardTitle>
          </CardHeader>
          <CardContent>
            {clases.length ? (
              <ul className="divide-y divide-border">
                {clases.map((c) => (
                  <li key={c.id} className={cn("flex items-center gap-3 py-3", c.estado === "cancelada" && "opacity-50")}>
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-dorado/15 text-dorado-oscuro">
                      <GraduationCapIcon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{c.nombre}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatearFecha(c.inicio)} {formatearHora(c.inicio)} h
                      </p>
                    </div>
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {c.estado === "finalizada"
                        ? `${c.presentes ?? 0}/${c.participantes ?? 0} presentes`
                        : `${c.participantes ?? 0} alumnos`}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Vacio texto="No dictó clases todavía." />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Resumen({ etiqueta, valor }: { etiqueta: string; valor: number | string }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{etiqueta}</p>
      <p className="font-heading text-2xl font-semibold tabular-nums">{valor}</p>
    </div>
  )
}

function Vacio({ texto }: { texto: string }) {
  return (
    <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
      <CalendarDaysIcon className="size-4" /> {texto}
    </p>
  )
}
