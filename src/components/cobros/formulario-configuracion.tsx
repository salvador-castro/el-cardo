"use client"

import { Loader2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition, type ReactNode } from "react"
import { toast } from "sonner"

import { guardarConfiguracion, type DatosConfiguracion } from "@/app/(app)/cobros/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function FormularioConfiguracion({ inicial }: { inicial: DatosConfiguracion }) {
  const router = useRouter()
  const [pendiente, startTransition] = useTransition()
  const [d, setD] = useState<Record<keyof DatosConfiguracion, string>>(
    () => Object.fromEntries(Object.entries(inicial).map(([k, v]) => [k, String(v)])) as Record<keyof DatosConfiguracion, string>,
  )
  const cambiado = (Object.keys(inicial) as (keyof DatosConfiguracion)[]).some((k) => Number(d[k]) !== inicial[k])
  const cambioCuota = Number(d.cuota_social_monto) !== inicial.cuota_social_monto

  const guardar = () =>
    startTransition(async () => {
      const datos = Object.fromEntries(Object.entries(d).map(([k, v]) => [k, Number(v)])) as DatosConfiguracion
      const r = await guardarConfiguracion(datos)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(cambioCuota ? "Guardado. La cuota nueva rige desde el mes que viene." : "Configuración guardada.")
      router.refresh()
    })

  const campo = (k: keyof DatosConfiguracion, etiqueta: string, opciones: { pesos?: boolean; ayuda?: ReactNode; sufijo?: string } = {}) => (
    <Field>
      <FieldLabel htmlFor={`cfg-${k}`}>{etiqueta}</FieldLabel>
      <div className="relative">
        {opciones.pesos && <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">$</span>}
        <Input
          id={`cfg-${k}`}
          type="number"
          inputMode="numeric"
          min={0}
          step={opciones.pesos ? 500 : 1}
          value={d[k]}
          onChange={(e) => setD((x) => ({ ...x, [k]: e.target.value }))}
          className={opciones.pesos ? "pl-7 tabular-nums" : "tabular-nums"}
        />
        {opciones.sufijo && (
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">{opciones.sufijo}</span>
        )}
      </div>
      {opciones.ayuda && <FieldDescription>{opciones.ayuda}</FieldDescription>}
    </Field>
  )

  return (
    <form
      className="space-y-5 pb-20 lg:pb-0"
      onSubmit={(e) => {
        e.preventDefault()
        guardar()
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-2xl font-semibold">Cuota social</CardTitle>
          <CardDescription>Se genera una por mes para cada socio activo.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {campo("cuota_social_monto", "Monto mensual", {
            pesos: true,
            ayuda: cambioCuota ? "El cambio rige desde el mes que viene; las cuotas ya generadas no cambian." : "Si lo cambiás, rige desde el mes siguiente.",
          })}
          {campo("cuota_social_dia_vencimiento", "Día de vencimiento", { ayuda: "Del 1 al 28 de cada mes." })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-2xl font-semibold">Precios sugeridos</CardTitle>
          <CardDescription>Se precompletan al crear una actividad; después se pueden cambiar.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          {campo("precio_practica", "Práctica", { pesos: true })}
          {campo("precio_clase", "Clase", { pesos: true })}
          {campo("precio_torneo", "Torneo", { pesos: true })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-2xl font-semibold">Plazos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {campo("dias_vencimiento_actividad", "Vencimiento de un cobro por actividad", {
            sufijo: "días",
            ayuda: "Desde la fecha de la actividad.",
          })}
          {campo("dias_validez_link", "Validez de un link de pago", { sufijo: "días", ayuda: "Después hay que generar uno nuevo." })}
        </CardContent>
      </Card>

      <div className="fixed inset-x-0 bottom-16 z-20 border-t bg-background/95 px-4 py-3 backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <div className="mx-auto flex max-w-[1600px] justify-end">
          <Button type="submit" size="lg" disabled={pendiente || !cambiado} className="min-w-40">
            {pendiente && <Loader2Icon className="animate-spin" />}
            Guardar cambios
          </Button>
        </div>
      </div>
    </form>
  )
}
