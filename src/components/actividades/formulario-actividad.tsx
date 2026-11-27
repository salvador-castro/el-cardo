"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { InfoIcon, Loader2Icon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTransition, type ReactNode } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { actualizarActividad, crearActividad } from "@/app/(app)/actividades/actions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ETIQUETA_TIPO_ACTIVIDAD, TIPOS_ACTIVIDAD_GESTION, type TipoActividadGestion } from "@/lib/actividades/constantes"
import { esquemaActividad, nombreSugerido, type DatosActividad } from "@/lib/actividades/esquema"
import { formatearHandicap, formatearMonto } from "@/lib/formato"
import { cn } from "@/lib/utils"
import { ICONO_TIPO_ACTIVIDAD } from "./insignias"

type Profesor = { id: string; nombre: string; apellido: string; handicap: number }

type Props = {
  // Sin id: alta. Con id: edición (el tipo queda fijo).
  id?: string
  inicial: DatosActividad
  precios: Record<TipoActividadGestion, number>
  profesores: Profesor[]
  // En edición: cobros impagos que se actualizan si cambia el precio.
  cobrosImpagos?: number
}

const DESCRIPCION_TIPO: Record<TipoActividadGestion, string> = {
  practica: "Partidos entre jugadores del club, con equipos.",
  clase: "Un profesor y sus alumnos.",
}

export function FormularioActividad({ id, inicial, precios, profesores, cobrosImpagos = 0 }: Props) {
  const router = useRouter()
  const [pendiente, startTransition] = useTransition()
  const esEdicion = Boolean(id)

  const form = useForm<DatosActividad>({
    resolver: zodResolver(esquemaActividad),
    defaultValues: inicial,
    mode: "onTouched",
  })
  const errores = form.formState.errors
  const [tipo, precio] = useWatch({ control: form.control, name: ["tipo", "precio"] })
  const cambioPrecio = esEdicion && Number(precio) !== inicial.precio

  // En el alta, el nombre y el precio se sugieren solos mientras el admin no los toque.
  const sugerirNombre = (t: TipoActividadGestion, fecha: string) => {
    if (esEdicion || form.getFieldState("nombre").isDirty) return
    form.setValue("nombre", nombreSugerido(t, fecha))
  }
  const elegirTipo = (t: TipoActividadGestion) => {
    form.setValue("tipo", t)
    if (!form.getFieldState("precio").isDirty) form.setValue("precio", precios[t])
    if (t !== "clase") form.setValue("profesor_id", "")
    sugerirNombre(t, form.getValues("fecha"))
  }

  const onSubmit = form.handleSubmit(
    (datos) => {
      startTransition(async () => {
        const r = id ? await actualizarActividad(id, datos) : await crearActividad(datos)
        if (!r.ok) {
          toast.error(r.error)
          return
        }
        toast.success(esEdicion ? "Cambios guardados." : "Actividad creada. Ya podés anotar jugadores.")
        router.push(`/actividades/${r.datos.id}`)
        router.refresh()
      })
    },
    () => toast.error("Revisá los campos marcados."),
  )

  const fechaRegistro = form.register("fecha")

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5 pb-20 lg:pb-0">
      <Seccion titulo="Tipo" descripcion={esEdicion ? "El tipo no se puede cambiar." : undefined}>
        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Tipo de actividad">
          {TIPOS_ACTIVIDAD_GESTION.map((t) => {
            const Icono = ICONO_TIPO_ACTIVIDAD[t]
            const elegido = tipo === t
            return (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={elegido}
                disabled={esEdicion && !elegido}
                onClick={() => !esEdicion && elegirTipo(t)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-4 text-left transition-colors",
                  elegido ? "border-dorado bg-dorado/10 ring-1 ring-dorado/40" : "hover:bg-muted/50",
                  esEdicion && !elegido && "hidden",
                  esEdicion && "cursor-default",
                )}
              >
                <span
                  className={cn(
                    "flex size-11 shrink-0 items-center justify-center rounded-lg",
                    elegido ? "bg-marino text-crema" : "bg-secondary text-marino",
                  )}
                >
                  <Icono className="size-5" />
                </span>
                <span>
                  <span className="block font-heading text-xl font-semibold">{ETIQUETA_TIPO_ACTIVIDAD[t]}</span>
                  <span className="block text-sm text-muted-foreground">{DESCRIPCION_TIPO[t]}</span>
                </span>
              </button>
            )
          })}
        </div>
      </Seccion>

      <Seccion titulo="Datos">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={!!errores.nombre} className="sm:col-span-2">
            <FieldLabel htmlFor="a-nombre">Nombre</FieldLabel>
            <Input id="a-nombre" autoComplete="off" aria-invalid={!!errores.nombre} {...form.register("nombre")} />
            <FieldError errors={[errores.nombre]} />
          </Field>
          <Field data-invalid={!!errores.fecha}>
            <FieldLabel htmlFor="a-fecha">Fecha</FieldLabel>
            <Input
              id="a-fecha"
              type="date"
              aria-invalid={!!errores.fecha}
              {...fechaRegistro}
              onChange={(e) => {
                void fechaRegistro.onChange(e)
                sugerirNombre(form.getValues("tipo"), e.target.value)
              }}
            />
            <FieldError errors={[errores.fecha]} />
          </Field>
          <Field data-invalid={!!errores.hora}>
            <FieldLabel htmlFor="a-hora">Hora</FieldLabel>
            <Input id="a-hora" type="time" step={300} aria-invalid={!!errores.hora} {...form.register("hora")} />
            <FieldError errors={[errores.hora]} />
          </Field>
          <Field data-invalid={!!errores.precio}>
            <FieldLabel htmlFor="a-precio">Precio base por jugador</FieldLabel>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <Input
                id="a-precio"
                type="number"
                inputMode="numeric"
                min={0}
                step={500}
                className="pl-7 tabular-nums"
                aria-invalid={!!errores.precio}
                {...form.register("precio", { valueAsNumber: true })}
              />
            </div>
            <FieldDescription>
              {esEdicion
                ? "Con 0 la actividad es sin cargo. Los jugadores con precio especial mantienen el suyo."
                : `Sugerido: ${formatearMonto(precios[tipo])}. Si algún jugador paga distinto, se lo cambiás al anotarlo o desde su menú en la actividad.`}
            </FieldDescription>
            <FieldError errors={[errores.precio]} />
          </Field>

          {tipo === "clase" && (
            <Field data-invalid={!!errores.profesor_id}>
              <FieldLabel htmlFor="a-profesor">Profesor</FieldLabel>
              <Controller
                control={form.control}
                name="profesor_id"
                render={({ field }) => (
                  <Select value={field.value || undefined} onValueChange={field.onChange}>
                    <SelectTrigger id="a-profesor" className="w-full" aria-invalid={!!errores.profesor_id}>
                      <SelectValue placeholder="Elegí el profesor" />
                    </SelectTrigger>
                    <SelectContent>
                      {profesores.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nombre} {p.apellido} ({formatearHandicap(p.handicap)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {profesores.length === 0 ? (
                <FieldDescription>
                  No hay profesores activos. Marcá a un jugador como profesor desde su ficha.
                </FieldDescription>
              ) : (
                <FieldDescription>Solo jugadores activos marcados como profesores.</FieldDescription>
              )}
              <FieldError errors={[errores.profesor_id]} />
            </Field>
          )}

          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="a-notas">Notas</FieldLabel>
            <Textarea id="a-notas" rows={3} placeholder="Opcional" {...form.register("notas")} />
          </Field>
        </div>

        {cambioPrecio && cobrosImpagos > 0 && (
          <Alert className="mt-4 border-alerta/40 bg-alerta-suave text-alerta">
            <InfoIcon />
            <AlertDescription className="text-alerta">
              {Number(precio) === 0
                ? `Al dejarla sin cargo se anulan los cobros impagos (salvo los de jugadores con precio especial).`
                : `Se actualiza el monto de ${cobrosImpagos} ${cobrosImpagos === 1 ? "cobro impago" : "cobros impagos"}. Los ya pagados y los precios especiales no cambian.`}
            </AlertDescription>
          </Alert>
        )}
      </Seccion>

      <div className="fixed inset-x-0 bottom-16 z-20 border-t bg-background/95 px-4 py-3 backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <div className="mx-auto flex max-w-[1600px] justify-end gap-2">
          <Button variant="outline" size="lg" asChild className="bg-card">
            <Link href={id ? `/actividades/${id}` : "/actividades"}>Cancelar</Link>
          </Button>
          <Button type="submit" size="lg" disabled={pendiente} className="min-w-32">
            {pendiente && <Loader2Icon className="animate-spin" />}
            {esEdicion ? "Guardar cambios" : "Crear actividad"}
          </Button>
        </div>
      </div>
    </form>
  )
}

function Seccion({ titulo, descripcion, children }: { titulo: string; descripcion?: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-2xl font-semibold">{titulo}</CardTitle>
        {descripcion && <CardDescription>{descripcion}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
