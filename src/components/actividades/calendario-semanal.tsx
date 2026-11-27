"use client"

import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import type { FilaActividad } from "@/lib/actividades/filas"
import { diasDeSemana, etiquetaDia, etiquetaSemana, hoyAR, inicioDeSemana, sumarDias } from "@/lib/actividades/semana"
import { formatearHora } from "@/lib/formato"
import { cn } from "@/lib/utils"
import { ICONO_TIPO_ACTIVIDAD } from "./insignias"

const ESTILO_TARJETA = {
  practica: "border-l-marino",
  clase: "border-l-dorado",
  torneo: "border-l-muted-foreground",
} as const

// Vista semanal (lunes a domingo). En desktop, 7 columnas; en el celular, agenda por día.
export function CalendarioSemanal({
  actividades,
  semana,
  onCambiarSemana,
}: {
  actividades: FilaActividad[]
  semana: string // lunes, YYYY-MM-DD
  onCambiarSemana: (lunes: string) => void
}) {
  const hoy = hoyAR()
  const dias = diasDeSemana(semana)
  const esSemanaActual = semana === inicioDeSemana(hoy)

  const porDia = new Map<string, FilaActividad[]>(dias.map((d) => [d, []]))
  for (const a of actividades) porDia.get(a.fecha)?.push(a)
  for (const lista of porDia.values()) lista.sort((a, b) => a.inicio.localeCompare(b.inicio))
  const cantidad = [...porDia.values()].reduce((t, l) => t + l.length, 0)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-2 pl-4">
        <div>
          <p className="font-heading text-xl leading-tight font-semibold">Semana del {etiquetaSemana(semana)}</p>
          <p className="text-xs text-muted-foreground">
            {cantidad === 0 ? "Sin actividades" : `${cantidad} ${cantidad === 1 ? "actividad" : "actividades"}`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-lg"
            onClick={() => onCambiarSemana(sumarDias(semana, -7))}
            aria-label="Semana anterior"
          >
            <ChevronLeftIcon />
          </Button>
          <Button variant="outline" size="lg" disabled={esSemanaActual} onClick={() => onCambiarSemana(inicioDeSemana(hoy))}>
            Hoy
          </Button>
          <Button
            variant="outline"
            size="icon-lg"
            onClick={() => onCambiarSemana(sumarDias(semana, 7))}
            aria-label="Semana siguiente"
          >
            <ChevronRightIcon />
          </Button>
        </div>
      </div>

      {/* Desktop: 7 columnas */}
      <div className="hidden grid-cols-7 gap-2 lg:grid">
        {dias.map((dia) => {
          const { corto, numero, largo } = etiquetaDia(dia)
          const esHoy = dia === hoy
          return (
            <section
              key={dia}
              aria-label={largo}
              className={cn("flex min-h-64 flex-col rounded-xl border bg-card", esHoy && "border-dorado ring-1 ring-dorado/40")}
            >
              <header className="group flex items-center justify-between border-b px-3 py-2">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs tracking-wide text-muted-foreground uppercase">{corto}</span>
                  <span
                    className={cn(
                      "font-heading text-xl font-semibold tabular-nums",
                      esHoy && "flex size-8 items-center justify-center rounded-full bg-marino text-crema",
                    )}
                  >
                    {numero}
                  </span>
                </div>
                <NuevaEnDia fecha={dia} etiqueta={largo} className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100" />
              </header>
              <ul className="flex-1 space-y-1.5 p-1.5">
                {porDia.get(dia)!.map((a) => (
                  <li key={a.id}>
                    <TarjetaCalendario a={a} />
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>

      {/* Celular y tablet: agenda */}
      <ol className="space-y-2 lg:hidden">
        {dias.map((dia) => {
          const { largo } = etiquetaDia(dia)
          const lista = porDia.get(dia)!
          const esHoy = dia === hoy
          return (
            <li key={dia} className={cn("rounded-xl border bg-card", esHoy && "border-dorado")}>
              <div className="flex items-center justify-between px-3 py-2">
                <p className={cn("text-sm font-medium", lista.length === 0 && "text-muted-foreground")}>
                  {largo}
                  {esHoy && <span className="ml-2 rounded-full bg-marino px-2 py-0.5 text-[0.65rem] text-crema">Hoy</span>}
                </p>
                <NuevaEnDia fecha={dia} etiqueta={largo} />
              </div>
              {lista.length > 0 && (
                <ul className="space-y-1.5 px-2 pb-2">
                  {lista.map((a) => (
                    <li key={a.id}>
                      <TarjetaCalendario a={a} />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function NuevaEnDia({ fecha, etiqueta, className }: { fecha: string; etiqueta: string; className?: string }) {
  return (
    <Button variant="ghost" size="icon-sm" asChild className={cn("text-muted-foreground", className)}>
      <Link href={`/actividades/nueva?fecha=${fecha}`} aria-label={`Nueva actividad el ${etiqueta}`} title="Nueva actividad">
        <PlusIcon />
      </Link>
    </Button>
  )
}

function TarjetaCalendario({ a }: { a: FilaActividad }) {
  const Icono = ICONO_TIPO_ACTIVIDAD[a.tipo]
  const cancelada = a.estado === "cancelada"
  return (
    <Link
      href={`/actividades/${a.id}`}
      className={cn(
        "block rounded-lg border border-l-4 bg-background px-2.5 py-2 transition-colors hover:bg-muted/60",
        ESTILO_TARJETA[a.tipo],
        cancelada && "opacity-55",
      )}
    >
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
        <Icono className="size-3.5" /> {formatearHora(a.inicio)} h
        {a.estado === "finalizada" && <span className="ml-auto text-exito">Finalizada</span>}
        {cancelada && <span className="ml-auto">Cancelada</span>}
      </p>
      <p className={cn("mt-0.5 text-sm leading-snug font-medium", cancelada && "line-through")}>{a.nombre}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {a.estado === "finalizada" ? `${a.presentes}/${a.participantes} presentes` : `${a.participantes} anotados`}
        {a.profesor_nombre && ` · ${a.profesor_nombre}`}
      </p>
    </Link>
  )
}
