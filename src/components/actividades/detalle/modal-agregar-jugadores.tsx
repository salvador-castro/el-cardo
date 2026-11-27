"use client"

import { AlertTriangleIcon, Loader2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"

import { agregarParticipantes } from "@/app/(app)/actividades/actions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { JugadorOpcion } from "@/lib/actividades/constantes"
import { aptoConAviso, type EquipoDetalle, type ParticipanteDetalle } from "@/lib/actividades/detalle"
import { nombreCompleto } from "@/lib/formato"
import { CampoPrecio, leerPrecio } from "./campo-precio"
import { SelectorJugadores } from "./selector-jugadores"

const SIN_EQUIPO = "__sin_equipo__"

export function ModalAgregarJugadores({
  abierto,
  onAbiertoChange,
  actividadId,
  esClase,
  jugadores,
  participantes,
  equipos,
  profesorId,
  precioActividad,
}: {
  abierto: boolean
  onAbiertoChange: (v: boolean) => void
  actividadId: string
  esClase: boolean
  jugadores: JugadorOpcion[]
  participantes: ParticipanteDetalle[]
  equipos: EquipoDetalle[]
  profesorId: string | null
  precioActividad: number
}) {
  return (
    <Dialog open={abierto} onOpenChange={onAbiertoChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        {abierto && (
          <Contenido
            actividadId={actividadId}
            esClase={esClase}
            jugadores={jugadores}
            participantes={participantes}
            equipos={equipos}
            profesorId={profesorId}
            precioActividad={precioActividad}
            onCerrar={() => onAbiertoChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function Contenido({
  actividadId,
  esClase,
  jugadores,
  participantes,
  equipos,
  profesorId,
  precioActividad,
  onCerrar,
}: {
  actividadId: string
  esClase: boolean
  jugadores: JugadorOpcion[]
  participantes: ParticipanteDetalle[]
  equipos: EquipoDetalle[]
  profesorId: string | null
  precioActividad: number
  onCerrar: () => void
}) {
  const router = useRouter()
  const [pendiente, startTransition] = useTransition()
  const [seleccion, setSeleccion] = useState<string[]>([])
  const [extras, setExtras] = useState<JugadorOpcion[]>([])
  const [equipoId, setEquipoId] = useState(SIN_EQUIPO)
  const [precio, setPrecio] = useState("")

  const pool = useMemo(() => [...jugadores, ...extras], [jugadores, extras])
  const porId = useMemo(() => new Map(pool.map((j) => [j.id, j])), [pool])
  const elegidos = seleccion.map((id) => porId.get(id)).filter((j): j is JugadorOpcion => !!j)
  const sinApto = elegidos.filter(aptoConAviso)

  const { notas, bloqueados } = useMemo(() => {
    const notas = new Map<string, string>()
    const bloqueados = new Set<string>()
    for (const p of participantes) {
      notas.set(p.jugador.id, "Ya anotado")
      bloqueados.add(p.jugador.id)
    }
    if (profesorId) {
      notas.set(profesorId, "Profesor de la clase")
      bloqueados.add(profesorId)
    }
    return { notas, bloqueados }
  }, [participantes, profesorId])

  const toggle = (j: JugadorOpcion) =>
    setSeleccion((s) => (s.includes(j.id) ? s.filter((x) => x !== j.id) : [...s, j.id]))

  const agregar = () => {
    const valorPrecio = leerPrecio(precio, precioActividad)
    if (valorPrecio === "invalido") {
      toast.error("Ingresá un precio válido.")
      return
    }
    startTransition(async () => {
      const r = await agregarParticipantes(actividadId, seleccion, equipoId === SIN_EQUIPO ? null : equipoId, valorPrecio)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(r.datos.agregados === 1 ? "Se anotó 1 jugador." : `Se anotaron ${r.datos.agregados} jugadores.`)
      onCerrar()
      router.refresh()
    })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-heading text-2xl">{esClase ? "Agregar alumnos" : "Agregar jugadores"}</DialogTitle>
        <DialogDescription>
          Elegí uno o varios. A cada uno se le genera el cobro de la actividad.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        {!esClase && equipos.length > 0 && (
          <Field>
            <FieldLabel htmlFor="ag-equipo">Equipo</FieldLabel>
            <Select value={equipoId} onValueChange={setEquipoId}>
              <SelectTrigger id="ag-equipo" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SIN_EQUIPO}>Sin equipo (después lo asignás)</SelectItem>
                {equipos.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        <SelectorJugadores
          jugadores={pool}
          seleccionados={seleccion}
          onToggle={toggle}
          notas={notas}
          bloqueados={bloqueados}
          onCreado={(j) => {
            setExtras((x) => [...x, j])
            setSeleccion((s) => [...s, j.id])
          }}
          autoFocus
        />

        <CampoPrecio id="ag-precio" valor={precio} onChange={setPrecio} precioActividad={precioActividad} />

        {sinApto.length > 0 && (
          <Alert className="border-destructive/30 bg-peligro-suave text-destructive">
            <AlertTriangleIcon />
            <AlertDescription className="text-destructive">
              Apto vencido o sin presentar: {sinApto.map(nombreCompleto).join(", ")}. Se pueden anotar igual.
            </AlertDescription>
          </Alert>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" size="lg" onClick={onCerrar}>
          Cancelar
        </Button>
        <Button size="lg" onClick={agregar} disabled={pendiente || seleccion.length === 0} className="min-w-36">
          {pendiente && <Loader2Icon className="animate-spin" />}
          {seleccion.length ? `Agregar ${seleccion.length}` : "Agregar"}
        </Button>
      </DialogFooter>
    </>
  )
}
