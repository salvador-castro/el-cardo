"use client"

import {
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
  useTable,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table"
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  PencilIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  XIcon,
} from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatearHandicap } from "@/lib/formato"
import {
  ETIQUETA_TIPO_JUGADOR,
  HANDICAPS,
  TIPOS_JUGADOR,
  type EstadoApto,
  type TipoJugador,
} from "@/lib/jugadores/constantes"
import { cn } from "@/lib/utils"
import { AvatarJugador, InsigniaApto, InsigniaDocumentos, InsigniaInactivo, InsigniaProfesor, InsigniaTipo } from "./insignias"

export type FilaJugador = {
  id: string
  nombre: string
  apellido: string
  dni: string | null
  tipo: TipoJugador
  activo: boolean
  handicap: number
  telefono: string | null
  club_origen: string | null
  es_profesor: boolean
  foto_url: string | null
  deuda: number
  cobros_adeudados: number
  apto_estado: EstadoApto
  alerta_documentos: string | null
}

const POR_PAGINA = 8

// ---------------------------------------------------------------------------
// Filtros (se guardan en la URL para no perderlos al volver de una ficha)
// ---------------------------------------------------------------------------

type Filtros = {
  q: string
  tipo: TipoJugador | "todos"
  estado: "activos" | "inactivos" | "todos"
  hcpMin: string
  hcpMax: string
  profesores: boolean
  deuda: boolean
  apto: "todos" | "vencido" | "por_vencer" | "sin_apto" | "no_vigente"
}

const FILTROS_BASE: Filtros = {
  q: "",
  tipo: "todos",
  estado: "activos",
  hcpMin: "",
  hcpMax: "",
  profesores: false,
  deuda: false,
  apto: "todos",
}

const OPCIONES_APTO: { valor: Filtros["apto"]; etiqueta: string }[] = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "no_vigente", etiqueta: "Vencido o sin apto" },
  { valor: "vencido", etiqueta: "Vencido" },
  { valor: "por_vencer", etiqueta: "Por vencer" },
  { valor: "sin_apto", etiqueta: "Sin apto" },
]

function leerFiltros(params: URLSearchParams): Filtros {
  const tipo = params.get("tipo")
  const estado = params.get("estado")
  const apto = params.get("apto")
  return {
    q: params.get("q") ?? "",
    tipo: TIPOS_JUGADOR.includes(tipo as TipoJugador) ? (tipo as TipoJugador) : "todos",
    estado: estado === "inactivos" || estado === "todos" ? estado : "activos",
    hcpMin: params.get("hcpMin") ?? "",
    hcpMax: params.get("hcpMax") ?? "",
    profesores: params.get("profesores") === "1",
    deuda: params.get("deuda") === "1",
    apto: OPCIONES_APTO.some((o) => o.valor === apto) ? (apto as Filtros["apto"]) : "todos",
  }
}

function escribirFiltros(f: Filtros) {
  const params = new URLSearchParams()
  if (f.q) params.set("q", f.q)
  if (f.tipo !== "todos") params.set("tipo", f.tipo)
  if (f.estado !== "activos") params.set("estado", f.estado)
  if (f.hcpMin) params.set("hcpMin", f.hcpMin)
  if (f.hcpMax) params.set("hcpMax", f.hcpMax)
  if (f.profesores) params.set("profesores", "1")
  if (f.deuda) params.set("deuda", "1")
  if (f.apto !== "todos") params.set("apto", f.apto)
  const qs = params.toString()
  // History API nativa: actualiza la URL sin volver a pedir la página al servidor.
  window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname)
}

const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()

function filtrar(jugadores: FilaJugador[], f: Filtros) {
  const terminos = normalizar(f.q).split(/\s+/).filter(Boolean)
  const min = f.hcpMin === "" ? null : Number(f.hcpMin)
  const max = f.hcpMax === "" ? null : Number(f.hcpMax)

  return jugadores.filter((j) => {
    if (f.estado === "activos" && !j.activo) return false
    if (f.estado === "inactivos" && j.activo) return false
    if (f.tipo !== "todos" && j.tipo !== f.tipo) return false
    if (min !== null && j.handicap < min) return false
    if (max !== null && j.handicap > max) return false
    if (f.profesores && !j.es_profesor) return false
    if (f.deuda && j.deuda <= 0) return false
    if (f.apto === "no_vigente" && j.apto_estado !== "vencido" && j.apto_estado !== "sin_apto") return false
    if (f.apto !== "todos" && f.apto !== "no_vigente" && j.apto_estado !== f.apto) return false
    if (terminos.length) {
      const texto = normalizar(`${j.nombre} ${j.apellido} ${j.dni ?? ""} ${j.club_origen ?? ""}`)
      if (!terminos.every((t) => texto.includes(t))) return false
    }
    return true
  })
}

function contarFiltrosActivos(f: Filtros) {
  return [
    f.tipo !== "todos",
    f.estado !== "activos",
    f.hcpMin !== "" || f.hcpMax !== "",
    f.profesores,
    f.deuda,
    f.apto !== "todos",
  ].filter(Boolean).length
}

// ---------------------------------------------------------------------------
// Tabla (TanStack v9: ordenamiento y paginación; el filtrado es propio)
// ---------------------------------------------------------------------------

const ORDEN_APTO: Record<EstadoApto, number> = { vencido: 0, sin_apto: 1, por_vencer: 2, vigente: 3 }

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { text: sortFn_text, basic: sortFn_basic },
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
})

const col = createColumnHelper<typeof features, FilaJugador>()

const columnas = col.columns([
  col.accessor((j) => `${j.apellido} ${j.nombre}`, { id: "jugador", header: "Jugador", sortFn: "text" }),
  col.accessor("tipo", { header: "Tipo", sortFn: "text" }),
  col.accessor("handicap", { header: "Hándicap", sortFn: "basic" }),
  col.accessor((j) => ORDEN_APTO[j.apto_estado], { id: "apto", header: "Apto", sortFn: "basic" }),
  col.display({ id: "acciones", header: "Acciones" }),
])

const ORDEN_INICIAL: SortingState = [{ id: "jugador", desc: false }]

export function ListadoJugadores({ jugadores }: { jugadores: FilaJugador[] }) {
  const searchParams = useSearchParams()
  const [filtros, setFiltros] = useState<Filtros>(() => leerFiltros(new URLSearchParams(searchParams.toString())))
  const [sorting, setSorting] = useState<SortingState>(ORDEN_INICIAL)
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: POR_PAGINA })
  const activos = contarFiltrosActivos(filtros)
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(activos > 0)

  const actualizar = (cambios: Partial<Filtros>) => {
    const nuevo = { ...filtros, ...cambios }
    setFiltros(nuevo)
    setPagination((p) => ({ ...p, pageIndex: 0 }))
    escribirFiltros(nuevo)
  }

  const filtrados = useMemo(() => filtrar(jugadores, filtros), [jugadores, filtros])

  const table = useTable({
    features,
    columns: columnas,
    data: filtrados,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getRowId: (j) => j.id,
  })

  const filas = table.getRowModel().rows
  const total = filtrados.length
  const desde = total === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1
  const hasta = Math.min(total, (pagination.pageIndex + 1) * pagination.pageSize)
  const paginas = table.getPageCount()

  return (
    <div className="space-y-4">
      {/* Búsqueda + botón de filtros */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Nombre, DNI o club"
            value={filtros.q}
            onChange={(e) => actualizar({ q: e.target.value })}
            className="h-10 bg-card pl-9"
            aria-label="Buscar jugadores"
          />
        </div>
        <Button
          variant="outline"
          className={cn("h-10 bg-card", filtrosAbiertos && "border-dorado/60")}
          onClick={() => setFiltrosAbiertos((v) => !v)}
          aria-expanded={filtrosAbiertos}
          aria-controls="panel-filtros"
        >
          <SlidersHorizontalIcon />
          <span className="hidden sm:inline">Filtros</span>
          {activos > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full bg-marino text-[0.7rem] text-crema">
              {activos}
            </span>
          )}
          <ChevronDownIcon className={cn("transition-transform", filtrosAbiertos && "rotate-180")} />
        </Button>
      </div>

      {/* Panel de filtros colapsable */}
      {filtrosAbiertos && (
        <div
          id="panel-filtros"
          className="grid grid-cols-2 gap-4 rounded-xl border bg-card p-4 sm:grid-cols-3 lg:flex lg:flex-wrap lg:items-end"
        >
          <ControlesFiltro filtros={filtros} actualizar={actualizar} />
          <div className="col-span-full flex justify-end lg:ml-auto">
            <Button
              variant="ghost"
              disabled={activos === 0}
              onClick={() => actualizar({ ...FILTROS_BASE, q: filtros.q })}
            >
              <XIcon /> Limpiar filtros
            </Button>
          </div>
        </div>
      )}

      {total === 0 ? (
        <div className="rounded-xl border border-dashed bg-card px-6 py-14 text-center text-sm text-muted-foreground">
          No hay jugadores que coincidan con la búsqueda.
        </div>
      ) : (
        <>
          {/* Celular: tarjetas */}
          <ul className="space-y-2 md:hidden">
            {filas.map((fila) => (
              <TarjetaJugador key={fila.id} j={fila.original} />
            ))}
          </ul>

          {/* Tablet y desktop: tabla */}
          <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((grupo) => (
                  <TableRow key={grupo.id} className="bg-muted/40 hover:bg-muted/40">
                    {grupo.headers.map((header) => {
                      const sorted = header.column.getIsSorted()
                      const puedeOrdenar = header.column.getCanSort() && header.column.id !== "acciones"
                      const centrado = header.column.id === "handicap" || header.column.id === "acciones"
                      return (
                        <TableHead
                          key={header.id}
                          className={cn(
                            "h-11 px-4 text-xs tracking-wide text-muted-foreground uppercase",
                            centrado && "text-center",
                            header.column.id === "jugador" && "w-[38%]",
                            header.column.id === "acciones" && "w-28",
                          )}
                          aria-sort={sorted ? (sorted === "asc" ? "ascending" : "descending") : undefined}
                        >
                          {puedeOrdenar ? (
                            <button
                              type="button"
                              onClick={header.column.getToggleSortingHandler()}
                              className="inline-flex items-center gap-1 tracking-wide uppercase hover:text-foreground"
                            >
                              <table.FlexRender header={header} />
                              {sorted === "asc" ? (
                                <ArrowUpIcon className="size-3.5" />
                              ) : sorted === "desc" ? (
                                <ArrowDownIcon className="size-3.5" />
                              ) : (
                                <ArrowUpDownIcon className="size-3.5 opacity-40" />
                              )}
                            </button>
                          ) : (
                            <table.FlexRender header={header} />
                          )}
                        </TableHead>
                      )
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {filas.map((fila) => (
                  <FilaTabla key={fila.id} j={fila.original} />
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Paginación */}
          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-sm text-muted-foreground">
              Mostrando <b className="text-foreground tabular-nums">{desde}–{hasta}</b> de{" "}
              <b className="text-foreground tabular-nums">{total}</b> {total === 1 ? "jugador" : "jugadores"}
            </p>
            {paginas > 1 && (
              <nav className="flex items-center gap-1" aria-label="Paginación">
                <Button
                  variant="outline"
                  size="icon-lg"
                  className="bg-card"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  aria-label="Página anterior"
                >
                  <ChevronLeftIcon />
                </Button>
                {Array.from({ length: paginas }, (_, i) => (
                  <Button
                    key={i}
                    variant={i === pagination.pageIndex ? "default" : "ghost"}
                    size="icon-lg"
                    onClick={() => table.setPageIndex(i)}
                    aria-current={i === pagination.pageIndex ? "page" : undefined}
                    className="tabular-nums"
                  >
                    {i + 1}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="icon-lg"
                  className="bg-card"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
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

function Acciones({ j, className }: { j: FilaJugador; className?: string }) {
  const nombre = `${j.nombre} ${j.apellido}`
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-lg" asChild className="text-marino hover:bg-dorado/15">
            <Link href={`/jugadores/${j.id}`} aria-label={`Ver ficha de ${nombre}`}>
              <EyeIcon />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Ver ficha</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-lg" asChild className="text-marino hover:bg-dorado/15">
            <Link href={`/jugadores/${j.id}/editar`} aria-label={`Editar a ${nombre}`}>
              <PencilIcon />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Editar</TooltipContent>
      </Tooltip>
    </div>
  )
}

function FilaTabla({ j }: { j: FilaJugador }) {
  return (
    <TableRow className={cn(!j.activo && "opacity-60")}>
      <TableCell className="px-4 py-3">
        <div className="flex items-center gap-3">
          <AvatarJugador jugador={j} fotoUrl={j.foto_url} />
          <div className="min-w-0">
            <p className="truncate font-medium">
              {j.apellido}, {j.nombre}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {[j.dni && `DNI ${j.dni}`, j.club_origen].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell className="px-4">
        <div className="flex flex-wrap gap-1">
          <InsigniaTipo tipo={j.tipo} />
          {j.es_profesor && <InsigniaProfesor />}
          {!j.activo && <InsigniaInactivo />}
        </div>
      </TableCell>
      <TableCell className="px-4 text-center font-heading text-xl font-semibold tabular-nums">
        {formatearHandicap(j.handicap)}
      </TableCell>
      <TableCell className="px-4">
        <div className="flex flex-wrap items-center gap-1">
          <InsigniaApto estado={j.apto_estado} compacta />
          {j.alerta_documentos && j.apto_estado === "vigente" && <InsigniaDocumentos alerta={j.alerta_documentos} />}
        </div>
      </TableCell>
      <TableCell className="px-4">
        <Acciones j={j} className="justify-center" />
      </TableCell>
    </TableRow>
  )
}

function TarjetaJugador({ j }: { j: FilaJugador }) {
  return (
    <li className={cn("flex items-center gap-3 rounded-xl border bg-card p-3", !j.activo && "opacity-60")}>
      <AvatarJugador jugador={j} fotoUrl={j.foto_url} className="size-12" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {j.apellido}, {j.nombre}
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          <InsigniaTipo tipo={j.tipo} />
          {j.es_profesor && <InsigniaProfesor />}
          {!j.activo && <InsigniaInactivo />}
          <InsigniaApto estado={j.apto_estado} compacta />
        </div>
      </div>
      <div className="w-10 text-center">
        <p className="font-heading text-2xl leading-none font-semibold tabular-nums">{formatearHandicap(j.handicap)}</p>
        <p className="mt-1 text-[0.6rem] tracking-wide text-muted-foreground uppercase">hcp</p>
      </div>
      <Acciones j={j} className="flex-col gap-0" />
    </li>
  )
}

function ControlesFiltro({
  filtros,
  actualizar,
}: {
  filtros: Filtros
  actualizar: (c: Partial<Filtros>) => void
}) {
  return (
    <>
      <div className="grid gap-1.5">
        <Label className="text-xs text-muted-foreground">Tipo</Label>
        <Select value={filtros.tipo} onValueChange={(v) => actualizar({ tipo: v as Filtros["tipo"] })}>
          <SelectTrigger className="w-full lg:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {TIPOS_JUGADOR.map((t) => (
              <SelectItem key={t} value={t}>
                {ETIQUETA_TIPO_JUGADOR[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label className="text-xs text-muted-foreground">Estado</Label>
        <Select value={filtros.estado} onValueChange={(v) => actualizar({ estado: v as Filtros["estado"] })}>
          <SelectTrigger className="w-full lg:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="activos">Activos</SelectItem>
            <SelectItem value="inactivos">Inactivos</SelectItem>
            <SelectItem value="todos">Todos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label className="text-xs text-muted-foreground">Apto médico</Label>
        <Select value={filtros.apto} onValueChange={(v) => actualizar({ apto: v as Filtros["apto"] })}>
          <SelectTrigger className="w-full lg:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPCIONES_APTO.map((o) => (
              <SelectItem key={o.valor} value={o.valor}>
                {o.etiqueta}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label className="text-xs text-muted-foreground">Hándicap</Label>
        <div className="flex items-center gap-2">
          <SelectorHandicap valor={filtros.hcpMin} placeholder="Desde" onChange={(v) => actualizar({ hcpMin: v })} />
          <span className="text-muted-foreground">a</span>
          <SelectorHandicap valor={filtros.hcpMax} placeholder="Hasta" onChange={(v) => actualizar({ hcpMax: v })} />
        </div>
      </div>

      <label className="flex items-center justify-between gap-3 self-end rounded-lg border px-3 py-2 text-sm lg:h-8 lg:border-0 lg:px-0 lg:py-0">
        Solo profesores
        <Switch checked={filtros.profesores} onCheckedChange={(v) => actualizar({ profesores: v })} />
      </label>
      <label className="flex items-center justify-between gap-3 self-end rounded-lg border px-3 py-2 text-sm lg:h-8 lg:border-0 lg:px-0 lg:py-0">
        Con deuda
        <Switch checked={filtros.deuda} onCheckedChange={(v) => actualizar({ deuda: v })} />
      </label>
    </>
  )
}

function SelectorHandicap({
  valor,
  placeholder,
  onChange,
}: {
  valor: string
  placeholder: string
  onChange: (v: string) => void
}) {
  return (
    <Select value={valor === "" ? "cualquiera" : valor} onValueChange={(v) => onChange(v === "cualquiera" ? "" : v)}>
      <SelectTrigger className="w-full lg:w-24" aria-label={`Hándicap ${placeholder.toLowerCase()}`}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="cualquiera">{placeholder}</SelectItem>
        {HANDICAPS.map((h) => (
          <SelectItem key={h} value={String(h)}>
            {formatearHandicap(h)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
