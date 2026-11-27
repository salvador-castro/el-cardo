"use client"

import {
  GraduationCapIcon,
  ListPlusIcon,
  Loader2Icon,
  PencilIcon,
  Trash2Icon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition, type ReactNode } from "react"
import { toast } from "sonner"

import { eliminarEquipo, quitarParticipantes } from "@/app/(app)/actividades/actions"
import { InsigniaEstadoCobro } from "@/components/cobros/insignias-cobro"
import { InsigniaApto } from "@/components/jugadores/insignias"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { JugadorOpcion } from "@/lib/actividades/constantes"
import {
  ordenarPorApellido,
  sumaHandicap,
  type ActividadDetalle,
  type EquipoDetalle,
  type ParticipanteDetalle,
} from "@/lib/actividades/detalle"
import { formatearHandicap, formatearMonto } from "@/lib/formato"
import { cn } from "@/lib/utils"
import { COLOR_CAMISETA, COLORES_CAMISETA } from "@/lib/actividades/colores"
import { Camiseta } from "../camiseta"
import { MenuParticipante } from "./menu-participante"
import { ModalAgregarJugadores } from "./modal-agregar-jugadores"
import { ModalAgregarVarios } from "./modal-agregar-varios"
import { ModalEquipo, type EquipoEnEdicion } from "./modal-equipo"

const NOMBRES_SUGERIDOS = ["Blanco", "Azul", "Rojo", "Verde", "Negro", "Amarillo"]

export function TabParticipantes({
  actividad,
  equipos,
  participantes,
  jugadores,
}: {
  actividad: ActividadDetalle
  equipos: EquipoDetalle[]
  participantes: ParticipanteDetalle[]
  jugadores: JugadorOpcion[]
}) {
  const [equipoAbierto, setEquipoAbierto] = useState<EquipoEnEdicion | null>(null)
  const [agregarAbierto, setAgregarAbierto] = useState(false)
  const [variosAbierto, setVariosAbierto] = useState(false)

  const esClase = actividad.tipo === "clase"
  const editable = actividad.estado !== "cancelada"
  const profesorId = actividad.profesor?.id ?? null

  const deEquipo = (id: string | null) => ordenarPorApellido(participantes.filter((p) => p.equipo_id === id))
  const sinEquipo = deEquipo(null)

  const nuevoEquipo = (jugadoresIniciales: string[] = []) => {
    const usados = new Set(equipos.map((e) => e.nombre.toLowerCase()))
    const nombre = NOMBRES_SUGERIDOS.find((n) => !usados.has(n.toLowerCase())) ?? ""
    // Si el nombre sugerido es un color, la camiseta arranca con ese color.
    const color = COLORES_CAMISETA.find((c) => COLOR_CAMISETA[c].etiqueta === nombre) ?? null
    setEquipoAbierto({ id: null, nombre, jugadores: jugadoresIniciales, color })
  }

  const fila = (p: ParticipanteDetalle) => (
    <FilaParticipante
      key={p.id}
      p={p}
      menu={
        <MenuParticipante p={p} equipos={equipos} conEquipos={!esClase} precioActividad={actividad.precio} editable={editable} />
      }
    />
  )

  return (
    <div className="space-y-4">
      {editable ? (
        <div className="flex flex-wrap gap-2">
          {!esClase && (
            <Button size="lg" onClick={() => nuevoEquipo()}>
              <UsersIcon /> Armar equipo
            </Button>
          )}
          <Button
            size="lg"
            variant={esClase ? "default" : "outline"}
            className={cn(!esClase && "bg-card")}
            onClick={() => setAgregarAbierto(true)}
          >
            <UserPlusIcon /> {esClase ? "Agregar alumnos" : "Agregar jugadores"}
          </Button>
          <Button size="lg" variant="outline" className="bg-card" onClick={() => setVariosAbierto(true)}>
            <ListPlusIcon /> Agregar varios
          </Button>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed bg-card px-4 py-3 text-sm text-muted-foreground">
          La actividad está cancelada: no se pueden anotar jugadores. Reactivala para hacer cambios.
        </p>
      )}

      {esClase ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_1fr]">
          <Card className="self-start">
            <CardHeader>
              <CardTitle className="font-heading text-xl font-semibold">Profesor</CardTitle>
            </CardHeader>
            <CardContent>
              {actividad.profesor ? (
                <Link
                  href={`/jugadores/${actividad.profesor.id}`}
                  className="flex items-center gap-3 rounded-lg p-1 hover:bg-muted/50"
                >
                  <span className="flex size-10 items-center justify-center rounded-full bg-dorado/20 text-dorado-oscuro">
                    <GraduationCapIcon className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {actividad.profesor.nombre} {actividad.profesor.apellido}
                  </span>
                  <span className="font-heading text-xl font-semibold tabular-nums">
                    {formatearHandicap(actividad.profesor.handicap)}
                  </span>
                </Link>
              ) : (
                <p className="text-sm text-muted-foreground">Sin profesor asignado.</p>
              )}
            </CardContent>
          </Card>
          <GrupoParticipantes
            titulo="Alumnos"
            lista={ordenarPorApellido(participantes)}
            fila={fila}
            vacio="Todavía no hay alumnos anotados."
          />
        </div>
      ) : participantes.length === 0 && equipos.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card px-6 py-14 text-center text-sm text-muted-foreground">
          Todavía no hay jugadores anotados. Armá un equipo o agregá jugadores sueltos.
        </div>
      ) : (
        <div className="space-y-4">
          {editable && sinEquipo.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dorado/50 bg-dorado/10 px-4 py-3">
              <p className="text-sm">
                {sinEquipo.length === 1 ? "Hay 1 jugador anotado" : `Hay ${sinEquipo.length} jugadores anotados`} sin equipo.
                {equipos.length < 2 && " Armá los equipos para poder cargar los partidos."}
              </p>
              <Button onClick={() => nuevoEquipo()}>
                <UsersIcon /> Armar equipo
              </Button>
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {equipos.map((e) => {
              const lista = deEquipo(e.id)
              return (
                <GrupoParticipantes
                  key={e.id}
                  titulo={e.nombre}
                  icono={
                    editable && !e.color ? (
                      <button
                        type="button"
                        onClick={() =>
                          setEquipoAbierto({ id: e.id, nombre: e.nombre, jugadores: lista.map((p) => p.jugador.id), color: null })
                        }
                        title="Elegir camiseta"
                        aria-label={`Elegir la camiseta de ${e.nombre}`}
                        className="rounded-md p-0.5 hover:bg-muted"
                      >
                        <Camiseta color={null} className="size-7" />
                      </button>
                    ) : (
                      <Camiseta color={e.color} className="size-7" />
                    )
                  }
                  lista={lista}
                  fila={fila}
                  vacio="Sin jugadores."
                  detalle={e.color ? undefined : "sin camiseta"}
                  hcp={sumaHandicap(lista.map((p) => p.jugador))}
                  acciones={
                    editable && (
                      <AccionesEquipo
                        equipo={e}
                        lista={lista}
                        onEditar={() =>
                          setEquipoAbierto({ id: e.id, nombre: e.nombre, jugadores: lista.map((p) => p.jugador.id), color: e.color })
                        }
                      />
                    )
                  }
                />
              )
            })}
            {sinEquipo.length > 0 && (
              <GrupoParticipantes
                titulo="Anotados sin equipo"
                lista={sinEquipo}
                fila={fila}
                vacio=""
                hcp={sumaHandicap(sinEquipo.map((p) => p.jugador))}
                apagado
                acciones={
                  editable && (
                    <AccionesSinEquipo
                      actividadId={actividad.id}
                      lista={sinEquipo}
                      onArmar={() => nuevoEquipo(sinEquipo.map((p) => p.jugador.id))}
                    />
                  )
                }
              />
            )}
          </div>
        </div>
      )}

      <ModalEquipo
        actividadId={actividad.id}
        equipo={equipoAbierto}
        onCerrar={() => setEquipoAbierto(null)}
        jugadores={jugadores}
        participantes={participantes}
        profesorId={profesorId}
      />
      <ModalAgregarJugadores
        abierto={agregarAbierto}
        onAbiertoChange={setAgregarAbierto}
        actividadId={actividad.id}
        esClase={esClase}
        jugadores={jugadores}
        participantes={participantes}
        equipos={equipos}
        profesorId={profesorId}
        precioActividad={actividad.precio}
      />
      <ModalAgregarVarios
        abierto={variosAbierto}
        onAbiertoChange={setVariosAbierto}
        actividadId={actividad.id}
        esClase={esClase}
        jugadores={jugadores}
        participantes={participantes}
        equipos={equipos}
        profesorId={profesorId}
        precioActividad={actividad.precio}
      />
    </div>
  )
}

function GrupoParticipantes({
  titulo,
  lista,
  fila,
  vacio,
  hcp,
  acciones,
  apagado,
  icono,
  detalle,
}: {
  icono?: ReactNode
  detalle?: string
  titulo: string
  lista: ParticipanteDetalle[]
  fila: (p: ParticipanteDetalle) => ReactNode
  vacio: string
  hcp?: number
  acciones?: ReactNode
  apagado?: boolean
}) {
  return (
    <Card className={cn("gap-0 py-0", apagado && "border-dashed")}>
      <CardHeader className="flex flex-row items-center gap-3 border-b py-3">
        {icono}
        <div className="min-w-0 flex-1">
          <CardTitle className="truncate font-heading text-xl font-semibold">{titulo}</CardTitle>
          <p className="text-xs text-muted-foreground">
            {lista.length} {lista.length === 1 ? "jugador" : "jugadores"}
            {detalle && ` · ${detalle}`}
          </p>
        </div>
        {hcp !== undefined && (
          <div className="text-center">
            <p className="font-heading text-2xl leading-none font-semibold tabular-nums">{formatearHandicap(hcp)}</p>
            <p className="text-[0.6rem] tracking-[0.15em] text-muted-foreground uppercase">Hcp</p>
          </div>
        )}
        {acciones}
      </CardHeader>
      <CardContent className="px-2 py-1">
        {lista.length ? (
          <ul className="divide-y">{lista.map(fila)}</ul>
        ) : (
          vacio && <p className="px-2 py-6 text-center text-sm text-muted-foreground">{vacio}</p>
        )}
      </CardContent>
    </Card>
  )
}

function FilaParticipante({ p, menu }: { p: ParticipanteDetalle; menu: ReactNode }) {
  const j = p.jugador
  return (
    <li className="flex items-center gap-2 py-1.5 pl-2">
      <div className="min-w-0 flex-1">
        <Link href={`/jugadores/${j.id}`} className="block truncate text-sm font-medium hover:underline">
          {j.apellido}, {j.nombre}
        </Link>
        <div className="mt-0.5 flex flex-wrap items-center gap-1">
          {j.apto_estado !== "vigente" && <InsigniaApto estado={j.apto_estado} compacta />}
          {!j.activo && <Badge variant="outline">Inactivo</Badge>}
          {p.precio !== null && (
            <Badge variant="outline" className="border-dorado/60 text-dorado-oscuro" title="Precio especial">
              {p.precio === 0 ? "Sin cargo" : formatearMonto(p.precio)}
            </Badge>
          )}
          {p.bonificado ? (
            <InsigniaEstadoCobro estado="bonificado" />
          ) : (
            p.cobro && p.cobro.estado !== "pendiente" && <InsigniaEstadoCobro estado={p.cobro.estado} />
          )}
        </div>
      </div>
      <span className="w-8 text-right font-heading text-lg font-semibold tabular-nums">{formatearHandicap(j.handicap)}</span>
      {menu}
    </li>
  )
}

// Texto de aviso sobre los cobros de los jugadores que se quitan.
function avisoCobros(lista: ParticipanteDetalle[]) {
  const pagados = lista.filter((p) => p.cobro?.estado === "pagado").length
  const impagos = lista.filter((p) => p.cobro && (p.cobro.estado === "pendiente" || p.cobro.estado === "vencido")).length
  return [
    impagos > 0 && `${impagos === 1 ? "Se anula 1 cobro impago" : `Se anulan ${impagos} cobros impagos`}.`,
    pagados > 0 &&
      `${pagados === 1 ? "1 jugador ya pagó" : `${pagados} jugadores ya pagaron`}: el pago queda registrado en su cuenta corriente.`,
  ]
    .filter(Boolean)
    .join(" ")
}

function AccionesEquipo({ equipo, lista, onEditar }: { equipo: EquipoDetalle; lista: ParticipanteDetalle[]; onEditar: () => void }) {
  const router = useRouter()
  const [pendiente, startTransition] = useTransition()
  const [confirmar, setConfirmar] = useState(false)
  const cantidad = lista.length

  const eliminar = (quitarJugadores: boolean) =>
    startTransition(async () => {
      const r = await eliminarEquipo(equipo.id, quitarJugadores)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(
        quitarJugadores && cantidad > 0
          ? `Se eliminó ${equipo.nombre} y se quitó a sus ${cantidad} jugadores.`
          : `Se eliminó el equipo ${equipo.nombre}.`,
      )
      setConfirmar(false)
      router.refresh()
    })

  return (
    <>
      <Button variant="outline" onClick={onEditar} aria-label={`Editar el equipo ${equipo.nombre}`}>
        <PencilIcon /> <span className="hidden sm:inline">Editar</span>
      </Button>
      <Button
        variant="ghost"
        size="icon-lg"
        onClick={() => setConfirmar(true)}
        aria-label={`Eliminar el equipo ${equipo.nombre}`}
        title="Eliminar equipo"
        className="text-muted-foreground hover:text-destructive"
      >
        <Trash2Icon />
      </Button>

      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar el equipo {equipo.nombre}?</AlertDialogTitle>
            <AlertDialogDescription>
              {cantidad === 0
                ? "El equipo no tiene jugadores."
                : `Tiene ${cantidad} ${cantidad === 1 ? "jugador" : "jugadores"}. Podés dejarlos anotados sin equipo, o quitarlos también de la actividad. ${avisoCobros(lista)}`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:flex-wrap">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            {cantidad > 0 && (
              <Button variant="outline" onClick={() => eliminar(false)} disabled={pendiente}>
                Solo el equipo
              </Button>
            )}
            <Button variant="destructive" onClick={() => eliminar(true)} disabled={pendiente}>
              {pendiente && <Loader2Icon className="animate-spin" />}
              {cantidad > 0 ? "Equipo y jugadores" : "Eliminar"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function AccionesSinEquipo({
  actividadId,
  lista,
  onArmar,
}: {
  actividadId: string
  lista: ParticipanteDetalle[]
  onArmar: () => void
}) {
  const router = useRouter()
  const [pendiente, startTransition] = useTransition()
  const [confirmar, setConfirmar] = useState(false)

  const quitarTodos = () =>
    startTransition(async () => {
      const r = await quitarParticipantes(
        actividadId,
        lista.map((p) => p.id),
      )
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(r.datos.quitados === 1 ? "Se quitó 1 jugador." : `Se quitaron ${r.datos.quitados} jugadores.`)
      setConfirmar(false)
      router.refresh()
    })

  return (
    <>
      <Button variant="outline" onClick={onArmar} title="Armar un equipo con estos jugadores">
        <UsersIcon /> <span className="hidden sm:inline">Armar equipo con estos</span>
      </Button>
      <Button
        variant="ghost"
        size="icon-lg"
        onClick={() => setConfirmar(true)}
        aria-label="Quitar a todos los anotados sin equipo"
        title="Quitar a todos"
        className="text-muted-foreground hover:text-destructive"
      >
        <Trash2Icon />
      </Button>

      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Quitar a {lista.length === 1 ? "1 jugador" : `los ${lista.length} jugadores`} sin equipo?
            </AlertDialogTitle>
            <AlertDialogDescription>Dejan de figurar en la actividad. {avisoCobros(lista)}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button variant="destructive" onClick={quitarTodos} disabled={pendiente}>
              {pendiente && <Loader2Icon className="animate-spin" />}
              Quitar a todos
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
