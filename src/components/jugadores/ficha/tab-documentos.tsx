"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { FileTextIcon, Loader2Icon, PaperclipIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"

import { agregarDocumento, eliminarDocumento } from "@/app/(app)/jugadores/actions"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatearFecha } from "@/lib/formato"
import {
  DIAS_AVISO_VENCIMIENTO,
  ETIQUETA_TIPO_DOCUMENTO,
  TIPOS_DOCUMENTO,
  type TipoDocumento,
} from "@/lib/jugadores/constantes"
import { esquemaDocumento, hoyISO, type DatosDocumento } from "@/lib/jugadores/esquema"
import { reducirImagen, subirArchivo } from "@/lib/storage"
import { cn } from "@/lib/utils"

export type Documento = {
  id: string
  tipo: TipoDocumento
  descripcion: string | null
  vencimiento: string | null
  archivo_nombre: string | null
  url: string | null
  created_at: string
}

function estadoVencimiento(vencimiento: string | null) {
  if (!vencimiento) return null
  const hoy = hoyISO()
  if (vencimiento < hoy) return "vencido" as const
  const limite = new Date(`${hoy}T12:00:00`)
  limite.setDate(limite.getDate() + DIAS_AVISO_VENCIMIENTO)
  if (vencimiento < limite.toISOString().slice(0, 10)) return "por_vencer" as const
  return "vigente" as const
}

export function TabDocumentos({ jugadorId, documentos }: { jugadorId: string; documentos: Documento[] }) {
  // El más reciente de cada tipo es el que cuenta para los avisos.
  const vigentePorTipo = new Map<TipoDocumento, string>()
  for (const d of documentos) {
    const actual = vigentePorTipo.get(d.tipo)
    const doc = documentos.find((x) => x.id === actual)
    if (!actual || (d.vencimiento ?? "") > (doc?.vencimiento ?? "")) vigentePorTipo.set(d.tipo, d.id)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Avisamos cuando un documento vence en menos de {DIAS_AVISO_VENCIMIENTO} días.
        </p>
        <NuevoDocumento jugadorId={jugadorId} />
      </div>

      {documentos.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          No hay documentos cargados. Cargá el apto médico para que no figure como faltante.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {documentos.map((d) => {
            const esVigente = vigentePorTipo.get(d.tipo) === d.id
            const estado = estadoVencimiento(d.vencimiento)
            return (
              <Card key={d.id} className={cn("py-4", !esVigente && "opacity-60")}>
                <CardContent className="flex items-start gap-3 px-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-marino">
                    <FileTextIcon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="font-medium">{ETIQUETA_TIPO_DOCUMENTO[d.tipo]}</p>
                      {esVigente && estado === "vencido" && <Badge className="bg-peligro-suave text-destructive">Vencido</Badge>}
                      {esVigente && estado === "por_vencer" && <Badge className="bg-alerta-suave text-alerta">Por vencer</Badge>}
                      {!esVigente && <Badge variant="outline">Reemplazado</Badge>}
                    </div>
                    {d.descripcion && <p className="truncate text-sm text-muted-foreground">{d.descripcion}</p>}
                    <p className="text-xs text-muted-foreground">
                      {d.vencimiento ? `Vence ${formatearFecha(d.vencimiento)}` : "Sin vencimiento"} · Cargado{" "}
                      {formatearFecha(d.created_at)}
                    </p>
                    {d.url ? (
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-dorado-oscuro hover:underline"
                      >
                        <PaperclipIcon className="size-3.5" /> {d.archivo_nombre ?? "Ver archivo"}
                      </a>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground italic">Sin archivo adjunto</p>
                    )}
                  </div>
                  <EliminarDocumento id={d.id} />
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function NuevoDocumento({ jugadorId }: { jugadorId: string }) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [pendiente, startTransition] = useTransition()

  const vacio: DatosDocumento = { tipo: "apto_medico", descripcion: "", vencimiento: "", archivo_path: "", archivo_nombre: "" }
  const form = useForm<DatosDocumento>({ resolver: zodResolver(esquemaDocumento), defaultValues: vacio })
  const errores = form.formState.errors

  const abrir = (v: boolean) => {
    if (v) {
      form.reset(vacio)
      setArchivo(null)
    }
    setAbierto(v)
  }

  const onSubmit = form.handleSubmit((datos) => {
    startTransition(async () => {
      try {
        let archivo_path = ""
        let archivo_nombre = ""
        if (archivo) {
          const listo = archivo.type.startsWith("image/") ? await reducirImagen(archivo, 1800, 0.85) : archivo
          archivo_path = await subirArchivo("documentos", jugadorId, listo)
          archivo_nombre = archivo.name
        }
        const r = await agregarDocumento(jugadorId, { ...datos, archivo_path, archivo_nombre })
        if (!r.ok) {
          toast.error(r.error)
          return
        }
        toast.success("Documento cargado.")
        setAbierto(false)
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo cargar el documento.")
      }
    })
  })

  return (
    <Dialog open={abierto} onOpenChange={abrir}>
      <DialogTrigger asChild>
        <Button size="lg">
          <PlusIcon /> Cargar documento
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">Cargar documento</DialogTitle>
          <DialogDescription>Apto médico, seguro, deslinde u otro. El archivo es opcional (PDF o foto).</DialogDescription>
        </DialogHeader>
        <form id="nuevo-documento" onSubmit={onSubmit} noValidate>
          <FieldGroup className="gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Field data-invalid={!!errores.tipo}>
                <FieldLabel htmlFor="doc-tipo">Tipo</FieldLabel>
                <Controller
                  control={form.control}
                  name="tipo"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="doc-tipo" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPOS_DOCUMENTO.map((t) => (
                          <SelectItem key={t} value={t}>
                            {ETIQUETA_TIPO_DOCUMENTO[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field data-invalid={!!errores.vencimiento}>
                <FieldLabel htmlFor="doc-venc">Vencimiento</FieldLabel>
                <Input id="doc-venc" type="date" {...form.register("vencimiento")} />
                <FieldError errors={[errores.vencimiento]} />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="doc-desc">Descripción</FieldLabel>
              <Input id="doc-desc" placeholder="Opcional" {...form.register("descripcion")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="doc-archivo">Archivo</FieldLabel>
              <Input
                id="doc-archivo"
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              />
              <FieldDescription>PDF o imagen, hasta 10 MB.</FieldDescription>
            </Field>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button type="submit" form="nuevo-documento" size="lg" disabled={pendiente}>
            {pendiente && <Loader2Icon className="animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EliminarDocumento({ id }: { id: string }) {
  const router = useRouter()
  const [pendiente, startTransition] = useTransition()

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Eliminar documento" className="text-muted-foreground hover:text-destructive">
          <Trash2Icon />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar el documento?</AlertDialogTitle>
          <AlertDialogDescription>Se borra el registro y el archivo adjunto. No se puede deshacer.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            disabled={pendiente}
            onClick={() =>
              startTransition(async () => {
                const r = await eliminarDocumento(id)
                if (!r.ok) toast.error(r.error)
                else {
                  toast.success("Documento eliminado.")
                  router.refresh()
                }
              })
            }
          >
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
