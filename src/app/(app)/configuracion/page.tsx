import type { Metadata } from "next"

import { EncabezadoPagina } from "@/components/app/encabezado-pagina"
import { FormularioConfiguracion } from "@/components/cobros/formulario-configuracion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { requerirUsuario } from "@/lib/auth"
import { formatearMonto } from "@/lib/formato"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Configuración" }

const mesLargo = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" })

export default async function ConfiguracionPage() {
  await requerirUsuario()
  const supabase = await createClient()
  const [configRes, historialRes] = await Promise.all([
    supabase.from("configuracion").select("*").maybeSingle(),
    supabase.from("cuota_social_historial").select("id, monto, vigente_desde").order("vigente_desde", { ascending: false }).limit(12),
  ])
  if (configRes.error) throw new Error(configRes.error.message)
  const c = configRes.data
  if (!c) throw new Error("Falta la configuración inicial.")

  return (
    <>
      <EncabezadoPagina titulo="Configuración" descripcion="Cuota social, precios sugeridos y plazos de cobro." />
      <div className="grid gap-5 xl:grid-cols-[1fr_20rem]">
        <FormularioConfiguracion
          inicial={{
            cuota_social_monto: Number(c.cuota_social_monto),
            cuota_social_dia_vencimiento: c.cuota_social_dia_vencimiento,
            precio_practica: Number(c.precio_practica),
            precio_clase: Number(c.precio_clase),
            precio_torneo: Number(c.precio_torneo),
            dias_vencimiento_actividad: c.dias_vencimiento_actividad,
            dias_validez_link: c.dias_validez_link,
          }}
        />
        <Card className="self-start">
          <CardHeader>
            <CardTitle className="font-heading text-xl font-semibold">Historial de la cuota</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {(historialRes.data ?? []).map((h) => {
                const texto = mesLargo.format(new Date(`${h.vigente_desde}T12:00:00Z`))
                return (
                  <li key={h.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-muted-foreground">Desde {texto}</span>
                    <span className="font-medium tabular-nums">{formatearMonto(Number(h.monto))}</span>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
