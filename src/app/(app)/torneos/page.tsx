import { CalendarDaysIcon, PlusIcon, SwordsIcon, TrophyIcon, UsersIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { InsigniaEstadoActividad, ProgresoCobro } from "@/components/actividades/insignias"
import { EncabezadoPagina } from "@/components/app/encabezado-pagina"
import { Button } from "@/components/ui/button"
import { requerirUsuario } from "@/lib/auth"
import { formatearFecha } from "@/lib/formato"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Torneos" }

export default async function TorneosPage() {
  await requerirUsuario()
  const supabase = await createClient()

  const [torneosRes, categoriasRes, equiposRes, partidosRes] = await Promise.all([
    supabase
      .from("actividades_resumen")
      .select("id, nombre, inicio, fin, estado, monto_esperado, monto_cobrado")
      .eq("tipo", "torneo")
      .order("inicio", { ascending: false }),
    supabase.from("torneo_categorias").select("actividad_id, nombre, orden").order("orden"),
    supabase.from("equipos").select("actividad_id, actividad:actividades!inner(tipo)").eq("actividad.tipo", "torneo"),
    supabase.from("partidos").select("actividad_id, estado").not("categoria_id", "is", null),
  ])
  const error = torneosRes.error ?? categoriasRes.error ?? equiposRes.error ?? partidosRes.error
  if (error) throw new Error(error.message)

  const contar = <T extends { actividad_id: string }>(lista: T[], id: string, filtro: (x: T) => boolean = () => true) =>
    lista.filter((x) => x.actividad_id === id && filtro(x)).length

  const torneos = (torneosRes.data ?? []).map((t) => ({
    id: t.id!,
    nombre: t.nombre ?? "",
    inicio: t.inicio!,
    fin: t.fin,
    estado: t.estado ?? "programada",
    esperado: Number(t.monto_esperado ?? 0),
    cobrado: Number(t.monto_cobrado ?? 0),
    categorias: (categoriasRes.data ?? []).filter((c) => c.actividad_id === t.id).map((c) => c.nombre),
    equipos: contar(equiposRes.data ?? [], t.id!),
    partidos: contar(partidosRes.data ?? [], t.id!),
    jugados: contar(partidosRes.data ?? [], t.id!, (p) => p.estado === "jugado"),
  }))

  return (
    <>
      <EncabezadoPagina
        titulo="Torneos"
        descripcion="Categorías, zonas, fixture, resultados y posiciones."
        acciones={
          <Button asChild size="lg">
            <Link href="/torneos/nuevo">
              <PlusIcon /> Nuevo torneo
            </Link>
          </Button>
        }
      />

      {torneos.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card px-6 py-14 text-center text-sm text-muted-foreground">
          Todavía no hay torneos. Creá el primero con «Nuevo torneo».
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {torneos.map((t) => (
            <li key={t.id}>
              <Link
                href={`/torneos/${t.id}`}
                className={cn(
                  "flex h-full flex-col rounded-2xl border bg-card p-4 transition-shadow hover:shadow-md",
                  t.estado === "cancelada" && "opacity-60",
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-marino text-dorado">
                    <TrophyIcon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-heading text-xl leading-tight font-semibold">{t.nombre}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                      <CalendarDaysIcon className="size-3.5" />
                      {formatearFecha(t.inicio)}
                      {t.fin && ` al ${formatearFecha(t.fin)}`}
                    </p>
                  </div>
                  <InsigniaEstadoActividad estado={t.estado} />
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {t.categorias.length ? t.categorias.join(" · ") : "Sin categorías todavía"}
                </p>
                <div className="mt-auto flex items-end justify-between gap-3 border-t pt-3">
                  <div className="flex gap-4 text-sm">
                    <span className="flex items-center gap-1">
                      <UsersIcon className="size-4 text-dorado-oscuro" />
                      <b className="tabular-nums">{t.equipos}</b> equipos
                    </span>
                    <span className="flex items-center gap-1">
                      <SwordsIcon className="size-4 text-dorado-oscuro" />
                      <b className="tabular-nums">
                        {t.jugados}/{t.partidos}
                      </b>{" "}
                      jugados
                    </span>
                  </div>
                  <ProgresoCobro cobrado={t.cobrado} esperado={t.esperado} className="text-right" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
