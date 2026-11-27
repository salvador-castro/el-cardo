"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2Icon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { actualizarTorneo, crearTorneo } from "@/app/(app)/torneos/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { formatearMonto } from "@/lib/formato"
import { esquemaTorneo, type DatosTorneo } from "@/lib/torneos/esquema"

export function FormularioTorneo({
  id,
  inicial,
  precioSugerido,
}: {
  // Sin id: alta. Con id: edición.
  id?: string
  inicial: DatosTorneo
  precioSugerido: number
}) {
  const router = useRouter()
  const [pendiente, startTransition] = useTransition()
  const form = useForm<DatosTorneo>({ resolver: zodResolver(esquemaTorneo), defaultValues: inicial, mode: "onTouched" })
  const errores = form.formState.errors

  const onSubmit = form.handleSubmit(
    (datos) =>
      startTransition(async () => {
        const r = id ? await actualizarTorneo(id, datos) : await crearTorneo(datos)
        if (!r.ok) {
          toast.error(r.error)
          return
        }
        toast.success(id ? "Cambios guardados." : "Torneo creado. Ahora cargá las categorías y los equipos.")
        router.push(`/torneos/${r.datos.id}${id ? "" : "?tab=categorias"}`)
        router.refresh()
      }),
    () => toast.error("Revisá los campos marcados."),
  )

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5 pb-20 lg:pb-0">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-2xl font-semibold">Datos del torneo</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={!!errores.nombre} className="sm:col-span-2">
            <FieldLabel htmlFor="t-nombre">Nombre</FieldLabel>
            <Input id="t-nombre" autoComplete="off" placeholder="Copa Apertura" aria-invalid={!!errores.nombre} {...form.register("nombre")} />
            <FieldError errors={[errores.nombre]} />
          </Field>

          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <Field data-invalid={!!errores.fecha_inicio}>
              <FieldLabel htmlFor="t-fi">Empieza</FieldLabel>
              <Input id="t-fi" type="date" aria-invalid={!!errores.fecha_inicio} {...form.register("fecha_inicio")} />
              <FieldError errors={[errores.fecha_inicio]} />
            </Field>
            <Field data-invalid={!!errores.hora_inicio}>
              <FieldLabel htmlFor="t-hi">Hora</FieldLabel>
              <Input id="t-hi" type="time" step={300} {...form.register("hora_inicio")} />
            </Field>
          </div>
          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <Field data-invalid={!!errores.fecha_fin}>
              <FieldLabel htmlFor="t-ff">Termina</FieldLabel>
              <Input id="t-ff" type="date" aria-invalid={!!errores.fecha_fin} {...form.register("fecha_fin")} />
              <FieldError errors={[errores.fecha_fin]} />
            </Field>
            <Field data-invalid={!!errores.hora_fin}>
              <FieldLabel htmlFor="t-hf">Hora</FieldLabel>
              <Input id="t-hf" type="time" step={300} {...form.register("hora_fin")} />
            </Field>
          </div>

          <Field data-invalid={!!errores.precio}>
            <FieldLabel htmlFor="t-precio">Precio base por jugador</FieldLabel>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <Input
                id="t-precio"
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
              {id
                ? "Los jugadores con precio especial mantienen el suyo."
                : `Sugerido: ${formatearMonto(precioSugerido)}. A cada jugador anotado en un equipo se le genera el cobro.`}
            </FieldDescription>
            <FieldError errors={[errores.precio]} />
          </Field>

          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="t-notas">Notas</FieldLabel>
            <Textarea id="t-notas" rows={3} placeholder="Opcional" {...form.register("notas")} />
          </Field>
        </CardContent>
      </Card>

      <div className="fixed inset-x-0 bottom-16 z-20 border-t bg-background/95 px-4 py-3 backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <div className="mx-auto flex max-w-[1600px] justify-end gap-2">
          <Button variant="outline" size="lg" asChild className="bg-card">
            <Link href={id ? `/torneos/${id}` : "/torneos"}>Cancelar</Link>
          </Button>
          <Button type="submit" size="lg" disabled={pendiente} className="min-w-32">
            {pendiente && <Loader2Icon className="animate-spin" />}
            {id ? "Guardar cambios" : "Crear torneo"}
          </Button>
        </div>
      </div>
    </form>
  )
}
