"use client"

import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  MessageCircleIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  WalletIcon,
  XIcon,
} from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useMemo, useState, type ReactNode } from "react"

import { registrarEnvio } from "@/app/(app)/cobros/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatearFecha, formatearMonto, normalizarBusqueda } from "@/lib/formato"
import { mensajeRecordatorio } from "@/lib/mensajes"
import { cn } from "@/lib/utils"
import { enlaceWhatsapp } from "@/lib/whatsapp"
import {
  ETIQUETA_CONCEPTO,
  ETIQUETA_ESTADO_COBRO,
  ETIQUETA_MEDIO_PAGO,
  InsigniaEstadoCobro,
  saldoCobro,
  type ConceptoCobro,
  type EstadoCobro,
  type MedioPago,
} from "./insignias-cobro"
import { ModalCobrar } from "./modal-cobrar"

export type FilaCobro = {
  id: string
  jugador: { id: string; nombre: string; apellido: string; telefono: string | null }
  concepto: ConceptoCobro
  descripcion: string
  monto: number
  monto_pagado: number
  vencimiento: string
  estado: EstadoCobro
  medio_pago: MedioPago | null
  pagado_at: string | null
}

const POR_PAGINA = 10
const CONCEPTOS: ConceptoCobro[] = ["cuota_social", "practica", "clase", "torneo", "otro"]
const ESTADOS: EstadoCobro[] = ["pendiente", "vencido", "pagado", "bonificado", "anulado"]
const MEDIOS: MedioPago[] = ["efectivo", "transferencia", "mercadopago"]

type Filtros = {
  q: string
  estado: EstadoCobro | "impagos" | "todos"
  concepto: ConceptoCobro | "todos"
  mes: string // YYYY-MM del vencimiento
  medio: MedioPago | "todos"
}

const BASE: Filtros = { q: "", estado: "impagos", concepto: "todos", mes: "", medio: "todos" }

function leer(p: URLSearchParams): Filtros {
  const estado = p.get("estado")
  const concepto = p.get("concepto")
  const medio = p.get("medio")
  const mes = p.get("mes")
  return {
    q: p.get("q") ?? "",
    estado: estado === "todos" || ESTADOS.includes(estado as EstadoCobro) ? (estado as Filtros["estado"]) : "impagos",
    concepto: CONCEPTOS.includes(concepto as ConceptoCobro) ? (concepto as ConceptoCobro) : "todos",
    mes: mes && /^\d{4}-\d{2}$/.test(mes) ? mes : "",
    medio: MEDIOS.includes(medio as MedioPago) ? (medio as MedioPago) : "todos",
  }
}

function escribir(f: Filtros) {
  const p = new URLSearchParams()
  if (f.q) p.set("q", f.q)
  if (f.estado !== "impagos") p.set("estado", f.estado)
  if (f.concepto !== "todos") p.set("concepto", f.concepto)
  if (f.mes) p.set("mes", f.mes)
  if (f.medio !== "todos") p.set("medio", f.medio)
  const qs = p.toString()
  window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname)
}

const esImpago = (c: { estado: EstadoCobro }) => c.estado === "pendiente" || c.estado === "vencido"

export function ListadoCobros({ cobros, saldos }: { cobros: FilaCobro[]; saldos: Record<string, number> }) {
  const searchParams = useSearchParams()
  const [filtros, setFiltros] = useState<Filtros>(() => leer(new URLSearchParams(searchParams.toString())))
  const [pagina, setPagina] = useState(0)
  const activos = [filtros.estado !== "impagos", filtros.concepto !== "todos", !!filtros.mes, filtros.medio !== "todos"].filter(Boolean).length
  const [abiertos, setAbiertos] = useState(activos > 0)

  const actualizar = (c: Partial<Filtros>) => {
    const n = { ...filtros, ...c }
    setFiltros(n)
    setPagina(0)
    escribir(n)
  }

  const filtrados = useMemo(() => {
    const terminos = normalizarBusqueda(filtros.q).split(/\s+/).filter(Boolean)
    return cobros
      .filter((c) => {
        if (filtros.estado === "impagos" && !esImpago(c)) return false
        if (filtros.estado !== "impagos" && filtros.estado !== "todos" && c.estado !== filtros.estado) return false
        if (filtros.concepto !== "todos" && c.concepto !== filtros.concepto) return false
        if (filtros.mes && !c.vencimiento.startsWith(filtros.mes)) return false
        if (filtros.medio !== "todos" && c.medio_pago !== filtros.medio) return false
        if (terminos.length) {
          const texto = normalizarBusqueda(`${c.jugador.nombre} ${c.jugador.apellido} ${c.descripcion}`)
          if (!terminos.every((t) => texto.includes(t))) return false
        }
        return true
      })
      .sort((a, b) => (esImpago(a) && esImpago(b) ? a.vencimiento.localeCompare(b.vencimiento) : b.vencimiento.localeCompare(a.vencimiento)))
  }, [cobros, filtros])

  // Impagos de cada jugador, para el modal "Cobrar".
  const impagosPorJugador = useMemo(() => {
    const m = new Map<string, FilaCobro[]>()
    for (const c of cobros.filter(esImpago)) m.set(c.jugador.id, [...(m.get(c.jugador.id) ?? []), c])
    return m
  }, [cobros])

  const total = filtrados.length
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA))
  const filas = filtrados.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA)
  const adeudado = filtrados.filter(esImpago).reduce((t, c) => t + saldoCobro(c), 0)

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Jugador o concepto"
            value={filtros.q}
            onChange={(e) => actualizar({ q: e.target.value })}
            className="h-10 bg-card pl-9"
            aria-label="Buscar cobros"
          />
        </div>
        <Button
          variant="outline"
          className={cn("h-10 bg-card", abiertos && "border-dorado/60")}
          onClick={() => setAbiertos((v) => !v)}
          aria-expanded={abiertos}
        >
          <SlidersHorizontalIcon />
          <span className="hidden sm:inline">Filtros</span>
          {activos > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full bg-marino text-[0.7rem] text-crema">{activos}</span>
          )}
          <ChevronDownIcon className={cn("transition-transform", abiertos && "rotate-180")} />
        </Button>
      </div>

      {abiertos && (
        <div className="grid grid-cols-2 gap-4 rounded-xl border bg-card p-4 sm:grid-cols-4 lg:flex lg:flex-wrap lg:items-end">
          <Filtro etiqueta="Estado">
            <Select value={filtros.estado} onValueChange={(v) => actualizar({ estado: v as Filtros["estado"] })}>
              <SelectTrigger className="w-full lg:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="impagos">Impagos</SelectItem>
                <SelectItem value="todos">Todos</SelectItem>
                {ESTADOS.map((e) => (
                  <SelectItem key={e} value={e}>
                    {ETIQUETA_ESTADO_COBRO[e]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Filtro>
          <Filtro etiqueta="Concepto">
            <Select value={filtros.concepto} onValueChange={(v) => actualizar({ concepto: v as Filtros["concepto"] })}>
              <SelectTrigger className="w-full lg:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {CONCEPTOS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {ETIQUETA_CONCEPTO[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Filtro>
          <Filtro etiqueta="Mes de vencimiento">
            <Input type="month" value={filtros.mes} onChange={(e) => actualizar({ mes: e.target.value })} className="lg:w-44" />
          </Filtro>
          <Filtro etiqueta="Medio de pago">
            <Select value={filtros.medio} onValueChange={(v) => actualizar({ medio: v as Filtros["medio"] })}>
              <SelectTrigger className="w-full lg:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {MEDIOS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {ETIQUETA_MEDIO_PAGO[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Filtro>
          <div className="col-span-full flex justify-end lg:ml-auto">
            <Button variant="ghost" disabled={activos === 0} onClick={() => actualizar({ ...BASE, q: filtros.q })}>
              <XIcon /> Limpiar filtros
            </Button>
          </div>
        </div>
      )}

      {total === 0 ? (
        <div className="rounded-xl border border-dashed bg-card px-6 py-14 text-center text-sm text-muted-foreground">
          No hay cobros que coincidan con la búsqueda.
        </div>
      ) : (
        <>
          {/* Celular */}
          <ul className="space-y-2 md:hidden">
            {filas.map((c) => (
              <li key={c.id} className={cn("rounded-xl border bg-card p-3", c.estado === "anulado" && "opacity-60")}>
                <div className="flex items-start gap-3">
                  <Link href={`/cobros/${c.id}`} className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {c.jugador.apellido}, {c.jugador.nombre}
                    </p>
                    <p className="truncate text-sm">{c.descripcion}</p>
                    <p className="text-xs text-muted-foreground">Vence {formatearFecha(c.vencimiento)}</p>
                  </Link>
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-medium tabular-nums">{formatearMonto(esImpago(c) ? saldoCobro(c) : c.monto)}</span>
                    <InsigniaEstadoCobro estado={c.estado} parcial={c.monto_pagado > 0} />
                  </div>
                </div>
                <Acciones c={c} impagos={impagosPorJugador.get(c.jugador.id) ?? []} saldo={saldos[c.jugador.id] ?? 0} className="mt-2 border-t pt-2" />
              </li>
            ))}
          </ul>

          {/* Desktop */}
          <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  {["Jugador", "Concepto", "Vence", "Monto", "Estado", "Acciones"].map((h) => (
                    <TableHead
                      key={h}
                      className={cn("h-11 px-4 text-xs tracking-wide text-muted-foreground uppercase", (h === "Monto" || h === "Acciones") && "text-right")}
                    >
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.map((c) => (
                  <TableRow key={c.id} className={cn(c.estado === "anulado" && "opacity-60")}>
                    <TableCell className="px-4 py-3">
                      <Link href={`/jugadores/${c.jugador.id}?tab=cuenta`} className="font-medium hover:underline">
                        {c.jugador.apellido}, {c.jugador.nombre}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-72 px-4">
                      <Link href={`/cobros/${c.id}`} className="block truncate hover:underline">
                        {c.descripcion}
                      </Link>
                      <p className="text-xs text-muted-foreground">{ETIQUETA_CONCEPTO[c.concepto]}</p>
                    </TableCell>
                    <TableCell className={cn("px-4 tabular-nums", c.estado === "vencido" && "text-destructive")}>
                      {formatearFecha(c.vencimiento)}
                    </TableCell>
                    <TableCell className="px-4 text-right tabular-nums">
                      <span className="font-medium">{formatearMonto(esImpago(c) ? saldoCobro(c) : c.monto)}</span>
                      {esImpago(c) && c.monto_pagado > 0 && (
                        <p className="text-xs text-muted-foreground">de {formatearMonto(c.monto)}</p>
                      )}
                    </TableCell>
                    <TableCell className="px-4">
                      <InsigniaEstadoCobro estado={c.estado} parcial={c.monto_pagado > 0} />
                    </TableCell>
                    <TableCell className="px-4">
                      <Acciones c={c} impagos={impagosPorJugador.get(c.jugador.id) ?? []} saldo={saldos[c.jugador.id] ?? 0} className="justify-end" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-sm text-muted-foreground">
              <b className="text-foreground tabular-nums">{total}</b> {total === 1 ? "cobro" : "cobros"}
              {adeudado > 0 && (
                <>
                  {" "}
                  · adeudado <b className="text-destructive tabular-nums">{formatearMonto(adeudado)}</b>
                </>
              )}
            </p>
            {paginas > 1 && (
              <nav className="flex items-center gap-2" aria-label="Paginación">
                <Button variant="outline" size="icon-lg" className="bg-card" onClick={() => setPagina((p) => p - 1)} disabled={pagina === 0} aria-label="Página anterior">
                  <ChevronLeftIcon />
                </Button>
                <span className="text-sm tabular-nums">
                  {pagina + 1} de {paginas}
                </span>
                <Button
                  variant="outline"
                  size="icon-lg"
                  className="bg-card"
                  onClick={() => setPagina((p) => p + 1)}
                  disabled={pagina >= paginas - 1}
                  aria-label="Página siguiente"
                >
                  <ChevronRightIcon />
                </Button>
              </nav>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function Filtro({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs text-muted-foreground">{etiqueta}</Label>
      {children}
    </div>
  )
}

function Acciones({
  c,
  impagos,
  saldo,
  className,
}: {
  c: FilaCobro
  impagos: FilaCobro[]
  saldo: number
  className?: string
}) {
  const wa = esImpago(c)
    ? enlaceWhatsapp(
        c.jugador.telefono,
        mensajeRecordatorio(c.jugador.nombre, [{ descripcion: c.descripcion, monto: saldoCobro(c), vencimiento: c.vencimiento }]),
      )
    : null

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {esImpago(c) && (
        <ModalCobrar
          jugador={{ id: c.jugador.id, nombre: `${c.jugador.nombre} ${c.jugador.apellido}` }}
          cobros={impagos}
          saldoAFavor={saldo}
          preseleccion={[c.id]}
          trigger={
            <Button variant="outline" size="sm" className="bg-card">
              <WalletIcon /> Cobrar
            </Button>
          }
        />
      )}
      {wa && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-lg" asChild className="text-marino hover:bg-dorado/15">
              <a href={wa} target="_blank" rel="noreferrer" aria-label="Recordar por WhatsApp" onClick={() => void registrarEnvio([c.id], "whatsapp", "recordatorio")}>
                <MessageCircleIcon />
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Recordar por WhatsApp</TooltipContent>
        </Tooltip>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-lg" asChild className="text-marino hover:bg-dorado/15">
            <Link href={`/cobros/${c.id}`} aria-label="Ver detalle">
              <EyeIcon />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Ver detalle</TooltipContent>
      </Tooltip>
    </div>
  )
}
