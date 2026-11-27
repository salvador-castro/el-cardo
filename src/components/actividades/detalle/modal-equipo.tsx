"use client"

import { AlertTriangleIcon, CopyIcon, Loader2Icon, XIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"

import { equiposAnteriores, guardarEquipo, type EquipoAnterior } from "@/app/(app)/actividades/actions"
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
import { Input } from "@/components/ui/input"
import type { JugadorOpcion } from "@/lib/actividades/constantes"
import { aptoConAviso, sumaHandicap, type ParticipanteDetalle } from "@/lib/actividades/detalle"
import { formatearFecha, formatearHandicap, nombreCompleto } from "@/lib/formato"
import { cn } from "@/lib/utils"
import { COLOR_CAMISETA, COLORES_CAMISETA, type ColorCamiseta } from "@/lib/actividades/colores"
import { SelectorCamiseta } from "../camiseta"
import { SelectorJugadores } from "./selector-jugadores"

export type EquipoEnEdicion = { id: string | null; nombre: string; jugadores: string[]; color: ColorCamiseta | null }

export function ModalEquipo({
  actividadId,
  equipo,
  onCerrar,
  jugadores,
  participantes,
  profesorId,
}: {
  actividadId: string
  // null: cerrado.
  equipo: EquipoEnEdicion | null
  onCerrar: () => void
  jugadores: JugadorOpcion[]
  participantes: ParticipanteDetalle[]
  profesorId: string | null
}) {
  return (
    <Dialog open={equipo !== null} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        {equipo && (
          <ContenidoEquipo
            // Se reinicia el estado cada vez que se abre con otro equipo.
            key={equipo.id ?? "nuevo"}
            actividadId={actividadId}
            equipo={equipo}
            onCerrar={onCerrar}
            jugadores={jugadores}
            participantes={participantes}
            profesorId={profesorId}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ContenidoEquipo({
  actividadId,
  equipo,
  onCerrar,
  jugadores,
  participantes,
  profesorId,
}: {
  actividadId: string
  equipo: EquipoEnEdicion
  onCerrar: () => void
  jugadores: JugadorOpcion[]
  participantes: ParticipanteDetalle[]
  profesorId: string | null
}) {
  const router = useRouter()
  const [pendiente, startTransition] = useTransition()
  const [nombre, setNombre] = useState(equipo.nombre)
  const [color, setColor] = useState<ColorCamiseta | null>(equipo.color)

  // Si el nombre es vacío o el de un color, al elegir la camiseta se usa ese color como nombre.
  const elegirColor = (c: ColorCamiseta) => {
    setColor(c)
    const actual = nombre.trim().toLowerCase()
    if (!actual || COLORES_CAMISETA.some((x) => COLOR_CAMISETA[x].etiqueta.toLowerCase() === actual)) {
      setNombre(COLOR_CAMISETA[c].etiqueta)
    }
  }
  const [seleccion, setSeleccion] = useState<string[]>(equipo.jugadores)
  const [extras, setExtras] = useState<JugadorOpcion[]>([])
  const [anteriores, setAnteriores] = useState<EquipoAnterior[] | null>(null)
  const [verAnteriores, setVerAnteriores] = useState(false)
  const [cargandoAnteriores, startCarga] = useTransition()

  const pool = useMemo(() => [...jugadores, ...extras], [jugadores, extras])

  // Los que ya están en otro equipo de esta actividad (y el profesor) no se ofrecen.
  const ocupados = useMemo(() => {
    const ids = new Set(participantes.filter((p) => p.equipo_id && p.equipo_id !== equipo.id).map((p) => p.jugador.id))
    if (profesorId) ids.add(profesorId)
    return ids
  }, [participantes, equipo.id, profesorId])
  const disponibles = useMemo(() => pool.filter((j) => !ocupados.has(j.id)), [pool, ocupados])
  const porId = useMemo(() => new Map(pool.map((j) => [j.id, j])), [pool])
  const integrantes = seleccion.map((id) => porId.get(id)).filter((j): j is JugadorOpcion => !!j)
  const total = sumaHandicap(integrantes)
  const sinApto = integrantes.filter(aptoConAviso)

  // Dónde está hoy cada jugador dentro de esta actividad.
  const notas = useMemo(
    () => new Map(participantes.filter((p) => !p.equipo_id).map((p) => [p.jugador.id, "Anotado sin equipo"])),
    [participantes],
  )

  const sinEquipo = useMemo(
    () => new Set(participantes.filter((p) => !p.equipo_id).map((p) => p.jugador.id)),
    [participantes],
  )

  const toggle = (j: JugadorOpcion) =>
    setSeleccion((s) => (s.includes(j.id) ? s.filter((x) => x !== j.id) : [...s, j.id]))

  const abrirAnteriores = () => {
    setVerAnteriores((v) => !v)
    if (anteriores !== null) return
    startCarga(async () => {
      const r = await equiposAnteriores(actividadId)
      if (!r.ok) {
        toast.error(r.error)
        setVerAnteriores(false)
        return
      }
      setAnteriores(r.datos)
    })
  }

  const duplicar = (e: EquipoAnterior) => {
    const activos = e.jugadores.filter((id) => porId.get(id)?.activo && !ocupados.has(id))
    const omitidos = e.jugadores.length - activos.length
    setSeleccion(activos)
    if (!nombre.trim()) setNombre(e.nombre)
    if (!color && e.color) setColor(e.color)
    setVerAnteriores(false)
    toast.success(
      `Se copiaron ${activos.length} jugadores de ${e.nombre}.` +
        (omitidos ? ` ${omitidos} quedaron afuera (inactivos o ya en otro equipo).` : ""),
    )
  }

  const guardar = () => {
    if (!nombre.trim()) {
      toast.error("Ingresá el nombre del equipo.")
      return
    }
    startTransition(async () => {
      const r = await guardarEquipo(actividadId, { equipoId: equipo.id, nombre, jugadores: seleccion, color })
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(equipo.id ? "Equipo actualizado." : `Equipo ${nombre.trim()} creado.`)
      onCerrar()
      router.refresh()
    })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-heading text-2xl">{equipo.id ? "Editar equipo" : "Armar equipo"}</DialogTitle>
        <DialogDescription>
          Buscá a los jugadores por nombre. Los que ya están en otro equipo no aparecen; los nuevos quedan anotados en la actividad.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="flex items-end gap-3">
          <Field className="flex-1">
            <FieldLabel htmlFor="eq-nombre">Nombre del equipo</FieldLabel>
            <Input
              id="eq-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Blanco, Azul…"
              maxLength={60}
              autoComplete="off"
            />
          </Field>
          <div className="rounded-lg border bg-marino px-4 py-1.5 text-center text-crema" aria-live="polite">
            <p className="font-heading text-3xl leading-none font-semibold tabular-nums">{formatearHandicap(total)}</p>
            <p className="mt-0.5 text-[0.6rem] tracking-[0.15em] uppercase opacity-80">Hcp total</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-sm font-medium">
            Camiseta
            <span className="font-normal text-muted-foreground">
              {color ? ` · ${COLOR_CAMISETA[color].etiqueta}` : " · se puede cambiar en cada partido"}
            </span>
          </p>
          <SelectorCamiseta valor={color} onChange={elegirColor} etiqueta="Camiseta del equipo" />
        </div>

        {/* Integrantes */}
        <div>
          <p className="mb-2 text-sm font-medium">
            Integrantes <span className="text-muted-foreground">({integrantes.length})</span>
          </p>
          {integrantes.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {integrantes.map((j) => (
                <li
                  key={j.id}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border bg-card py-1 pr-1 pl-3 text-sm",
                    aptoConAviso(j) && "border-destructive/40",
                  )}
                >
                  {aptoConAviso(j) && <AlertTriangleIcon className="size-3.5 text-destructive" aria-label="Apto no vigente" />}
                  {nombreCompleto(j)}
                  <span className="font-semibold tabular-nums">{formatearHandicap(j.handicap)}</span>
                  <button
                    type="button"
                    onClick={() => toggle(j)}
                    className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label={`Sacar a ${nombreCompleto(j)} del equipo`}
                  >
                    <XIcon className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
              Elegí jugadores de la lista o duplicá un equipo anterior.
            </p>
          )}
        </div>

        {sinApto.length > 0 && (
          <Alert className="border-destructive/30 bg-peligro-suave text-destructive">
            <AlertTriangleIcon />
            <AlertDescription className="text-destructive">
              {sinApto.length === 1 ? "Tiene" : "Tienen"} el apto vencido o no lo presentaron:{" "}
              {sinApto.map(nombreCompleto).join(", ")}. Pueden jugar igual; es solo un aviso.
            </AlertDescription>
          </Alert>
        )}

        {/* Duplicar */}
        <div>
          <Button type="button" variant="outline" size="sm" onClick={abrirAnteriores} aria-expanded={verAnteriores}>
            {cargandoAnteriores ? <Loader2Icon className="animate-spin" /> : <CopyIcon />}
            Duplicar equipo de una actividad anterior
          </Button>
          {verAnteriores && anteriores && (
            <div className="mt-2 max-h-60 overflow-y-auto rounded-xl border">
              {anteriores.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">No hay equipos en otras actividades.</p>
              ) : (
                <ul className="divide-y">
                  {anteriores.map((e) => {
                    const miembros = e.jugadores.map((id) => porId.get(id)).filter((j): j is JugadorOpcion => !!j)
                    return (
                      <li key={e.id}>
                        <button
                          type="button"
                          onClick={() => duplicar(e)}
                          className="w-full px-3 py-2.5 text-left hover:bg-muted/60"
                        >
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="text-sm font-medium">
                              {e.nombre} <span className="font-normal text-muted-foreground">· {e.actividad.nombre}</span>
                            </span>
                            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                              {formatearFecha(e.actividad.inicio)} · hcp {formatearHandicap(sumaHandicap(miembros))}
                            </span>
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                            {miembros.map(nombreCompleto).join(", ")}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}
        </div>

        <SelectorJugadores
          jugadores={disponibles}
          soloBusqueda
          seleccionados={seleccion}
          onToggle={toggle}
          notas={notas}
          destacados={sinEquipo}
          onCreado={(j) => {
            setExtras((x) => [...x, j])
            setSeleccion((s) => [...s, j.id])
          }}
        />
      </div>

      <DialogFooter>
        <Button variant="outline" size="lg" onClick={onCerrar}>
          Cancelar
        </Button>
        <Button size="lg" onClick={guardar} disabled={pendiente} className="min-w-36">
          {pendiente && <Loader2Icon className="animate-spin" />}
          {equipo.id ? "Guardar equipo" : "Crear equipo"}
        </Button>
      </DialogFooter>
    </>
  )
}
