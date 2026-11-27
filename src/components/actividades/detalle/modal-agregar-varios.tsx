"use client"

import { AlertTriangleIcon, ArrowLeftIcon, CheckCircle2Icon, Loader2Icon, SearchIcon, ZapIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"

import { agregarParticipantes, buscarCoincidencias, type Coincidencia } from "@/app/(app)/actividades/actions"
import { AltaRapidaJugador } from "@/components/jugadores/alta-rapida"
import { InsigniaApto } from "@/components/jugadores/insignias"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { JugadorOpcion } from "@/lib/actividades/constantes"
import type { EquipoDetalle, ParticipanteDetalle } from "@/lib/actividades/detalle"
import { nombresDeLista } from "@/lib/actividades/lista-whatsapp"
import { formatearHandicap } from "@/lib/formato"
import { cn } from "@/lib/utils"
import { CampoPrecio, leerPrecio } from "./campo-precio"
import { aJugadorOpcion } from "./selector-jugadores"

const NO_AGREGAR = "__no__"
const SIN_EQUIPO = "__sin_equipo__"
// Por encima de esta similitud se elige el candidato automáticamente.
const UMBRAL_AUTOMATICO = 0.5

type Fila = Coincidencia & { elegido: string; creado: JugadorOpcion | null }

export function ModalAgregarVarios({
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
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
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
  const [texto, setTexto] = useState("")
  const [filas, setFilas] = useState<Fila[] | null>(null)
  const [equipoId, setEquipoId] = useState(SIN_EQUIPO)
  const [precio, setPrecio] = useState("")
  const [buscando, startBusqueda] = useTransition()
  const [guardando, startGuardado] = useTransition()

  const porId = useMemo(() => new Map(jugadores.map((j) => [j.id, j])), [jugadores])
  const anotados = useMemo(() => new Set(participantes.map((p) => p.jugador.id)), [participantes])
  const nombres = nombresDeLista(texto)

  const buscar = () =>
    startBusqueda(async () => {
      const r = await buscarCoincidencias(nombres)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      setFilas(
        r.datos.map((c) => {
          const [mejor] = c.candidatos
          const automatico =
            mejor && (mejor.similitud >= UMBRAL_AUTOMATICO || (c.candidatos.length === 1 && mejor.similitud >= 0.35))
          return { ...c, elegido: automatico ? mejor.id : NO_AGREGAR, creado: null }
        }),
      )
    })

  const elegir = (indice: number, elegido: string) =>
    setFilas((f) => f && f.map((x) => (x.indice === indice ? { ...x, elegido } : x)))

  // Lo que se va a anotar: elegidos, sin repetir, sin los ya anotados ni el profesor.
  const resumen = useMemo(() => {
    const ids = new Set<string>()
    let yaAnotados = 0
    for (const f of filas ?? []) {
      if (f.elegido === NO_AGREGAR) continue
      if (anotados.has(f.elegido) || f.elegido === profesorId) {
        yaAnotados++
        continue
      }
      ids.add(f.elegido)
    }
    return { ids: [...ids], yaAnotados }
  }, [filas, anotados, profesorId])

  const sinResolver = (filas ?? []).filter((f) => f.elegido === NO_AGREGAR).length

  const confirmar = () => {
    const valorPrecio = leerPrecio(precio, precioActividad)
    if (valorPrecio === "invalido") {
      toast.error("Ingresá un precio válido.")
      return
    }
    startGuardado(async () => {
      const r = await agregarParticipantes(actividadId, resumen.ids, equipoId === SIN_EQUIPO ? null : equipoId, valorPrecio)
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
        <DialogTitle className="font-heading text-2xl">Agregar varios</DialogTitle>
        <DialogDescription>
          {filas
            ? "Revisá a quién corresponde cada nombre antes de agregar."
            : "Pegá la lista de nombres que llegó por WhatsApp, uno por línea."}
        </DialogDescription>
      </DialogHeader>

      {!filas ? (
        <Field>
          <FieldLabel htmlFor="lista-wa" className="sr-only">
            Lista de nombres
          </FieldLabel>
          <Textarea
            id="lista-wa"
            rows={9}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={"1. Juan Bianchi ✅\n2. Nico Barrios\n3. Sofi Herrera"}
            autoFocus
          />
          <FieldDescription>
            Se ignoran los números, viñetas, emojis y aclaraciones entre paréntesis.{" "}
            {nombres.length > 0 && (
              <b className="text-foreground">
                {nombres.length} {nombres.length === 1 ? "nombre" : "nombres"}.
              </b>
            )}
          </FieldDescription>
        </Field>
      ) : (
        <div className="space-y-4">
          {!esClase && equipos.length > 0 && (
            <Field>
              <FieldLabel htmlFor="av-equipo">Equipo</FieldLabel>
              <Select value={equipoId} onValueChange={setEquipoId}>
                <SelectTrigger id="av-equipo" className="w-full">
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

          <ul className="divide-y rounded-xl border">
            {filas.map((f) => {
              const elegido = f.elegido === NO_AGREGAR ? null : (porId.get(f.elegido) ?? f.creado)
              const yaAnotado = elegido && (anotados.has(elegido.id) || elegido.id === profesorId)
              return (
                <li key={f.indice} className="grid gap-2 px-3 py-3 sm:grid-cols-[minmax(0,11rem)_1fr] sm:items-center">
                  <div className="flex items-center gap-2">
                    {elegido && !yaAnotado ? (
                      <CheckCircle2Icon className="size-4 shrink-0 text-exito" aria-hidden />
                    ) : (
                      <AlertTriangleIcon
                        className={cn("size-4 shrink-0", yaAnotado ? "text-muted-foreground" : "text-alerta")}
                        aria-hidden
                      />
                    )}
                    <p className="truncate text-sm font-medium" title={f.texto}>
                      «{f.texto}»
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={f.elegido} onValueChange={(v) => elegir(f.indice, v)}>
                      <SelectTrigger className="w-full min-w-0" aria-label={`Jugador para «${f.texto}»`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {f.candidatos.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.apellido}, {c.nombre} ({formatearHandicap(c.handicap)})
                            {c.club_origen ? ` · ${c.club_origen}` : ""}
                          </SelectItem>
                        ))}
                        {f.creado && (
                          <SelectItem value={f.creado.id}>
                            {f.creado.apellido}, {f.creado.nombre} (nuevo)
                          </SelectItem>
                        )}
                        <SelectItem value={NO_AGREGAR}>
                          {f.candidatos.length ? "No agregar" : "Sin coincidencias · no agregar"}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <AltaRapidaJugador
                      nombreInicial={f.texto}
                      onCreado={(j) => {
                        const nuevo = aJugadorOpcion(j)
                        setFilas((fs) => fs && fs.map((x) => (x.indice === f.indice ? { ...x, creado: nuevo, elegido: nuevo.id } : x)))
                      }}
                      trigger={
                        <Button variant="ghost" size="icon-lg" title="Alta rápida" aria-label={`Dar de alta a «${f.texto}»`}>
                          <ZapIcon />
                        </Button>
                      }
                    />
                  </div>
                  {(yaAnotado || (elegido && elegido.apto_estado !== "vigente")) && (
                    <div className="flex flex-wrap gap-1 sm:col-start-2">
                      {yaAnotado && <span className="text-xs text-muted-foreground">Ya está anotado: se omite.</span>}
                      {elegido && !yaAnotado && elegido.apto_estado !== "vigente" && (
                        <InsigniaApto estado={elegido.apto_estado} />
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>

          <CampoPrecio id="av-precio" valor={precio} onChange={setPrecio} precioActividad={precioActividad} />

          <p className="text-sm text-muted-foreground">
            Se van a anotar <b className="text-foreground">{resumen.ids.length}</b>
            {resumen.yaAnotados > 0 && ` · ${resumen.yaAnotados} ya estaban`}
            {sinResolver > 0 && ` · ${sinResolver} sin agregar`}.
          </p>
        </div>
      )}

      <DialogFooter>
        {filas ? (
          <>
            <Button variant="outline" size="lg" onClick={() => setFilas(null)}>
              <ArrowLeftIcon /> Volver a la lista
            </Button>
            <Button size="lg" onClick={confirmar} disabled={guardando || resumen.ids.length === 0} className="min-w-36">
              {guardando && <Loader2Icon className="animate-spin" />}
              Agregar {resumen.ids.length || ""}
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" size="lg" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button size="lg" onClick={buscar} disabled={buscando || nombres.length === 0} className="min-w-36">
              {buscando ? <Loader2Icon className="animate-spin" /> : <SearchIcon />}
              Buscar coincidencias
            </Button>
          </>
        )}
      </DialogFooter>
    </>
  )
}
