"use client"

import { EllipsisVerticalIcon, Loader2Icon, PencilIcon, PlusIcon, SwordsIcon, Trash2Icon, TrophyIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { eliminarPartido, guardarPartido } from "@/app/(app)/actividades/actions"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { COLOR_CAMISETA, type ColorCamiseta } from "@/lib/actividades/colores"
import {
  sumaHandicap,
  type ActividadDetalle,
  type EquipoDetalle,
  type ParticipanteDetalle,
  type PartidoDetalle,
} from "@/lib/actividades/detalle"
import { esquemaPartido, fechaHoraAR, type DatosPartido } from "@/lib/actividades/esquema"
import { formatearHandicap, formatearHora } from "@/lib/formato"
import { cn } from "@/lib/utils"
import { Camiseta } from "../camiseta"

type Borrador = {
  equipo_a_id: string
  equipo_b_id: string
  hora: string
  cancha: string
  goles_a: string
  goles_b: string
}

export function TabPartidos({
  actividad,
  equipos,
  participantes,
  partidos,
}: {
  actividad: ActividadDetalle
  equipos: EquipoDetalle[]
  participantes: ParticipanteDetalle[]
  partidos: PartidoDetalle[]
}) {
  const [editando, setEditando] = useState<{ id: string | null; borrador: Borrador } | null>(null)
  const editable = actividad.estado !== "cancelada"
  const nombreEquipo = new Map(equipos.map((e) => [e.id, e.nombre]))
  const colorEquipo = new Map(equipos.map((e) => [e.id, e.color]))
  const hcpEquipo = new Map(
    equipos.map((e) => [e.id, sumaHandicap(participantes.filter((p) => p.equipo_id === e.id).map((p) => p.jugador))]),
  )

  const nuevo = () =>
    setEditando({
      id: null,
      borrador: { equipo_a_id: "", equipo_b_id: "", hora: "", cancha: "", goles_a: "", goles_b: "" },
    })

  const editar = (p: PartidoDetalle) =>
    setEditando({
      id: p.id,
      borrador: {
        equipo_a_id: p.equipo_a_id ?? "",
        equipo_b_id: p.equipo_b_id ?? "",
        hora: p.inicio ? fechaHoraAR(p.inicio).hora : "",
        cancha: p.cancha ?? "",
        goles_a: p.goles_a?.toString() ?? "",
        goles_b: p.goles_b?.toString() ?? "",
      },
    })

  const jugados = partidos.filter((p) => p.estado === "jugado")

  return (
    <div className="space-y-4">
      {editable && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="lg" onClick={nuevo} disabled={equipos.length < 2}>
            <PlusIcon /> Nuevo partido
          </Button>
          {equipos.length < 2 && (
            <p className="text-sm text-muted-foreground">Primero armá al menos dos equipos en la pestaña Equipos.</p>
          )}
        </div>
      )}

      {partidos.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card px-6 py-14 text-center text-sm text-muted-foreground">
          <SwordsIcon className="mx-auto mb-2 size-6 opacity-50" />
          Todavía no hay partidos. Armá los cruces (equipo contra equipo) y después cargá los resultados.
        </div>
      ) : (
        <>
          {jugados.length > 0 && <ResumenEquipos partidos={jugados} nombreEquipo={nombreEquipo} />}
          <ol className="grid gap-3 md:grid-cols-2">
            {partidos.map((p, i) => (
              <TarjetaPartido
                key={p.id}
                numero={i + 1}
                p={p}
                nombreEquipo={nombreEquipo}
                colorEquipo={colorEquipo}
                hcpEquipo={hcpEquipo}
                editable={editable}
                onEditar={() => editar(p)}
              />
            ))}
          </ol>
        </>
      )}

      <Dialog open={editando !== null} onOpenChange={(v) => !v && setEditando(null)}>
        <DialogContent className="sm:max-w-lg">
          {editando && (
            <ModalPartido
              key={editando.id ?? "nuevo"}
              actividadId={actividad.id}
              partidoId={editando.id}
              inicial={editando.borrador}
              equipos={equipos}
              hcpEquipo={hcpEquipo}
              conPartido={
                new Set(
                  partidos
                    .filter((p) => p.id !== editando.id)
                    .flatMap((p) => [p.equipo_a_id, p.equipo_b_id])
                    .filter((id): id is string => !!id),
                )
              }
              onCerrar={() => setEditando(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Ganados / empatados / perdidos de cada equipo en la práctica.
function ResumenEquipos({ partidos, nombreEquipo }: { partidos: PartidoDetalle[]; nombreEquipo: Map<string, string> }) {
  const tabla = new Map<string, { pg: number; pe: number; pp: number; gf: number; gc: number }>()
  const sumar = (id: string | null, gf: number, gc: number) => {
    if (!id) return
    const t = tabla.get(id) ?? { pg: 0, pe: 0, pp: 0, gf: 0, gc: 0 }
    t.gf += gf
    t.gc += gc
    if (gf > gc) t.pg++
    else if (gf < gc) t.pp++
    else t.pe++
    tabla.set(id, t)
  }
  for (const p of partidos) {
    sumar(p.equipo_a_id, p.goles_a ?? 0, p.goles_b ?? 0)
    sumar(p.equipo_b_id, p.goles_b ?? 0, p.goles_a ?? 0)
  }
  const filas = [...tabla.entries()].sort(([, a], [, b]) => b.pg - a.pg || b.gf - b.gc - (a.gf - a.gc) || b.gf - a.gf)

  return (
    <div className="flex flex-wrap gap-2">
      {filas.map(([id, t], i) => (
        <div key={id} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-sm">
          {i === 0 && t.pg > 0 && <TrophyIcon className="size-4 text-dorado-oscuro" aria-label="Más ganados" />}
          <span className="font-medium">{nombreEquipo.get(id) ?? "Equipo"}</span>
          <span className="text-muted-foreground tabular-nums">
            {t.pg}G {t.pe}E {t.pp}P · {t.gf}-{t.gc}
          </span>
        </div>
      ))}
    </div>
  )
}

function TarjetaPartido({
  numero,
  p,
  nombreEquipo,
  colorEquipo,
  hcpEquipo,
  editable,
  onEditar,
}: {
  numero: number
  p: PartidoDetalle
  nombreEquipo: Map<string, string>
  colorEquipo: Map<string, ColorCamiseta | null>
  hcpEquipo: Map<string, number>
  editable: boolean
  onEditar: () => void
}) {
  const router = useRouter()
  const [pendiente, startTransition] = useTransition()
  const [confirmar, setConfirmar] = useState(false)
  const jugado = p.estado === "jugado"
  const ganaA = jugado && (p.goles_a ?? 0) > (p.goles_b ?? 0)
  const ganaB = jugado && (p.goles_b ?? 0) > (p.goles_a ?? 0)

  const eliminar = () =>
    startTransition(async () => {
      const r = await eliminarPartido(p.id)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success("Partido eliminado.")
      setConfirmar(false)
      router.refresh()
    })

  // La camiseta es la del equipo (la del partido queda como respaldo si el equipo no tiene).
  const lado = (equipoId: string | null, colorPartido: ColorCamiseta | null, goles: number | null, gana: boolean) => {
    const color = (equipoId && colorEquipo.get(equipoId)) || colorPartido
    return (
    <div className="flex items-center gap-3">
      <Camiseta color={color} className="size-7" />
      <div className="min-w-0 flex-1">
        <p className={cn("truncate", gana ? "font-semibold" : "font-medium", !equipoId && "text-muted-foreground italic")}>
          {equipoId ? (nombreEquipo.get(equipoId) ?? "Equipo") : "A definir"}
        </p>
        <p className="text-xs text-muted-foreground">
          {color ? `Camiseta ${COLOR_CAMISETA[color].etiqueta.toLowerCase()}` : "Sin camiseta"}
          {equipoId && ` · hcp ${formatearHandicap(hcpEquipo.get(equipoId) ?? 0)}`}
        </p>
      </div>
      <span
        className={cn(
          "w-9 text-right font-heading text-3xl leading-none font-semibold tabular-nums",
          !jugado && "text-muted-foreground/40",
          gana && "text-marino",
        )}
      >
        {jugado ? goles : "–"}
      </span>
    </div>
    )
  }

  return (
    <li className="rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b px-3 py-1.5 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Partido {numero}</span>
        {p.inicio && <span className="tabular-nums">· {formatearHora(p.inicio)} h</span>}
        {p.cancha && <span>· {p.cancha}</span>}
        <span
          className={cn(
            "ml-auto rounded-full px-2 py-0.5",
            jugado ? "bg-exito-suave text-exito" : "bg-alerta-suave text-alerta",
          )}
        >
          {jugado ? "Jugado" : "Por jugar"}
        </span>
        {editable && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Opciones del partido ${numero}`} disabled={pendiente}>
                <EllipsisVerticalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onEditar}>
                <PencilIcon /> {jugado ? "Editar" : "Editar o cargar resultado"}
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmar(true)}>
                <Trash2Icon /> Eliminar partido
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <div className="space-y-2 px-3 py-3">
        {lado(p.equipo_a_id, p.color_a, p.goles_a, ganaA)}
        {lado(p.equipo_b_id, p.color_b, p.goles_b, ganaB)}
      </div>
      {editable && !jugado && (
        <div className="border-t px-3 py-2">
          <Button variant="ghost" size="sm" onClick={onEditar} className="text-dorado-oscuro">
            Cargar resultado
          </Button>
        </div>
      )}

      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar el partido {numero}?</AlertDialogTitle>
            <AlertDialogDescription>Se borra el cruce{jugado ? " y su resultado" : ""}. Los equipos no cambian.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                eliminar()
              }}
              disabled={pendiente}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  )
}

function ModalPartido({
  actividadId,
  partidoId,
  inicial,
  equipos,
  hcpEquipo,
  conPartido,
  onCerrar,
}: {
  actividadId: string
  partidoId: string | null
  inicial: Borrador
  equipos: EquipoDetalle[]
  hcpEquipo: Map<string, number>
  // Equipos que ya tienen otro partido en esta actividad: no se ofrecen salvo que se pida.
  conPartido: Set<string>
  onCerrar: () => void
}) {
  const router = useRouter()
  const [pendiente, startTransition] = useTransition()
  const [b, setB] = useState<Borrador>(inicial)
  const cambiar = (c: Partial<Borrador>) => setB((x) => ({ ...x, ...c }))
  const porId = new Map(equipos.map((e) => [e.id, e]))
  const [mostrarTodos, setMostrarTodos] = useState(false)
  const libres = equipos.filter((e) => !conPartido.has(e.id))
  // Siempre se ofrecen los ya elegidos en este partido (al editar).
  const ofrecidos = mostrarTodos
    ? equipos
    : equipos.filter((e) => !conPartido.has(e.id) || e.id === b.equipo_a_id || e.id === b.equipo_b_id)

  const guardar = () => {
    const aNumero = (v: string) => (v.trim() === "" ? null : Number(v))
    if (!b.equipo_a_id || !b.equipo_b_id) {
      toast.error("Seleccioná los dos equipos.")
      return
    }
    const parsed = esquemaPartido.safeParse({
      equipo_a_id: b.equipo_a_id,
      equipo_b_id: b.equipo_b_id,
      // La camiseta de cada lado es la del equipo.
      color_a: porId.get(b.equipo_a_id)?.color ?? null,
      color_b: porId.get(b.equipo_b_id)?.color ?? null,
      hora: b.hora,
      cancha: b.cancha,
      goles_a: aNumero(b.goles_a),
      goles_b: aNumero(b.goles_b),
    })
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Revisá los datos del partido.")
      return
    }
    startTransition(async () => {
      const r = await guardarPartido(actividadId, partidoId, parsed.data satisfies DatosPartido)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(partidoId ? "Partido actualizado." : "Partido creado.")
      onCerrar()
      router.refresh()
    })
  }

  // Selector de equipo: no ofrece el que ya está elegido del otro lado.
  const selectorEquipo = (lado: "a" | "b") => {
    const valor = lado === "a" ? b.equipo_a_id : b.equipo_b_id
    const otro = lado === "a" ? b.equipo_b_id : b.equipo_a_id
    const goles = lado === "a" ? b.goles_a : b.goles_b
    return (
      <div className="flex items-center gap-2">
        <Select
          value={valor || undefined}
          onValueChange={(v) => cambiar(lado === "a" ? { equipo_a_id: v } : { equipo_b_id: v })}
        >
          <SelectTrigger className="h-11 min-w-0 flex-1" aria-label={lado === "a" ? "Primer equipo" : "Segundo equipo"}>
            <SelectValue placeholder="Seleccionar equipo" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {ofrecidos
              .filter((e) => e.id !== otro)
              .map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  <Camiseta color={e.color} className="size-4" />
                  {e.nombre}
                  <span className="text-muted-foreground">hcp {formatearHandicap(hcpEquipo.get(e.id) ?? 0)}</span>
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          max={99}
          placeholder="–"
          value={goles}
          onChange={(e) => cambiar(lado === "a" ? { goles_a: e.target.value } : { goles_b: e.target.value })}
          className="h-11 w-16 text-center font-heading text-xl font-semibold tabular-nums"
          aria-label={lado === "a" ? "Goles del primer equipo" : "Goles del segundo equipo"}
        />
      </div>
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-heading text-2xl">{partidoId ? "Editar partido" : "Nuevo partido"}</DialogTitle>
        <DialogDescription>
          Elegí los dos equipos. Los goles son opcionales: cargalos cuando termine el partido.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3">
        <div className="space-y-2">
          <div className="flex justify-end pr-1 text-xs text-muted-foreground">
            <span className="w-16 text-center">Goles</span>
          </div>
          {selectorEquipo("a")}
          <p className="text-center font-heading text-lg text-muted-foreground">vs</p>
          {selectorEquipo("b")}
        </div>

        {conPartido.size > 0 && (
          <p className="text-xs text-muted-foreground">
            {mostrarTodos
              ? "Se muestran todos los equipos."
              : libres.length < 2
                ? "Todos los equipos (o casi todos) ya tienen partido."
                : `Se muestran los ${libres.length} equipos que todavía no tienen partido.`}{" "}
            <button
              type="button"
              className="font-medium text-dorado-oscuro hover:underline"
              onClick={() => setMostrarTodos((v) => !v)}
            >
              {mostrarTodos ? "Mostrar solo los libres" : "Mostrar también los que ya tienen partido"}
            </button>
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 border-t pt-3">
          <Field>
            <FieldLabel htmlFor="pt-hora">Hora</FieldLabel>
            <Input id="pt-hora" type="time" step={300} value={b.hora} onChange={(e) => cambiar({ hora: e.target.value })} />
          </Field>
          <Field>
            <FieldLabel htmlFor="pt-cancha">Cancha</FieldLabel>
            <Input
              id="pt-cancha"
              value={b.cancha}
              placeholder="Opcional"
              maxLength={60}
              onChange={(e) => cambiar({ cancha: e.target.value })}
            />
          </Field>
        </div>
      </div>

      <DialogFooter className="gap-2 sm:justify-between">
        {b.goles_a !== "" || b.goles_b !== "" ? (
          <Button variant="link" className="px-0 text-muted-foreground" onClick={() => cambiar({ goles_a: "", goles_b: "" })}>
            Borrar resultado
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="outline" size="lg" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button size="lg" onClick={guardar} disabled={pendiente} className="min-w-32">
            {pendiente && <Loader2Icon className="animate-spin" />}
            {partidoId ? "Guardar" : "Crear partido"}
          </Button>
        </div>
      </DialogFooter>
    </>
  )
}
