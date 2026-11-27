import type { Metadata } from "next"

import { EncabezadoPagina } from "@/components/app/encabezado-pagina"
import { GenerarCuotas, NuevoCobro } from "@/components/cobros/acciones-cobros"
import { ListadoCobros, type FilaCobro } from "@/components/cobros/listado-cobros"
import type { JugadorOpcion } from "@/lib/actividades/constantes"
import { requerirUsuario } from "@/lib/auth"
import { formatearMonto } from "@/lib/formato"
import type { EstadoApto } from "@/lib/jugadores/constantes"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Cobros" }

export default async function CobrosPage() {
  await requerirUsuario()
  const supabase = await createClient()

  const [cobrosRes, jugadoresRes] = await Promise.all([
    supabase
      .from("cobros")
      .select(
        "id, concepto, descripcion, monto, monto_pagado, vencimiento, estado, medio_pago, pagado_at, jugador:jugadores(id, nombre, apellido, telefono)",
      )
      .order("vencimiento", { ascending: false }),
    supabase.from("jugadores_resumen").select("id, nombre, apellido, handicap, tipo, club_origen, apto_estado, activo, saldo_a_favor"),
  ])
  const error = cobrosRes.error ?? jugadoresRes.error
  if (error) throw new Error(error.message)

  const cobros: FilaCobro[] = (cobrosRes.data ?? []).map((c) => ({
    ...c,
    monto: Number(c.monto),
    monto_pagado: Number(c.monto_pagado),
  }))
  const jugadores: JugadorOpcion[] = (jugadoresRes.data ?? []).map((j) => ({
    id: j.id!,
    nombre: j.nombre ?? "",
    apellido: j.apellido ?? "",
    handicap: j.handicap ?? 0,
    tipo: j.tipo!,
    club_origen: j.club_origen,
    apto_estado: (j.apto_estado ?? "sin_apto") as EstadoApto,
    activo: j.activo ?? true,
  }))
  const saldos = Object.fromEntries(
    (jugadoresRes.data ?? []).filter((j) => Number(j.saldo_a_favor ?? 0) > 0).map((j) => [j.id!, Number(j.saldo_a_favor)]),
  )

  const impagos = cobros.filter((c) => c.estado === "pendiente" || c.estado === "vencido")
  const adeudado = impagos.reduce((t, c) => t + (c.monto - c.monto_pagado), 0)
  const vencidos = impagos.filter((c) => c.estado === "vencido").length

  return (
    <>
      <EncabezadoPagina
        titulo="Cobros"
        descripcion={`${formatearMonto(adeudado)} adeudados · ${vencidos} ${vencidos === 1 ? "cobro vencido" : "cobros vencidos"}`}
        acciones={
          <>
            <GenerarCuotas />
            <NuevoCobro jugadores={jugadores} />
          </>
        }
      />
      <ListadoCobros cobros={cobros} saldos={saldos} />
    </>
  )
}
