"use client"

import { CheckCheckIcon, CheckIcon, FlagIcon, Loader2Icon, XIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { cambiarEstadoActividad, marcarAsistencia } from "@/app/(app)/actividades/actions"
import { Button } from "@/components/ui/button"
import type { Asistencia } from "@/lib/actividades/constantes"
import { ordenarPorApellido, type ActividadDetalle, type EquipoDetalle, type ParticipanteDetalle } from "@/lib/actividades/detalle"
import { cn } from "@/lib/utils"

// La asistencia se puede marcar en cualquier momento. Cada toque se guarda al instante.
export function TabAsistencia({
  actividad,
  equipos,
  participantes,
}: {
  actividad: ActividadDetalle
  equipos: EquipoDetalle[]
  participantes: ParticipanteDetalle[]
}) {
  const router = useRouter()
  const [marcas, setMarcas] = useState<Record<string, Asistencia | null>>(() =>
    Object.fromEntries(participantes.map((p) => [p.id, p.asistencia])),
  )
  const [base, setBase] = useState(participantes)
  const [guardando, setGuardando] = useState(0)
  const [finalizando, startFinalizar] = useTransition()

  // Si llegan datos nuevos del servidor (y no hay marcas guardándose), se toman esas marcas.
  if (base !== participantes && guardando === 0) {
    setBase(participantes)
    setMarcas(Object.fromEntries(participantes.map((p) => [p.id, p.asistencia])))
  }

  const editable = actividad.estado !== "cancelada"
  const nombreEquipo = new Map(equipos.map((e) => [e.id, e.nombre]))
  const lista = ordenarPorApellido(participantes)
  const presentes = lista.filter((p) => marcas[p.id] === "presente").length
  const ausentes = lista.filter((p) => marcas[p.id] === "ausente").length
  const sinMarcar = lista.length - presentes - ausentes

  const guardar = async (ids: string[], valor: Asistencia | null) => {
    const anteriores = Object.fromEntries(ids.map((id) => [id, marcas[id] ?? null]))
    setMarcas((m) => ({ ...m, ...Object.fromEntries(ids.map((id) => [id, valor])) }))
    setGuardando((n) => n + 1)
    const r = await marcarAsistencia(actividad.id, ids, valor)
    setGuardando((n) => n - 1)
    if (!r.ok) {
      setMarcas((m) => ({ ...m, ...anteriores }))
      toast.error(r.error)
      return
    }
    router.refresh()
  }

  const marcar = (id: string, valor: Asistencia) => void guardar([id], marcas[id] === valor ? null : valor)

  const finalizar = () =>
    startFinalizar(async () => {
      const r = await cambiarEstadoActividad(actividad.id, "finalizada")
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success("Actividad finalizada.")
      router.refresh()
    })

  if (lista.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card px-6 py-14 text-center text-sm text-muted-foreground">
        No hay jugadores anotados.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3">
        <div className="flex gap-4 px-1 text-sm">
          <Contador valor={presentes} etiqueta="Presentes" clase="text-exito" />
          <Contador valor={ausentes} etiqueta="Ausentes" clase="text-destructive" />
          <Contador valor={sinMarcar} etiqueta="Sin marcar" clase="text-muted-foreground" />
        </div>
        <div className="ml-auto flex items-center gap-2">
          {guardando > 0 && <Loader2Icon className="size-4 animate-spin text-muted-foreground" aria-label="Guardando" />}
          {editable && sinMarcar > 0 && (
            <Button
              variant="outline"
              onClick={() =>
                void guardar(
                  lista.filter((p) => !marcas[p.id]).map((p) => p.id),
                  "presente",
                )
              }
            >
              <CheckCheckIcon /> Marcar el resto presentes
            </Button>
          )}
        </div>
      </div>

      {editable && actividad.estado === "programada" && sinMarcar === 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dorado/50 bg-dorado/10 px-4 py-3">
          <p className="text-sm">Ya está toda la asistencia. ¿Damos la actividad por finalizada?</p>
          <Button onClick={finalizar} disabled={finalizando}>
            {finalizando ? <Loader2Icon className="animate-spin" /> : <FlagIcon />} Finalizar actividad
          </Button>
        </div>
      )}

      <ul className="divide-y rounded-xl border bg-card">
        {lista.map((p) => {
          const valor = marcas[p.id] ?? null
          const equipo = p.equipo_id ? nombreEquipo.get(p.equipo_id) : null
          return (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {p.jugador.apellido}, {p.jugador.nombre}
                </p>
                {equipo && <p className="text-xs text-muted-foreground">{equipo}</p>}
              </div>
              <div className="flex gap-1.5" role="group" aria-label={`Asistencia de ${p.jugador.nombre} ${p.jugador.apellido}`}>
                <Button
                  variant="outline"
                  size="lg"
                  disabled={!editable}
                  onClick={() => marcar(p.id, "presente")}
                  aria-pressed={valor === "presente"}
                  className={cn(
                    "min-w-11 sm:min-w-28",
                    valor === "presente" && "border-exito bg-exito text-white hover:bg-exito/90 hover:text-white",
                  )}
                >
                  <CheckIcon /> <span className="hidden sm:inline">Presente</span>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  disabled={!editable}
                  onClick={() => marcar(p.id, "ausente")}
                  aria-pressed={valor === "ausente"}
                  className={cn(
                    "min-w-11 sm:min-w-28",
                    valor === "ausente" &&
                      "border-destructive bg-destructive text-white hover:bg-destructive/90 hover:text-white",
                  )}
                >
                  <XIcon /> <span className="hidden sm:inline">Ausente</span>
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
      {editable && <p className="text-xs text-muted-foreground">Tocá de nuevo una marca para borrarla.</p>}
    </div>
  )
}

function Contador({ valor, etiqueta, clase }: { valor: number; etiqueta: string; clase: string }) {
  return (
    <p>
      <span className={cn("font-heading text-2xl font-semibold tabular-nums", clase)}>{valor}</span>{" "}
      <span className="text-muted-foreground">{etiqueta}</span>
    </p>
  )
}
