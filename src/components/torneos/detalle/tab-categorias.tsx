"use client"

import { CheckIcon, Loader2Icon, PencilIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import {
  asignarZona,
  eliminarCategoria,
  eliminarZona,
  guardarCategoria,
  guardarZona,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { sumaHandicap, type CategoriaDetalle, type EquipoDetalle, type ParticipanteDetalle } from "@/lib/actividades/detalle"
import { formatearHandicap } from "@/lib/formato"
import { DESCRIPCION_FORMATO, ETIQUETA_FORMATO, FORMATOS } from "@/lib/torneos/constantes"
import type { DatosCategoria } from "@/lib/torneos/esquema"
import { cn } from "@/lib/utils"

const SIN_ZONA = "__sin_zona__"

type Resultado = { ok: true } | { ok: false; error: string }

function useAccion() {
  const router = useRouter()
  const [pendiente, startTransition] = useTransition()
  const ejecutar = (accion: () => Promise<Resultado>, exito?: string, despues?: () => void) =>
    startTransition(async () => {
      const r = await accion()
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      if (exito) toast.success(exito)
      despues?.()
      router.refresh()
    })
  return { pendiente, ejecutar }
}

export function TabCategorias({
  torneoId,
  categorias,
  equipos,
  participantes,
  editable,
}: {
  torneoId: string
  categorias: CategoriaDetalle[]
  equipos: EquipoDetalle[]
  participantes: ParticipanteDetalle[]
  editable: boolean
}) {
  const [editando, setEditando] = useState<{ id: string | null; datos: DatosCategoria } | null>(null)
  const hcpEquipo = (id: string) => sumaHandicap(participantes.filter((p) => p.equipo_id === id).map((p) => p.jugador))

  const nueva = () =>
    setEditando({
      id: null,
      datos: { nombre: "", tope_handicap: null, formato: "puntos", puntos_victoria: 3, puntos_empate: 1, puntos_derrota: 0 },
    })

  return (
    <div className="space-y-4">
      {editable && (
        <Button size="lg" onClick={nueva}>
          <PlusIcon /> Nueva categoría
        </Button>
      )}

      {categorias.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card px-6 py-14 text-center text-sm text-muted-foreground">
          Todavía no hay categorías. Creá la primera (por ejemplo, «Copa» con tope de 8 de hándicap).
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {categorias.map((c) => (
            <TarjetaCategoria
              key={c.id}
              categoria={c}
              equipos={equipos.filter((e) => e.categoria_id === c.id)}
              hcpEquipo={hcpEquipo}
              editable={editable}
              onEditar={() =>
                setEditando({
                  id: c.id,
                  datos: {
                    nombre: c.nombre,
                    tope_handicap: c.tope_handicap,
                    formato: c.formato,
                    puntos_victoria: c.puntos_victoria,
                    puntos_empate: c.puntos_empate,
                    puntos_derrota: c.puntos_derrota,
                  },
                })
              }
            />
          ))}
        </div>
      )}

      <Dialog open={editando !== null} onOpenChange={(v) => !v && setEditando(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
          {editando && (
            <FormCategoria
              key={editando.id ?? "nueva"}
              torneoId={torneoId}
              categoriaId={editando.id}
              inicial={editando.datos}
              onCerrar={() => setEditando(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TarjetaCategoria({
  categoria: c,
  equipos,
  hcpEquipo,
  editable,
  onEditar,
}: {
  categoria: CategoriaDetalle
  equipos: EquipoDetalle[]
  hcpEquipo: (id: string) => number
  editable: boolean
  onEditar: () => void
}) {
  const { pendiente, ejecutar } = useAccion()
  const [confirmar, setConfirmar] = useState(false)
  const [nuevaZona, setNuevaZona] = useState("")
  const conZonas = c.formato !== "eliminacion"

  const agregarZona = () => {
    const nombre = nuevaZona.trim() || `Zona ${String.fromCharCode(65 + c.zonas.length)}`
    ejecutar(() => guardarZona(c.id, null, nombre), `Se creó la ${nombre}.`, () => setNuevaZona(""))
  }

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex flex-row items-start gap-3 border-b py-3">
        <div className="min-w-0 flex-1">
          <CardTitle className="font-heading text-2xl font-semibold">{c.nombre}</CardTitle>
          <p className="text-xs text-muted-foreground">
            {ETIQUETA_FORMATO[c.formato]}
            {c.tope_handicap != null && ` · tope ${formatearHandicap(c.tope_handicap)}`}
            {c.formato !== "eliminacion" && ` · ${c.puntos_victoria}/${c.puntos_empate}/${c.puntos_derrota} pts`}
          </p>
        </div>
        {editable && (
          <>
            <Button variant="outline" onClick={onEditar}>
              <PencilIcon /> <span className="hidden sm:inline">Editar</span>
            </Button>
            <Button
              variant="ghost"
              size="icon-lg"
              onClick={() => setConfirmar(true)}
              aria-label={`Eliminar la categoría ${c.nombre}`}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2Icon />
            </Button>
          </>
        )}
      </CardHeader>

      <CardContent className="space-y-4 py-4">
        {conZonas && (
          <div className="space-y-2">
            <p className="text-sm font-medium">
              Zonas{" "}
              <span className="font-normal text-muted-foreground">
                {c.zonas.length === 0 ? "· sin zonas: todos juegan en un grupo único" : `(${c.zonas.length})`}
              </span>
            </p>
            <ul className="flex flex-wrap gap-2">
              {c.zonas.map((z) => (
                <ChipZona key={z.id} categoriaId={c.id} zona={z} editable={editable} />
              ))}
            </ul>
            {editable && (
              <div className="flex gap-2">
                <Input
                  value={nuevaZona}
                  onChange={(e) => setNuevaZona(e.target.value)}
                  placeholder={`Zona ${String.fromCharCode(65 + c.zonas.length)}`}
                  maxLength={40}
                  className="h-9 max-w-48"
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), agregarZona())}
                  aria-label="Nombre de la nueva zona"
                />
                <Button variant="outline" onClick={agregarZona} disabled={pendiente}>
                  <PlusIcon /> Agregar zona
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium">
            Equipos <span className="font-normal text-muted-foreground">({equipos.length})</span>
          </p>
          {equipos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Se arman en la pestaña Equipos.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {equipos.map((e) => {
                const hcp = hcpEquipo(e.id)
                const excede = c.tope_handicap != null && hcp > c.tope_handicap
                return (
                  <li key={e.id} className="flex items-center gap-2 px-3 py-2">
                    <Camiseta color={e.color} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{e.nombre}</span>
                    <span
                      className={cn("text-sm tabular-nums", excede ? "font-semibold text-alerta" : "text-muted-foreground")}
                      title={excede ? "Supera el tope de la categoría" : undefined}
                    >
                      hcp {formatearHandicap(hcp)}
                    </span>
                    {conZonas && c.zonas.length > 0 && (
                      <Select
                        value={e.zona_id ?? SIN_ZONA}
                        onValueChange={(v) => ejecutar(() => asignarZona(e.id, v === SIN_ZONA ? null : v))}
                        disabled={!editable || pendiente}
                      >
                        <SelectTrigger className="h-8 w-32" aria-label={`Zona de ${e.nombre}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={SIN_ZONA}>Sin zona</SelectItem>
                          {c.zonas.map((z) => (
                            <SelectItem key={z.id} value={z.id}>
                              {z.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </CardContent>

      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar la categoría {c.nombre}?</AlertDialogTitle>
            <AlertDialogDescription>
              Solo se puede si no tiene equipos ni partidos. Sus zonas se eliminan con ella.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={pendiente}
              onClick={() => ejecutar(() => eliminarCategoria(c.id), `Se eliminó ${c.nombre}.`, () => setConfirmar(false))}
            >
              {pendiente && <Loader2Icon className="animate-spin" />}
              Eliminar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

function ChipZona({
  categoriaId,
  zona,
  editable,
}: {
  categoriaId: string
  zona: { id: string; nombre: string }
  editable: boolean
}) {
  const { pendiente, ejecutar } = useAccion()
  const [editando, setEditando] = useState(false)
  const [nombre, setNombre] = useState(zona.nombre)

  if (editando) {
    return (
      <li className="flex items-center gap-1">
        <Input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          maxLength={40}
          className="h-8 w-32"
          autoFocus
          aria-label="Nombre de la zona"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              ejecutar(() => guardarZona(categoriaId, zona.id, nombre), undefined, () => setEditando(false))
            }
            if (e.key === "Escape") setEditando(false)
          }}
        />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Guardar"
          disabled={pendiente}
          onClick={() => ejecutar(() => guardarZona(categoriaId, zona.id, nombre), undefined, () => setEditando(false))}
        >
          <CheckIcon />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Cancelar" onClick={() => setEditando(false)}>
          <XIcon />
        </Button>
      </li>
    )
  }

  return (
    <li className="flex items-center gap-0.5 rounded-full border bg-card py-0.5 pr-0.5 pl-3 text-sm">
      {zona.nombre}
      {editable && (
        <>
          <Button variant="ghost" size="icon-xs" aria-label={`Renombrar ${zona.nombre}`} onClick={() => setEditando(true)}>
            <PencilIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Eliminar ${zona.nombre}`}
            disabled={pendiente}
            className="hover:text-destructive"
            onClick={() => ejecutar(() => eliminarZona(zona.id), `Se eliminó la ${zona.nombre}.`)}
          >
            <XIcon />
          </Button>
        </>
      )}
    </li>
  )
}

function FormCategoria({
  torneoId,
  categoriaId,
  inicial,
  onCerrar,
}: {
  torneoId: string
  categoriaId: string | null
  inicial: DatosCategoria
  onCerrar: () => void
}) {
  const { pendiente, ejecutar } = useAccion()
  const [d, setD] = useState(inicial)
  const [tope, setTope] = useState(inicial.tope_handicap?.toString() ?? "")
  const cambiar = (c: Partial<DatosCategoria>) => setD((x) => ({ ...x, ...c }))

  const guardar = () => {
    const topeNumero = tope.trim() === "" ? null : Number(tope)
    if (topeNumero !== null && !Number.isInteger(topeNumero)) {
      toast.error("El tope de hándicap es un número entero.")
      return
    }
    ejecutar(
      () => guardarCategoria(torneoId, categoriaId, { ...d, tope_handicap: topeNumero }),
      categoriaId ? "Categoría actualizada." : `Se creó la categoría ${d.nombre.trim()}.`,
      onCerrar,
    )
  }

  const puntos = (campo: "puntos_victoria" | "puntos_empate" | "puntos_derrota", etiqueta: string) => (
    <Field>
      <FieldLabel htmlFor={`cat-${campo}`}>{etiqueta}</FieldLabel>
      <Input
        id={`cat-${campo}`}
        type="number"
        inputMode="numeric"
        min={0}
        max={20}
        value={d[campo]}
        onChange={(e) => cambiar({ [campo]: Number(e.target.value) })}
        className="text-center tabular-nums"
      />
    </Field>
  )

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        guardar()
      }}
    >
      <DialogHeader>
        <DialogTitle className="font-heading text-2xl">{categoriaId ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
        <DialogDescription>El formato define cómo se arma el fixture y cómo se calcula la tabla.</DialogDescription>
      </DialogHeader>

      <div className="my-4 space-y-4">
        <div className="grid grid-cols-[1fr_8rem] gap-3">
          <Field>
            <FieldLabel htmlFor="cat-nombre">Nombre</FieldLabel>
            <Input
              id="cat-nombre"
              value={d.nombre}
              onChange={(e) => cambiar({ nombre: e.target.value })}
              placeholder="Copa, Desarrollo…"
              maxLength={60}
              autoFocus
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="cat-tope">Tope de hcp</FieldLabel>
            <Input
              id="cat-tope"
              type="number"
              inputMode="numeric"
              value={tope}
              onChange={(e) => setTope(e.target.value)}
              placeholder="Sin tope"
              className="tabular-nums"
            />
          </Field>
        </div>

        <div className="space-y-2" role="radiogroup" aria-label="Formato">
          <p className="text-sm font-medium">Formato</p>
          {FORMATOS.map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={d.formato === f}
              onClick={() => cambiar({ formato: f })}
              className={cn(
                "w-full rounded-lg border px-3 py-2 text-left transition-colors hover:bg-muted/50",
                d.formato === f && "border-dorado bg-dorado/10 ring-1 ring-dorado/40",
              )}
            >
              <span className="block text-sm font-medium">{ETIQUETA_FORMATO[f]}</span>
              <span className="block text-xs text-muted-foreground">{DESCRIPCION_FORMATO[f]}</span>
            </button>
          ))}
        </div>

        {d.formato !== "eliminacion" && (
          <div>
            <div className="grid grid-cols-3 gap-3">
              {puntos("puntos_victoria", "Ganado")}
              {puntos("puntos_empate", "Empatado")}
              {puntos("puntos_derrota", "Perdido")}
            </div>
            <FieldDescription className="mt-1.5">
              Puntos por partido. Desempate: diferencia de gol y después goles a favor.
            </FieldDescription>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" size="lg" onClick={onCerrar}>
          Cancelar
        </Button>
        <Button type="submit" size="lg" disabled={pendiente || !d.nombre.trim()} className="min-w-32">
          {pendiente && <Loader2Icon className="animate-spin" />}
          {categoriaId ? "Guardar" : "Crear categoría"}
        </Button>
      </DialogFooter>
    </form>
  )
}
