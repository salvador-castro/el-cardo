"use client"

import { EllipsisVerticalIcon, Loader2Icon, MinusIcon, PencilIcon, PlusIcon, ShuffleIcon, Trash2Icon, TrophyIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"

import { eliminarPartido } from "@/app/(app)/actividades/actions"
import {
  borrarResultado,
  generarTodosContraTodos,
  guardarPartidoTorneo,
  guardarResultado,
} from "@/app/(app)/torneos/actions"
import { Camiseta } from "@/components/actividades/camiseta"
import {
  AlertDialog,
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
import { Switch } from "@/components/ui/switch"
import { fechaHoraAR } from "@/lib/actividades/esquema"
import type { CategoriaDetalle, EquipoDetalle, ParticipanteDetalle } from "@/lib/actividades/detalle"
import { formatearFecha, formatearHora } from "@/lib/formato"
import { ETIQUETA_FASE, ETIQUETA_FORMATO, FASES, type Fase, type PartidoTorneo } from "@/lib/torneos/constantes"
import { esquemaPartidoTorneo, type LadoPartido } from "@/lib/torneos/esquema"
import { nombresDePartidos, ordenarPartidos, textoOrigen } from "@/lib/torneos/nombres"
import { cn } from "@/lib/utils"

type Contexto = {
  torneoId: string
  categorias: CategoriaDetalle[]
  equipos: EquipoDetalle[]
  partidos: PartidoTorneo[]
  participantes: ParticipanteDetalle[]
  golesPorPartido: { partido_id: string; jugador_id: string; cantidad: number }[]
  nombres: Map<string, string>
  zonas: Map<string, string>
  equipoPorId: Map<string, EquipoDetalle>
  editable: boolean
  fechaInicio: string
  fechaFin: string
}

export function TabFixture({
  torneoId,
  inicio,
  fin,
  categorias,
  equipos,
  partidos,
  participantes,
  golesPorPartido,
  editable,
}: {
  torneoId: string
  inicio: string
  fin: string | null
  categorias: CategoriaDetalle[]
  equipos: EquipoDetalle[]
  partidos: PartidoTorneo[]
  participantes: ParticipanteDetalle[]
  golesPorPartido: { partido_id: string; jugador_id: string; cantidad: number }[]
  editable: boolean
}) {
  const ctx: Contexto = useMemo(
    () => ({
      torneoId,
      categorias,
      equipos,
      partidos,
      participantes,
      golesPorPartido,
      nombres: nombresDePartidos(partidos),
      zonas: new Map(categorias.flatMap((c) => c.zonas.map((z) => [z.id, z.nombre] as const))),
      equipoPorId: new Map(equipos.map((e) => [e.id, e])),
      editable,
      fechaInicio: fechaHoraAR(inicio).fecha,
      fechaFin: fechaHoraAR(fin ?? inicio).fecha,
    }),
    [torneoId, categorias, equipos, partidos, participantes, golesPorPartido, editable, inicio, fin],
  )
  const [editando, setEditando] = useState<{ partido: PartidoTorneo | null; categoriaId: string } | null>(null)
  const [resultado, setResultado] = useState<PartidoTorneo | null>(null)

  if (categorias.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card px-6 py-14 text-center text-sm text-muted-foreground">
        Primero creá las categorías (y sus equipos) para armar el fixture.
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {categorias.map((c) => (
        <SeccionCategoria
          key={c.id}
          categoria={c}
          ctx={ctx}
          onNuevo={() => setEditando({ partido: null, categoriaId: c.id })}
          onEditar={(p) => setEditando({ partido: p, categoriaId: c.id })}
          onResultado={setResultado}
        />
      ))}

      <Dialog open={editando !== null} onOpenChange={(v) => !v && setEditando(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
          {editando && (
            <ModalPartido
              key={editando.partido?.id ?? `nuevo-${editando.categoriaId}`}
              ctx={ctx}
              partido={editando.partido}
              categoriaInicial={editando.categoriaId}
              onCerrar={() => setEditando(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={resultado !== null} onOpenChange={(v) => !v && setResultado(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
          {resultado && <ModalResultado key={resultado.id} ctx={ctx} partido={resultado} onCerrar={() => setResultado(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Categoría: fase de grupos (por zona) y llave
// ---------------------------------------------------------------------------

function SeccionCategoria({
  categoria: c,
  ctx,
  onNuevo,
  onEditar,
  onResultado,
}: {
  categoria: CategoriaDetalle
  ctx: Contexto
  onNuevo: () => void
  onEditar: (p: PartidoTorneo) => void
  onResultado: (p: PartidoTorneo) => void
}) {
  const router = useRouter()
  const [generando, startGenerar] = useTransition()
  const propios = ordenarPartidos(ctx.partidos.filter((p) => p.categoria_id === c.id))
  const grupos = propios.filter((p) => p.fase === "grupos")
  const llave = propios.filter((p) => p.fase !== "grupos")
  const conGrupos = c.formato !== "eliminacion"
  const zonas = c.zonas.length ? c.zonas : [{ id: null as string | null, nombre: "Grupo único", orden: 0 }]

  const generar = (zonaId: string | null) =>
    startGenerar(async () => {
      const r = await generarTodosContraTodos(c.id, zonaId)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(r.datos.creados ? `Se crearon ${r.datos.creados} partidos.` : "No faltaba ningún cruce.")
      router.refresh()
    })

  const tarjeta = (p: PartidoTorneo) => (
    <TarjetaPartido key={p.id} p={p} ctx={ctx} onEditar={() => onEditar(p)} onResultado={() => onResultado(p)} />
  )

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b pb-2">
        <div>
          <h3 className="font-heading text-2xl font-semibold">{c.nombre}</h3>
          <p className="text-xs text-muted-foreground">
            {ETIQUETA_FORMATO[c.formato]} · {propios.filter((p) => p.estado === "jugado").length}/{propios.length} jugados
          </p>
        </div>
        {ctx.editable && (
          <Button onClick={onNuevo}>
            <PlusIcon /> Nuevo partido
          </Button>
        )}
      </div>

      {conGrupos && (
        <div className="space-y-4">
          {zonas.map((z) => {
            const deZona = grupos.filter((p) => (z.id ? p.zona_id === z.id : !p.zona_id))
            const equiposZona = ctx.equipos.filter((e) => e.categoria_id === c.id && (z.id ? e.zona_id === z.id : !e.zona_id))
            return (
              <div key={z.id ?? "unico"} className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">
                    {z.nombre}{" "}
                    <span className="font-normal text-muted-foreground">
                      · {equiposZona.length} equipos · {deZona.length} partidos
                    </span>
                  </p>
                  {ctx.editable && equiposZona.length >= 2 && (
                    <Button variant="outline" size="sm" onClick={() => generar(z.id)} disabled={generando}>
                      {generando ? <Loader2Icon className="animate-spin" /> : <ShuffleIcon />} Todos contra todos
                    </Button>
                  )}
                </div>
                {deZona.length ? (
                  <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{deZona.map(tarjeta)}</ol>
                ) : (
                  <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
                    {equiposZona.length < 2
                      ? "Asigná al menos dos equipos (pestaña Categorías)."
                      : "Sin partidos: usá «Todos contra todos» o creá los cruces a mano."}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {(llave.length > 0 || c.formato !== "puntos") && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <TrophyIcon className="size-4 text-dorado-oscuro" /> Llave
          </p>
          {llave.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
              Creá los cruces con «Nuevo partido»: cada lado puede ser un equipo, el ganador de otro partido o un puesto de
              zona. Se completan solos con los resultados.
            </p>
          ) : (
            <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
              <div className="flex gap-4">
                {FASES.filter((f) => f !== "grupos" && llave.some((p) => p.fase === f)).map((f) => (
                  <div key={f} className="w-72 shrink-0 space-y-2">
                    <p className="text-xs tracking-wide text-muted-foreground uppercase">{ETIQUETA_FASE[f].split(" (")[0]}</p>
                    <ol className="space-y-3">{llave.filter((p) => p.fase === f).map(tarjeta)}</ol>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Tarjeta de partido
// ---------------------------------------------------------------------------

function TarjetaPartido({
  p,
  ctx,
  onEditar,
  onResultado,
}: {
  p: PartidoTorneo
  ctx: Contexto
  onEditar: () => void
  onResultado: () => void
}) {
  const router = useRouter()
  const [pendiente, startTransition] = useTransition()
  const [confirmar, setConfirmar] = useState(false)
  const jugado = p.estado === "jugado"
  const listo = !!p.equipo_a_id && !!p.equipo_b_id
  const dependientes = ctx.partidos.filter((x) => x.desde_a_partido === p.id || x.desde_b_partido === p.id).length

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

  const lado = (l: "a" | "b") => {
    const equipoId = l === "a" ? p.equipo_a_id : p.equipo_b_id
    const goles = l === "a" ? p.goles_a : p.goles_b
    const rival = l === "a" ? p.goles_b : p.goles_a
    const gana = jugado && (goles ?? 0) > (rival ?? 0)
    const equipo = equipoId ? ctx.equipoPorId.get(equipoId) : null
    const origen = textoOrigen(p, l, ctx.nombres, ctx.zonas)
    return (
      <div className="flex items-center gap-2.5">
        <Camiseta color={equipo?.color ?? null} className="size-6" />
        <div className="min-w-0 flex-1">
          <p className={cn("truncate text-sm", gana ? "font-semibold" : "font-medium", !equipo && "text-muted-foreground italic")}>
            {equipo?.nombre ?? origen ?? "A definir"}
          </p>
          {equipo && origen && <p className="truncate text-[0.7rem] text-muted-foreground">{origen}</p>}
        </div>
        <span
          className={cn(
            "w-7 text-right font-heading text-2xl leading-none font-semibold tabular-nums",
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
      <div className="flex items-center gap-1.5 border-b px-3 py-1.5 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{ctx.nombres.get(p.id)}</span>
        {p.inicio && (
          <span className="truncate tabular-nums">
            · {formatearFecha(p.inicio).slice(0, 5)} {formatearHora(p.inicio)} h
          </span>
        )}
        {p.cancha && <span className="truncate">· {p.cancha}</span>}
        <span
          className={cn(
            "ml-auto shrink-0 rounded-full px-2 py-0.5",
            jugado ? "bg-exito-suave text-exito" : listo ? "bg-alerta-suave text-alerta" : "bg-muted",
          )}
        >
          {jugado ? "Jugado" : listo ? "Por jugar" : "Esperando"}
        </span>
        {ctx.editable && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Opciones de ${ctx.nombres.get(p.id)}`} disabled={pendiente}>
                <EllipsisVerticalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {listo && (
                <DropdownMenuItem onSelect={onResultado}>
                  <TrophyIcon /> {jugado ? "Editar resultado" : "Cargar resultado"}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={onEditar}>
                <PencilIcon /> Editar partido
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmar(true)}>
                <Trash2Icon /> Eliminar partido
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <div className="space-y-1.5 px-3 py-2.5">
        {lado("a")}
        {lado("b")}
      </div>
      {jugado && p.goles_chukkers && (
        <p className="border-t px-3 py-1.5 text-[0.7rem] text-muted-foreground tabular-nums">
          Chukkers: {p.goles_chukkers.map((c) => `${c.a}-${c.b}`).join(" · ")}
        </p>
      )}
      {ctx.editable && listo && !jugado && (
        <div className="border-t px-2 py-1.5">
          <Button variant="ghost" size="sm" onClick={onResultado} className="text-dorado-oscuro">
            Cargar resultado
          </Button>
        </div>
      )}

      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {ctx.nombres.get(p.id)}?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borra el partido{jugado ? " con su resultado y goleadores" : ""}.
              {dependientes > 0 && ` ${dependientes} partido(s) de la llave esperaban su resultado: van a quedar sin origen.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button variant="destructive" onClick={eliminar} disabled={pendiente}>
              {pendiente && <Loader2Icon className="animate-spin" />}
              Eliminar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  )
}

// ---------------------------------------------------------------------------
// Nuevo / editar partido
// ---------------------------------------------------------------------------

const SIN_ZONA = "__sin_zona__"
const A_DEFINIR = "__a_definir__"

function ladoDesdePartido(p: PartidoTorneo, l: "a" | "b"): LadoPartido {
  const partido = l === "a" ? p.desde_a_partido : p.desde_b_partido
  const resultado = l === "a" ? p.desde_a_resultado : p.desde_b_resultado
  const zona = l === "a" ? p.desde_a_zona : p.desde_b_zona
  const puesto = l === "a" ? p.desde_a_puesto : p.desde_b_puesto
  if (partido) return { tipo: resultado ?? "ganador", partido_id: partido }
  if (zona) return { tipo: "puesto", zona_id: zona, puesto: puesto ?? 1 }
  return { tipo: "equipo", equipo_id: l === "a" ? p.equipo_a_id : p.equipo_b_id }
}

function ModalPartido({
  ctx,
  partido,
  categoriaInicial,
  onCerrar,
}: {
  ctx: Contexto
  partido: PartidoTorneo | null
  categoriaInicial: string
  onCerrar: () => void
}) {
  const router = useRouter()
  const [pendiente, startTransition] = useTransition()
  const catInicial = ctx.categorias.find((c) => c.id === categoriaInicial)
  const [categoriaId, setCategoriaId] = useState(partido?.categoria_id ?? categoriaInicial)
  const [fase, setFase] = useState<Fase>(partido?.fase ?? (catInicial?.formato === "eliminacion" ? "cuartos" : "grupos"))
  const [zonaId, setZonaId] = useState<string | null>(partido?.zona_id ?? catInicial?.zonas[0]?.id ?? null)
  const [a, setA] = useState<LadoPartido>(partido ? ladoDesdePartido(partido, "a") : { tipo: "equipo", equipo_id: null })
  const [b, setB] = useState<LadoPartido>(partido ? ladoDesdePartido(partido, "b") : { tipo: "equipo", equipo_id: null })
  const inicio = partido?.inicio ? fechaHoraAR(partido.inicio) : null
  const [fecha, setFecha] = useState(inicio?.fecha ?? ctx.fechaInicio)
  const [hora, setHora] = useState(inicio?.hora ?? "")
  const [cancha, setCancha] = useState(partido?.cancha ?? "")
  const [chukkers, setChukkers] = useState(partido?.chukkers ?? 4)

  const categoria = ctx.categorias.find((c) => c.id === categoriaId)
  const esGrupos = fase === "grupos"
  const equiposCategoria = ctx.equipos.filter(
    (e) => e.categoria_id === categoriaId && (!esGrupos || !categoria?.zonas.length || e.zona_id === zonaId),
  )
  const otrosPartidos = ordenarPartidos(ctx.partidos.filter((p) => p.categoria_id === categoriaId && p.id !== partido?.id))

  const cambiarFase = (f: Fase) => {
    setFase(f)
    if (f === "grupos") {
      setA((x) => (x.tipo === "equipo" ? x : { tipo: "equipo", equipo_id: null }))
      setB((x) => (x.tipo === "equipo" ? x : { tipo: "equipo", equipo_id: null }))
    }
  }

  const guardar = () => {
    const parsed = esquemaPartidoTorneo.safeParse({
      categoria_id: categoriaId,
      zona_id: esGrupos ? zonaId : null,
      fase,
      fecha,
      hora,
      cancha,
      chukkers,
      a,
      b,
    })
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Revisá los datos del partido.")
      return
    }
    if (esGrupos && (a.tipo !== "equipo" || b.tipo !== "equipo" || !a.equipo_id || !b.equipo_id)) {
      toast.error("Seleccioná los dos equipos.")
      return
    }
    startTransition(async () => {
      const r = await guardarPartidoTorneo(ctx.torneoId, partido?.id ?? null, parsed.data)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(partido ? "Partido actualizado." : "Partido creado.")
      onCerrar()
      router.refresh()
    })
  }

  const selectorLado = (l: "a" | "b") => {
    const valor = l === "a" ? a : b
    const otro = l === "a" ? b : a
    const set = l === "a" ? setA : setB
    const otroEquipo = otro.tipo === "equipo" ? otro.equipo_id : null
    return (
      <div className="space-y-2 rounded-xl border p-3">
        <p className="text-sm font-medium">{l === "a" ? "Equipo 1" : "Equipo 2"}</p>
        {!esGrupos && (
          <Select
            value={valor.tipo}
            onValueChange={(t) =>
              set(
                t === "equipo"
                  ? { tipo: "equipo", equipo_id: null }
                  : t === "puesto"
                    ? { tipo: "puesto", zona_id: categoria?.zonas[0]?.id ?? "", puesto: 1 }
                    : { tipo: t as "ganador" | "perdedor", partido_id: "" },
              )
            }
          >
            <SelectTrigger className="w-full" aria-label="De dónde sale este equipo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="equipo">Un equipo</SelectItem>
              <SelectItem value="ganador" disabled={otrosPartidos.length === 0}>
                Ganador de otro partido
              </SelectItem>
              <SelectItem value="perdedor" disabled={otrosPartidos.length === 0}>
                Perdedor de otro partido
              </SelectItem>
              <SelectItem value="puesto" disabled={!categoria?.zonas.length}>
                Puesto de una zona
              </SelectItem>
            </SelectContent>
          </Select>
        )}

        {valor.tipo === "equipo" && (
          <Select
            value={valor.equipo_id ?? (esGrupos ? undefined : A_DEFINIR)}
            onValueChange={(v) => set({ tipo: "equipo", equipo_id: v === A_DEFINIR ? null : v })}
          >
            <SelectTrigger className="w-full" aria-label="Equipo">
              <SelectValue placeholder="Seleccionar equipo" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {!esGrupos && <SelectItem value={A_DEFINIR}>A definir</SelectItem>}
              {equiposCategoria
                .filter((e) => e.id !== otroEquipo)
                .map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    <Camiseta color={e.color} className="size-4" /> {e.nombre}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        )}

        {(valor.tipo === "ganador" || valor.tipo === "perdedor") && (
          <Select value={valor.partido_id || undefined} onValueChange={(v) => set({ ...valor, partido_id: v })}>
            <SelectTrigger className="w-full" aria-label="Partido de origen">
              <SelectValue placeholder="Seleccionar partido" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {otrosPartidos.map((p) => {
                const nombreLado = (id: string | null, l2: "a" | "b") =>
                  (id && ctx.equipoPorId.get(id)?.nombre) || textoOrigen(p, l2, ctx.nombres, ctx.zonas) || "A definir"
                return (
                  <SelectItem key={p.id} value={p.id}>
                    {ctx.nombres.get(p.id)}: {nombreLado(p.equipo_a_id, "a")} vs {nombreLado(p.equipo_b_id, "b")}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        )}

        {valor.tipo === "puesto" && (
          <div className="grid grid-cols-[5rem_1fr] gap-2">
            <Select value={String(valor.puesto)} onValueChange={(v) => set({ ...valor, puesto: Number(v) })}>
              <SelectTrigger aria-label="Puesto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}.º
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={valor.zona_id || undefined} onValueChange={(v) => set({ ...valor, zona_id: v })}>
              <SelectTrigger aria-label="Zona">
                <SelectValue placeholder="Zona" />
              </SelectTrigger>
              <SelectContent>
                {categoria?.zonas.map((z) => (
                  <SelectItem key={z.id} value={z.id}>
                    de {z.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-heading text-2xl">{partido ? "Editar partido" : "Nuevo partido"}</DialogTitle>
        <DialogDescription>
          {esGrupos
            ? "Partido de zona: elegí los dos equipos."
            : "En la llave, cada lado puede esperar al ganador de otro partido o a un puesto de zona: se completa solo."}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {ctx.categorias.length > 1 && (
            <Field>
              <FieldLabel htmlFor="pt-cat">Categoría</FieldLabel>
              <Select
                value={categoriaId}
                onValueChange={(v) => {
                  setCategoriaId(v)
                  setZonaId(ctx.categorias.find((c) => c.id === v)?.zonas[0]?.id ?? null)
                  setA({ tipo: "equipo", equipo_id: null })
                  setB({ tipo: "equipo", equipo_id: null })
                }}
              >
                <SelectTrigger id="pt-cat" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ctx.categorias.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field className={cn(ctx.categorias.length <= 1 && "col-span-2")}>
            <FieldLabel htmlFor="pt-fase">Fase</FieldLabel>
            <Select value={fase} onValueChange={(v) => cambiarFase(v as Fase)}>
              <SelectTrigger id="pt-fase" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FASES.filter((f) => f !== "grupos" || categoria?.formato !== "eliminacion").map((f) => (
                  <SelectItem key={f} value={f}>
                    {ETIQUETA_FASE[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {esGrupos && !!categoria?.zonas.length && (
            <Field className="col-span-2">
              <FieldLabel htmlFor="pt-zona">Zona</FieldLabel>
              <Select
                value={zonaId ?? SIN_ZONA}
                onValueChange={(v) => {
                  setZonaId(v === SIN_ZONA ? null : v)
                  setA({ tipo: "equipo", equipo_id: null })
                  setB({ tipo: "equipo", equipo_id: null })
                }}
              >
                <SelectTrigger id="pt-zona" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoria.zonas.map((z) => (
                    <SelectItem key={z.id} value={z.id}>
                      {z.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {selectorLado("a")}
          {selectorLado("b")}
        </div>

        <div className="grid grid-cols-[1fr_6.5rem_5rem] gap-3 border-t pt-3">
          <Field>
            <FieldLabel htmlFor="pt-fecha">Día</FieldLabel>
            <Input id="pt-fecha" type="date" value={fecha} min={ctx.fechaInicio} max={ctx.fechaFin} onChange={(e) => setFecha(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="pt-hora">Hora</FieldLabel>
            <Input id="pt-hora" type="time" step={300} value={hora} onChange={(e) => setHora(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="pt-chukkers">Chukkers</FieldLabel>
            <Select value={String(chukkers)} onValueChange={(v) => setChukkers(Number(v))}>
              <SelectTrigger id="pt-chukkers" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field className="col-span-3">
            <FieldLabel htmlFor="pt-cancha">Cancha</FieldLabel>
            <Input id="pt-cancha" value={cancha} placeholder="Opcional" maxLength={60} onChange={(e) => setCancha(e.target.value)} />
          </Field>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" size="lg" onClick={onCerrar}>
          Cancelar
        </Button>
        <Button size="lg" onClick={guardar} disabled={pendiente} className="min-w-32">
          {pendiente && <Loader2Icon className="animate-spin" />}
          {partido ? "Guardar" : "Crear partido"}
        </Button>
      </DialogFooter>
    </>
  )
}

// ---------------------------------------------------------------------------
// Resultado: goles, goles por chukker y goleadores
// ---------------------------------------------------------------------------

function ModalResultado({ ctx, partido: p, onCerrar }: { ctx: Contexto; partido: PartidoTorneo; onCerrar: () => void }) {
  const router = useRouter()
  const [pendiente, startTransition] = useTransition()
  const [golesA, setGolesA] = useState(p.goles_a?.toString() ?? "")
  const [golesB, setGolesB] = useState(p.goles_b?.toString() ?? "")
  const [porChukker, setPorChukker] = useState(!!p.goles_chukkers)
  const [chukkers, setChukkers] = useState<{ a: string; b: string }[]>(() =>
    Array.from({ length: p.chukkers }, (_, i) => ({
      a: p.goles_chukkers?.[i]?.a.toString() ?? "",
      b: p.goles_chukkers?.[i]?.b.toString() ?? "",
    })),
  )
  const [goles, setGoles] = useState<Record<string, number>>(() =>
    Object.fromEntries(ctx.golesPorPartido.filter((g) => g.partido_id === p.id).map((g) => [g.jugador_id, g.cantidad])),
  )

  const num = (v: string) => (v.trim() === "" ? 0 : Number(v))
  const totalA = porChukker ? chukkers.reduce((t, c) => t + num(c.a), 0) : num(golesA)
  const totalB = porChukker ? chukkers.reduce((t, c) => t + num(c.b), 0) : num(golesB)
  const equipoA = ctx.equipoPorId.get(p.equipo_a_id!)
  const equipoB = ctx.equipoPorId.get(p.equipo_b_id!)
  const jugadoresDe = (equipoId: string | null) =>
    ctx.participantes
      .filter((x) => x.equipo_id === equipoId)
      .sort((x, y) => x.jugador.apellido.localeCompare(y.jugador.apellido, "es"))
  const asignados = (equipoId: string | null) => jugadoresDe(equipoId).reduce((t, x) => t + (goles[x.jugador.id] ?? 0), 0)
  const esLlave = p.fase !== "grupos"

  const guardar = () => {
    if (!porChukker && (golesA.trim() === "" || golesB.trim() === "")) {
      toast.error("Cargá los goles de los dos equipos.")
      return
    }
    if (esLlave && totalA === totalB) {
      toast.error("En la llave no puede haber empate: cargá el gol del desempate.")
      return
    }
    startTransition(async () => {
      const r = await guardarResultado(p.id, {
        goles_a: totalA,
        goles_b: totalB,
        goles_chukkers: porChukker ? chukkers.map((c) => ({ a: num(c.a), b: num(c.b) })) : null,
        goleadores: Object.entries(goles)
          .filter(([, n]) => n > 0)
          .map(([jugador_id, cantidad]) => ({ jugador_id, cantidad })),
      })
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success("Resultado guardado.")
      onCerrar()
      router.refresh()
    })
  }

  const borrar = () =>
    startTransition(async () => {
      const r = await borrarResultado(p.id)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success("Se borró el resultado.")
      onCerrar()
      router.refresh()
    })

  const columnaGoleadores = (equipoId: string | null, total: number, nombre: string) => {
    const lista = jugadoresDe(equipoId)
    const suma = asignados(equipoId)
    return (
      <div className="space-y-1.5">
        <p className="flex items-baseline justify-between text-sm font-medium">
          {nombre}
          <span className={cn("text-xs font-normal", suma > total ? "text-destructive" : "text-muted-foreground")}>
            {suma} de {total}
          </span>
        </p>
        <ul className="divide-y rounded-lg border">
          {lista.map((x) => {
            const n = goles[x.jugador.id] ?? 0
            const poner = (v: number) => setGoles((g) => ({ ...g, [x.jugador.id]: Math.max(0, Math.min(99, v)) }))
            return (
              <li key={x.id} className="flex items-center gap-1 py-1 pr-1 pl-2.5">
                <span className="min-w-0 flex-1 truncate text-sm">
                  {x.jugador.apellido}, {x.jugador.nombre}
                </span>
                <Button variant="ghost" size="icon-sm" onClick={() => poner(n - 1)} disabled={n === 0} aria-label="Restar gol">
                  <MinusIcon />
                </Button>
                <span className={cn("w-5 text-center text-sm tabular-nums", n > 0 ? "font-semibold" : "text-muted-foreground")}>{n}</span>
                <Button variant="ghost" size="icon-sm" onClick={() => poner(n + 1)} aria-label="Sumar gol">
                  <PlusIcon />
                </Button>
              </li>
            )
          })}
          {lista.length === 0 && <li className="px-3 py-2 text-xs text-muted-foreground">El equipo no tiene jugadores.</li>}
        </ul>
      </div>
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-heading text-2xl">Resultado · {ctx.nombres.get(p.id)}</DialogTitle>
        <DialogDescription>Los goles por chukker y los goleadores son opcionales.</DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          {[
            { e: equipoA, v: golesA, set: setGolesA, total: totalA },
            null,
            { e: equipoB, v: golesB, set: setGolesB, total: totalB },
          ].map((x, i) =>
            x === null ? (
              <span key="vs" className="font-heading text-lg text-muted-foreground">
                vs
              </span>
            ) : (
              <div key={i} className="space-y-1.5 text-center">
                <p className="flex items-center justify-center gap-1.5 text-sm font-medium">
                  <Camiseta color={x.e?.color ?? null} className="size-5" />
                  <span className="truncate">{x.e?.nombre}</span>
                </p>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={99}
                  value={porChukker ? String(x.total) : x.v}
                  disabled={porChukker}
                  onChange={(ev) => x.set(ev.target.value)}
                  className="mx-auto h-14 w-20 text-center font-heading text-3xl font-semibold tabular-nums"
                  aria-label={`Goles de ${x.e?.nombre}`}
                />
              </div>
            ),
          )}
        </div>

        <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
          Cargar goles por chukker ({p.chukkers})
          <Switch checked={porChukker} onCheckedChange={setPorChukker} />
        </label>
        {porChukker && (
          <div className="grid grid-cols-[auto_1fr_1fr] items-center gap-x-3 gap-y-1.5 text-sm">
            <span />
            <span className="truncate text-center text-xs text-muted-foreground">{equipoA?.nombre}</span>
            <span className="truncate text-center text-xs text-muted-foreground">{equipoB?.nombre}</span>
            {chukkers.map((c, i) => (
              <div key={i} className="contents">
                <span className="text-xs text-muted-foreground">Chukker {i + 1}</span>
                {(["a", "b"] as const).map((l) => (
                  <Input
                    key={l}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={99}
                    value={c[l]}
                    placeholder="0"
                    onChange={(ev) => setChukkers((cs) => cs.map((x, j) => (j === i ? { ...x, [l]: ev.target.value } : x)))}
                    className="h-9 text-center tabular-nums"
                    aria-label={`Goles de ${l === "a" ? equipoA?.nombre : equipoB?.nombre} en el chukker ${i + 1}`}
                  />
                ))}
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2 border-t pt-3">
          <p className="text-sm font-medium">Goleadores</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {columnaGoleadores(p.equipo_a_id, totalA, equipoA?.nombre ?? "Equipo 1")}
            {columnaGoleadores(p.equipo_b_id, totalB, equipoB?.nombre ?? "Equipo 2")}
          </div>
        </div>
      </div>

      <DialogFooter className="gap-2 sm:justify-between">
        {p.estado === "jugado" ? (
          <Button variant="link" className="px-0 text-muted-foreground" onClick={borrar} disabled={pendiente}>
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
            Guardar resultado
          </Button>
        </div>
      </DialogFooter>
    </>
  )
}
