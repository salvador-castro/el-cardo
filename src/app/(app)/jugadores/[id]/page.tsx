import { ChevronLeftIcon, PencilIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { AccionEstadoJugador } from "@/components/jugadores/ficha/accion-estado"
import { EnviarMensaje } from "@/components/jugadores/ficha/enviar-mensaje"
import { FotoJugador } from "@/components/jugadores/ficha/foto-jugador"
import { PestanasFicha } from "@/components/jugadores/ficha/pestanas"
import { TabActividades } from "@/components/jugadores/ficha/tab-actividades"
import { TabCuentaCorriente } from "@/components/jugadores/ficha/tab-cuenta-corriente"
import { TabDatos } from "@/components/jugadores/ficha/tab-datos"
import { TabDocumentos } from "@/components/jugadores/ficha/tab-documentos"
import { InsigniaApto, InsigniaDocumentos, InsigniaInactivo, InsigniaProfesor, InsigniaTipo } from "@/components/jugadores/insignias"
import { Button } from "@/components/ui/button"
import { requerirUsuario } from "@/lib/auth"
import { formatearHandicap, formatearMonto } from "@/lib/formato"
import type { EstadoApto } from "@/lib/jugadores/constantes"
import { createClient } from "@/lib/supabase/server"
import { urlsFirmadas } from "@/lib/supabase/urls-firmadas"

const UUID = /^[0-9a-f-]{36}$/i

export async function generateMetadata({ params }: PageProps<"/jugadores/[id]">): Promise<Metadata> {
  const { id } = await params
  if (!UUID.test(id)) return { title: "Jugador" }
  const supabase = await createClient()
  const { data } = await supabase.from("jugadores").select("nombre, apellido").eq("id", id).maybeSingle()
  return { title: data ? `${data.nombre} ${data.apellido}` : "Jugador" }
}

export default async function FichaJugadorPage({ params, searchParams }: PageProps<"/jugadores/[id]">) {
  await requerirUsuario()
  const { id } = await params
  const { tab } = await searchParams
  if (!UUID.test(id)) notFound()

  const supabase = await createClient()
  const [jugadorRes, historialRes, documentosRes, participacionesRes, clasesRes, cobrosRes] = await Promise.all([
    supabase.from("jugadores_resumen").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("handicap_historial")
      .select("id, handicap_anterior, handicap_nuevo, created_at")
      .eq("jugador_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("jugador_documentos")
      .select("id, tipo, descripcion, vencimiento, archivo_path, archivo_nombre, created_at")
      .eq("jugador_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("participaciones")
      .select("id, asistencia, bonificado, equipo:equipos(nombre), actividad:actividades!inner(id, tipo, nombre, inicio, estado)")
      .eq("jugador_id", id),
    supabase
      .from("actividades_resumen")
      .select("id, tipo, nombre, inicio, estado, participantes, presentes")
      .eq("profesor_id", id)
      .order("inicio", { ascending: false }),
    supabase
      .from("cobros")
      .select("id, concepto, descripcion, periodo, monto, vencimiento, estado, medio_pago, pagado_at, nota")
      .eq("jugador_id", id)
      .order("vencimiento", { ascending: false }),
  ])

  const error =
    jugadorRes.error ?? historialRes.error ?? documentosRes.error ?? participacionesRes.error ?? clasesRes.error ?? cobrosRes.error
  if (error) throw new Error(error.message)
  const j = jugadorRes.data
  if (!j || !j.id) notFound()
  const historial = historialRes.data ?? []
  const documentos = documentosRes.data ?? []
  const clases = clasesRes.data ?? []
  const cobros = cobrosRes.data ?? []
  // Impagos, del más viejo al más nuevo (para recordatorios).
  const pendientes = cobros
    .filter((c) => c.estado === "pendiente" || c.estado === "vencido")
    .sort((a, b) => a.vencimiento.localeCompare(b.vencimiento))
    .map((c) => ({ id: c.id, descripcion: c.descripcion, monto: Number(c.monto), vencimiento: c.vencimiento }))
  const contacto = { nombre: j.nombre ?? "", telefono: j.telefono, email: j.email, pendientes }

  const [fotos, archivos] = await Promise.all([
    urlsFirmadas(supabase, "fotos", [j.foto_path]),
    urlsFirmadas(
      supabase,
      "documentos",
      documentos.map((d) => d.archivo_path),
    ),
  ])
  const fotoUrl = j.foto_path ? (fotos[j.foto_path] ?? null) : null
  const aptoEstado = (j.apto_estado ?? "sin_apto") as EstadoApto
  const deuda = Number(j.deuda ?? 0)

  const participaciones = [...(participacionesRes.data ?? [])].sort((a, b) => b.actividad.inicio.localeCompare(a.actividad.inicio))

  return (
    <>
      <Link
        href="/jugadores"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeftIcon className="size-4" /> Jugadores
      </Link>

      {/* Encabezado de la ficha */}
      <div className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-4 sm:flex-nowrap sm:gap-5 sm:p-5">
        <FotoJugador jugadorId={j.id} jugador={{ nombre: j.nombre, apellido: j.apellido }} fotoUrl={fotoUrl} />
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-2xl leading-tight font-semibold sm:text-4xl">
            {j.nombre} {j.apellido}
          </h1>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {j.tipo && <InsigniaTipo tipo={j.tipo} />}
            {j.es_profesor && <InsigniaProfesor />}
            {!j.activo && <InsigniaInactivo />}
            <InsigniaApto estado={aptoEstado} />
            {aptoEstado === "vigente" && <InsigniaDocumentos alerta={j.alerta_documentos} />}
          </div>
          {deuda > 0 && (
            <p className="mt-2 text-sm font-medium text-destructive">
              Debe {formatearMonto(deuda)} ({j.cobros_adeudados} {j.cobros_adeudados === 1 ? "cobro" : "cobros"})
            </p>
          )}
        </div>
        <div className="flex w-full items-center gap-6 border-t pt-4 sm:w-auto sm:flex-col sm:items-end sm:gap-3 sm:border-0 sm:pt-0">
          <div className="text-center sm:text-right">
            <p className="font-heading text-5xl leading-none font-semibold tabular-nums">{formatearHandicap(j.handicap)}</p>
            <p className="mt-1 text-[0.65rem] tracking-[0.2em] text-muted-foreground uppercase">Hándicap</p>
          </div>
          <div className="ml-auto flex flex-wrap gap-2 sm:ml-0 sm:justify-end">
            <EnviarMensaje {...contacto} />
            <Button variant="outline" size="lg" asChild>
              <Link href={`/jugadores/${j.id}/editar`}>
                <PencilIcon /> Editar
              </Link>
            </Button>
            <AccionEstadoJugador id={j.id} activo={j.activo ?? true} nombre={`${j.nombre} ${j.apellido}`} />
          </div>
        </div>
      </div>

      <PestanasFicha
        inicial={typeof tab === "string" ? tab : undefined}
        contadores={{
          actividades: participaciones.length + clases.length,
          cobros: j.cobros_adeudados ?? 0,
          documentos: documentos.length,
        }}
        datos={<TabDatos jugador={j} historial={historial} />}
        actividades={<TabActividades participaciones={participaciones} clases={clases} esProfesor={j.es_profesor ?? false} />}
        cuenta={<TabCuentaCorriente cobros={cobros} contacto={contacto} />}
        documentos={
          <TabDocumentos
            jugadorId={j.id}
            documentos={documentos.map((d) => ({
              ...d,
              url: d.archivo_path ? (archivos[d.archivo_path] ?? null) : null,
            }))}
          />
        }
      />
    </>
  )
}
