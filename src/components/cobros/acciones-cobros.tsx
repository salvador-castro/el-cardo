"use client"

import { CalendarPlusIcon, Loader2Icon, PlusIcon, XIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"

import { crearCobroManual, generarCuotas, previaCuotas } from "@/app/(app)/cobros/actions"
import { SelectorJugadores } from "@/components/actividades/detalle/selector-jugadores"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { JugadorOpcion } from "@/lib/actividades/constantes"
import { formatearMonto, nombreCompleto } from "@/lib/formato"
import { hoyISO } from "@/lib/jugadores/esquema"
import { ETIQUETA_CONCEPTO } from "./insignias-cobro"

const CONCEPTOS = ["otro", "practica", "clase", "torneo"] as const

// Cobro manual: concepto libre, monto y vencimiento, a uno o varios jugadores.
export function NuevoCobro({ jugadores }: { jugadores: JugadorOpcion[] }) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [pendiente, startTransition] = useTransition()
  const [seleccion, setSeleccion] = useState<string[]>([])
  const [concepto, setConcepto] = useState<(typeof CONCEPTOS)[number]>("otro")
  const [descripcion, setDescripcion] = useState("")
  const [monto, setMonto] = useState("")
  const [vencimiento, setVencimiento] = useState(hoyISO())
  const porId = new Map(jugadores.map((j) => [j.id, j]))

  const abrir = (v: boolean) => {
    if (v) {
      setSeleccion([])
      setConcepto("otro")
      setDescripcion("")
      setMonto("")
      setVencimiento(hoyISO())
    }
    setAbierto(v)
  }

  const crear = () =>
    startTransition(async () => {
      const r = await crearCobroManual({ jugadores: seleccion, concepto, descripcion, monto: Number(monto), vencimiento })
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(r.datos.creados === 1 ? "Se creó el cobro." : `Se crearon ${r.datos.creados} cobros.`)
      setAbierto(false)
      router.refresh()
    })

  return (
    <Dialog open={abierto} onOpenChange={abrir}>
      <DialogTrigger asChild>
        <Button size="lg">
          <PlusIcon /> Nuevo cobro
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">Nuevo cobro</DialogTitle>
          <DialogDescription>Por ejemplo, pensión de caballos o alquiler de equipo. Se crea uno por jugador.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
            <Field>
              <FieldLabel htmlFor="nc-desc">Concepto</FieldLabel>
              <Input id="nc-desc" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Pensión de caballo — 1 semana" maxLength={120} />
            </Field>
            <Field>
              <FieldLabel htmlFor="nc-tipo">Tipo</FieldLabel>
              <Select value={concepto} onValueChange={(v) => setConcepto(v as typeof concepto)}>
                <SelectTrigger id="nc-tipo" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONCEPTOS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {ETIQUETA_CONCEPTO[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="nc-monto">Monto por jugador</FieldLabel>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <Input id="nc-monto" type="number" inputMode="numeric" min={0} step={500} value={monto} onChange={(e) => setMonto(e.target.value)} className="pl-7 tabular-nums" />
              </div>
            </Field>
            <Field>
              <FieldLabel htmlFor="nc-venc">Vence</FieldLabel>
              <Input id="nc-venc" type="date" value={vencimiento} onChange={(e) => setVencimiento(e.target.value)} />
            </Field>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">
              Jugadores <span className="text-muted-foreground">({seleccion.length})</span>
            </p>
            {seleccion.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {seleccion.map((id) => (
                  <li key={id} className="flex items-center gap-1 rounded-full border bg-card py-0.5 pr-0.5 pl-3 text-sm">
                    {porId.get(id) ? nombreCompleto(porId.get(id)!) : "Jugador"}
                    <button
                      type="button"
                      onClick={() => setSeleccion((s) => s.filter((x) => x !== id))}
                      className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                      aria-label="Sacar"
                    >
                      <XIcon className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <SelectorJugadores
              jugadores={jugadores}
              seleccionados={seleccion}
              onToggle={(j) => setSeleccion((s) => (s.includes(j.id) ? s.filter((x) => x !== j.id) : [...s, j.id]))}
              soloBusqueda
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="lg" onClick={() => setAbierto(false)}>
            Cancelar
          </Button>
          <Button size="lg" onClick={crear} disabled={pendiente || !seleccion.length || !descripcion.trim() || !(Number(monto) > 0)}>
            {pendiente && <Loader2Icon className="animate-spin" />}
            {seleccion.length > 1 ? `Crear ${seleccion.length} cobros` : "Crear cobro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const mesActual = () => hoyISO().slice(0, 7)

function nombreMes(periodo: string) {
  const [a, m] = periodo.split("-").map(Number)
  const t = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(a, m - 1, 15)))
  return t.charAt(0).toUpperCase() + t.slice(1)
}

// Genera la cuota social del mes para los socios activos. Si se corre dos veces, no duplica.
export function GenerarCuotas() {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [periodo, setPeriodo] = useState(mesActual())
  const [previa, setPrevia] = useState<{ monto: number | null; socios: number; yaGeneradas: number } | null>(null)
  const [pendiente, startTransition] = useTransition()

  useEffect(() => {
    if (!abierto || !/^\d{4}-\d{2}$/.test(periodo)) return
    let vigente = true
    void previaCuotas(periodo).then((r) => vigente && setPrevia(r.ok ? r.datos : null))
    return () => {
      vigente = false
    }
  }, [abierto, periodo])

  const generar = () =>
    startTransition(async () => {
      const r = await generarCuotas(periodo)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(r.datos.creadas ? `Se generaron ${r.datos.creadas} cuotas de ${nombreMes(periodo)}.` : "Ya estaban todas generadas.")
      setAbierto(false)
      router.refresh()
    })

  const faltan = previa ? Math.max(0, previa.socios - previa.yaGeneradas) : null

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg" className="bg-card">
          <CalendarPlusIcon /> Generar cuotas
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">Generar cuotas sociales</DialogTitle>
          <DialogDescription>Se crea la cuota del mes para cada socio activo que todavía no la tenga.</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="gc-mes">Mes</FieldLabel>
          <Input id="gc-mes" type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
          {previa && (
            <FieldDescription>
              {previa.monto === null
                ? "No hay un monto de cuota vigente para ese mes."
                : `Cuota de ${nombreMes(periodo)}: ${formatearMonto(previa.monto)}. ${previa.socios} socios activos, ${previa.yaGeneradas} ya la tienen.`}
            </FieldDescription>
          )}
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAbierto(false)}>
            Cancelar
          </Button>
          <Button onClick={generar} disabled={pendiente || !previa || previa.monto === null || faltan === 0}>
            {pendiente && <Loader2Icon className="animate-spin" />}
            {faltan ? `Generar ${faltan} cuotas` : "Generar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
