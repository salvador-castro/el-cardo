"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2Icon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTransition, type ComponentProps, type ReactNode } from "react"
import { Controller, useForm, type FieldPath } from "react-hook-form"
import { toast } from "sonner"

import { actualizarJugador, crearJugador } from "@/app/(app)/jugadores/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { formatearHandicap } from "@/lib/formato"
import {
  ETIQUETA_MANO,
  ETIQUETA_TIPO_JUGADOR,
  GRUPOS_SANGUINEOS,
  HANDICAPS,
  MANOS,
  TIPOS_JUGADOR,
} from "@/lib/jugadores/constantes"
import { esquemaJugador, valoresIniciales, type DatosJugador } from "@/lib/jugadores/esquema"
import { cn } from "@/lib/utils"

type Props = {
  // Sin id: alta. Con id: edición.
  id?: string
  inicial?: DatosJugador
}

const SIN_DATO = "__sin_dato__"

export function FormularioJugador({ id, inicial }: Props) {
  const router = useRouter()
  const [pendiente, startTransition] = useTransition()
  const esEdicion = Boolean(id)

  const form = useForm<DatosJugador>({
    resolver: zodResolver(esquemaJugador),
    defaultValues: inicial ?? valoresIniciales(),
    mode: "onTouched",
  })
  const errores = form.formState.errors

  const onSubmit = form.handleSubmit(
    (datos) => {
      startTransition(async () => {
        const r = id ? await actualizarJugador(id, datos) : await crearJugador(datos)
        if (!r.ok) {
          toast.error(r.error)
          return
        }
        toast.success(esEdicion ? "Cambios guardados." : "Jugador dado de alta.")
        router.push(`/jugadores/${r.datos.id}`)
        router.refresh()
      })
    },
    () => toast.error("Revisá los campos marcados."),
  )

  // Campo de texto con label y error.
  const Texto = ({
    name,
    label,
    descripcion,
    className,
    ...props
  }: {
    name: FieldPath<DatosJugador>
    label: string
    descripcion?: ReactNode
    className?: string
  } & Omit<ComponentProps<typeof Input>, "name">) => {
    const error = errores[name]
    return (
      <Field data-invalid={!!error} className={className}>
        <FieldLabel htmlFor={`j-${name}`}>{label}</FieldLabel>
        <Input id={`j-${name}`} aria-invalid={!!error} {...props} {...form.register(name)} />
        {descripcion && <FieldDescription>{descripcion}</FieldDescription>}
        <FieldError errors={[error]} />
      </Field>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5 pb-20 lg:pb-0">
      <Seccion titulo="Datos personales">
        <div className="grid gap-4 sm:grid-cols-2">
          {Texto({ name: "nombre", label: "Nombre", autoComplete: "off" })}
          {Texto({ name: "apellido", label: "Apellido", autoComplete: "off" })}
          {Texto({ name: "dni", label: "DNI", inputMode: "numeric", placeholder: "Opcional", descripcion: "Sin puntos." })}
          {Texto({ name: "fecha_nacimiento", label: "Fecha de nacimiento", type: "date" })}
          {Texto({ name: "telefono", label: "Teléfono", type: "tel", inputMode: "tel", placeholder: "+54 9 3489 ...", descripcion: "Con código de área: se usa para WhatsApp." })}
          {Texto({ name: "email", label: "Email", type: "email", inputMode: "email" })}
          {Texto({ name: "direccion", label: "Dirección", className: "sm:col-span-2" })}
        </div>
      </Seccion>

      <Seccion titulo="Club">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={!!errores.tipo}>
            <FieldLabel htmlFor="j-tipo">Tipo</FieldLabel>
            <Controller
              control={form.control}
              name="tipo"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="j-tipo" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_JUGADOR.map((t) => (
                      <SelectItem key={t} value={t}>
                        {ETIQUETA_TIPO_JUGADOR[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldDescription>A los socios activos se les genera la cuota social.</FieldDescription>
          </Field>
          {Texto({ name: "fecha_alta", label: "Fecha de alta", type: "date" })}
          {Texto({ name: "club_origen", label: "Club de origen", placeholder: "Opcional" })}
          <div className="grid gap-3 self-end">
            <Interruptor
              control={form.control}
              name="es_profesor"
              titulo="Es profesor"
              detalle="Puede dar clases."
            />
            {esEdicion && (
              <Interruptor control={form.control} name="activo" titulo="Activo" detalle="Los inactivos no aparecen al anotar." />
            )}
          </div>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="j-notas">Notas</FieldLabel>
            <Textarea id="j-notas" rows={3} {...form.register("notas")} />
          </Field>
        </div>
      </Seccion>

      <Seccion titulo="Polo">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={!!errores.handicap}>
            <FieldLabel htmlFor="j-handicap">Hándicap</FieldLabel>
            <Controller
              control={form.control}
              name="handicap"
              render={({ field }) => (
                <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                  <SelectTrigger id="j-handicap" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HANDICAPS.map((h) => (
                      <SelectItem key={h} value={String(h)}>
                        {formatearHandicap(h)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {esEdicion && <FieldDescription>Cada cambio queda en el historial.</FieldDescription>}
            <FieldError errors={[errores.handicap]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="j-mano">Mano</FieldLabel>
            <Controller
              control={form.control}
              name="mano"
              render={({ field }) => (
                <Select value={field.value || SIN_DATO} onValueChange={(v) => field.onChange(v === SIN_DATO ? "" : v)}>
                  <SelectTrigger id="j-mano" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SIN_DATO}>Sin dato</SelectItem>
                    {MANOS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {ETIQUETA_MANO[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </div>
      </Seccion>

      <Seccion titulo="Emergencia" descripcion="Para tener a mano ante un accidente.">
        <div className="grid gap-4 sm:grid-cols-3">
          {Texto({ name: "emergencia_nombre", label: "Contacto" })}
          {Texto({ name: "emergencia_vinculo", label: "Vínculo", placeholder: "Madre, pareja…" })}
          {Texto({ name: "emergencia_telefono", label: "Teléfono", type: "tel", inputMode: "tel" })}
          <Field>
            <FieldLabel htmlFor="j-grupo">Grupo sanguíneo</FieldLabel>
            <Controller
              control={form.control}
              name="grupo_sanguineo"
              render={({ field }) => (
                <Select value={field.value || SIN_DATO} onValueChange={(v) => field.onChange(v === SIN_DATO ? "" : v)}>
                  <SelectTrigger id="j-grupo" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SIN_DATO}>Sin dato</SelectItem>
                    {GRUPOS_SANGUINEOS.map((g) => (
                      <SelectItem key={g} value={g}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          {Texto({ name: "obra_social", label: "Obra social" })}
          {Texto({ name: "numero_afiliado", label: "N.º de afiliado" })}
        </div>
      </Seccion>

      {/* Barra de acciones: fija abajo en el celular, sobre la navegación inferior. */}
      <div className="fixed inset-x-0 bottom-16 z-20 border-t bg-background/95 px-4 py-3 backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <div className="mx-auto flex max-w-[1600px] justify-end gap-2">
          <Button variant="outline" size="lg" asChild className="bg-card">
            <Link href={id ? `/jugadores/${id}` : "/jugadores"}>Cancelar</Link>
          </Button>
          <Button type="submit" size="lg" disabled={pendiente} className="min-w-32">
            {pendiente && <Loader2Icon className="animate-spin" />}
            {esEdicion ? "Guardar cambios" : "Dar de alta"}
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

function Interruptor({
  control,
  name,
  titulo,
  detalle,
}: {
  control: ReturnType<typeof useForm<DatosJugador>>["control"]
  name: "es_profesor" | "activo"
  titulo: string
  detalle: string
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <label
          className={cn(
            "flex cursor-pointer items-center justify-between gap-4 rounded-lg border px-3 py-2.5",
            field.value && "border-dorado/50 bg-dorado/5",
          )}
        >
          <span>
            <span className="block text-sm font-medium">{titulo}</span>
            <span className="block text-xs text-muted-foreground">{detalle}</span>
          </span>
          <Switch checked={field.value} onCheckedChange={field.onChange} />
        </label>
      )}
    />
  )
}
