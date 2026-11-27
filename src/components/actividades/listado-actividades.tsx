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
  CalendarRangeIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  ListIcon,
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  ESTADOS_ACTIVIDAD,
  ETIQUETA_ESTADO_ACTIVIDAD,
  ETIQUETA_TIPO_ACTIVIDAD,
  TIPOS_ACTIVIDAD_GESTION,
  type EstadoActividad,
  type TipoActividadGestion,
} from "@/lib/actividades/constantes"
import type { FilaActividad } from "@/lib/actividades/filas"
import { esFechaISO, hoyAR, inicioDeSemana } from "@/lib/actividades/semana"
import { formatearFecha, formatearHora } from "@/lib/formato"
import { cn } from "@/lib/utils"
import { CalendarioSemanal } from "./calendario-semanal"
import { IconoTipoActividad, InsigniaEstadoActividad, InsigniaTipoActividad, ProgresoCobro } from "./insignias"

const POR_PAGINA = 8

// ---------------------------------------------------------------------------
// Filtros y vista (se guardan en la URL para no perderlos al volver del detalle)
// ---------------------------------------------------------------------------

type Filtros = {
  q: string
  tipo: TipoActividadGestion | "todos"
  estado: EstadoActividad | "todos"
  desde: string
  hasta: string
}

const FILTROS_BASE: Filtros = { q: "", tipo: "todos", estado: "todos", desde: "", hasta: "" }

type Vista = "lista" | "semana"

function leerParams(params: URLSearchParams): { filtros: Filtros; vista: Vista; semana: string } {
  const tipo = params.get("tipo")
  const estado = params.get("estado")
  const desde = params.get("desde")
  const hasta = params.get("hasta")
  const semana = params.get("semana")
  return {
    filtros: {
      q: params.get("q") ?? "",
      tipo: TIPOS_ACTIVIDAD_GESTION.includes(tipo as TipoActividadGestion) ? (tipo as TipoActividadGestion) : "todos",
      estado: ESTADOS_ACTIVIDAD.includes(estado as EstadoActividad) ? (estado as EstadoActividad) : "todos",
      desde: esFechaISO(desde) ? desde : "",
      hasta: esFechaISO(hasta) ? hasta : "",
    },
    vista: params.get("vista") === "semana" ? "semana" : "lista",
    semana: inicioDeSemana(esFechaISO(semana) ? semana : hoyAR()),
  }
}

function escribirParams(f: Filtros, vista: Vista, semana: string) {
  const params = new URLSearchParams()
  if (vista === "semana") {
    params.set("vista", "semana")
    if (semana !== inicioDeSemana(hoyAR())) params.set("semana", semana)
  }
  if (f.q) params.set("q", f.q)
  if (f.tipo !== "todos") params.set("tipo", f.tipo)
  if (f.estado !== "todos") params.set("estado", f.estado)
  if (vista === "lista") {
    if (f.desde) params.set("desde", f.desde)
    if (f.hasta) params.set("hasta", f.hasta)
  }
  const qs = params.toString()
  window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname)
}

const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()

function filtrar(actividades: FilaActividad[], f: Filtros, conFechas: boolean) {
  const terminos = normalizar(f.q).split(/\s+/).filter(Boolean)
  return actividades.filter((a) => {
    if (f.tipo !== "todos" && a.tipo !== f.tipo) return false
    if (f.estado !== "todos" && a.estado !== f.estado) return false
    if (conFechas && f.desde && a.fecha < f.desde) return false
    if (conFechas && f.hasta && a.fecha > f.hasta) return false
    if (terminos.length) {
      const texto = normalizar(`${a.nombre} ${a.profesor_nombre ?? ""}`)
      if (!terminos.every((t) => texto.includes(t))) return false
    }
    return true
  })
}

// ---------------------------------------------------------------------------
// Tabla
// ---------------------------------------------------------------------------

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { text: sortFn_text, basic: sortFn_basic },
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
})

const col = createColumnHelper<typeof features, FilaActividad>()

const columnas = col.columns([
  col.accessor("nombre", { header: "Actividad", sortFn: "text" }),
  col.accessor("inicio", { header: "Fecha", sortFn: "text" }),
  col.accessor("tipo", { header: "Tipo", sortFn: "text" }),
  col.accessor("estado", { header: "Estado", sortFn: "text" }),
  col.accessor("participantes", { header: "Anotados", sortFn: "basic" }),
  col.accessor("monto_cobrado", { header: "Cobrado", sortFn: "basic" }),
  col.display({ id: "acciones", header: "Acciones" }),
])

const ORDEN_INICIAL: SortingState = [{ id: "inicio", desc: true }]

export function ListadoActividades({ actividades }: { actividades: FilaActividad[] }) {
  const searchParams = useSearchParams()
  const [inicial] = useState(() => leerParams(new URLSearchParams(searchParams.toString())))
  const [filtros, setFiltros] = useState<Filtros>(inicial.filtros)
  const [vista, setVista] = useState<Vista>(inicial.vista)
  const [semana, setSemana] = useState(inicial.semana)
  const [sorting, setSorting] = useState<SortingState>(ORDEN_INICIAL)
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: POR_PAGINA })

  const conFechas = vista === "lista"
  const activos = [
    filtros.tipo !== "todos",
    filtros.estado !== "todos",
    conFechas && (filtros.desde !== "" || filtros.hasta !== ""),
  ].filter(Boolean).length
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(activos > 0)

  const actualizar = (cambios: Partial<Filtros>) => {
    const nuevo = { ...filtros, ...cambios }
    setFiltros(nuevo)
    setPagination((p) => ({ ...p, pageIndex: 0 }))
    escribirParams(nuevo, vista, semana)
  }
  const cambiarVista = (v: Vista) => {
    setVista(v)
    escribirParams(filtros, v, semana)
  }
  const cambiarSemana = (s: string) => {
    setSemana(s)
    escribirParams(filtros, vista, s)
  }

  const filtradas = useMemo(() => filtrar(actividades, filtros, conFechas), [actividades, filtros, conFechas])

  const table = useTable({
    features,
    columns: columnas,
    data: filtradas,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getRowId: (a) => a.id,
  })

  const filas = table.getRowModel().rows
  const total = filtradas.length
  const desde = total === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1
  const hasta = Math.min(total, (pagination.pageIndex + 1) * pagination.pageSize)
  const paginas = table.getPageCount()

  return (
    <div className="space-y-4">
      {/* Búsqueda, vista y filtros */}
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-0 flex-1 basis-48">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Nombre o profesor"
            value={filtros.q}
            onChange={(e) => actualizar({ q: e.target.value })}
            className="h-10 bg-card pl-9"
            aria-label="Buscar actividades"
          />
        </div>
        <div className="flex gap-2">
          <div className="flex rounded-lg border bg-card p-0.5" role="group" aria-label="Vista">
            <Button
              variant={vista === "lista" ? "default" : "ghost"}
              className="h-[2.375rem]"
              onClick={() => cambiarVista("lista")}
              aria-pressed={vista === "lista"}
            >
              <ListIcon /> Lista
            </Button>
            <Button
              variant={vista === "semana" ? "default" : "ghost"}
              className="h-[2.375rem]"
              onClick={() => cambiarVista("semana")}
              aria-pressed={vista === "semana"}
            >
              <CalendarRangeIcon /> Semana
            </Button>
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
      </div>

      {filtrosAbiertos && (
        <div
          id="panel-filtros"
          className="grid grid-cols-2 gap-4 rounded-xl border bg-card p-4 sm:grid-cols-4 lg:flex lg:flex-wrap lg:items-end"
        >
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Tipo</Label>
            <Select value={filtros.tipo} onValueChange={(v) => actualizar({ tipo: v as Filtros["tipo"] })}>
              <SelectTrigger className="w-full lg:w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {TIPOS_ACTIVIDAD_GESTION.map((t) => (
                  <SelectItem key={t} value={t}>
                    {ETIQUETA_TIPO_ACTIVIDAD[t]}
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
                <SelectItem value="todos">Todos</SelectItem>
                {ESTADOS_ACTIVIDAD.map((e) => (
                  <SelectItem key={e} value={e}>
                    {ETIQUETA_ESTADO_ACTIVIDAD[e]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {conFechas && (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="f-desde" className="text-xs text-muted-foreground">
                  Desde
                </Label>
                <Input
                  id="f-desde"
                  type="date"
                  value={filtros.desde}
                  max={filtros.hasta || undefined}
                  onChange={(e) => actualizar({ desde: e.target.value })}
                  className="lg:w-40"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="f-hasta" className="text-xs text-muted-foreground">
                  Hasta
                </Label>
                <Input
                  id="f-hasta"
                  type="date"
                  value={filtros.hasta}
                  min={filtros.desde || undefined}
                  onChange={(e) => actualizar({ hasta: e.target.value })}
                  className="lg:w-40"
                />
              </div>
            </>
          )}
          <div className="col-span-full flex justify-end lg:ml-auto">
            <Button variant="ghost" disabled={activos === 0} onClick={() => actualizar({ ...FILTROS_BASE, q: filtros.q })}>
              <XIcon /> Limpiar filtros
            </Button>
          </div>
        </div>
      )}

      {vista === "semana" ? (
        <CalendarioSemanal actividades={filtradas} semana={semana} onCambiarSemana={cambiarSemana} />
      ) : total === 0 ? (
        <div className="rounded-xl border border-dashed bg-card px-6 py-14 text-center text-sm text-muted-foreground">
          {actividades.length === 0
            ? "Todavía no hay actividades. Creá la primera con «Nueva actividad»."
            : "No hay actividades que coincidan con la búsqueda."}
        </div>
      ) : (
        <>
          {/* Celular: tarjetas */}
          <ul className="space-y-2 md:hidden">
            {filas.map((fila) => (
              <TarjetaActividad key={fila.id} a={fila.original} />
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
                      const centrado = header.column.id === "participantes" || header.column.id === "acciones"
                      return (
                        <TableHead
                          key={header.id}
                          className={cn(
                            "h-11 px-4 text-xs tracking-wide text-muted-foreground uppercase",
                            centrado && "text-center",
                            header.column.id === "nombre" && "w-[30%]",
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
                  <FilaTabla key={fila.id} a={fila.original} />
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Paginación */}
          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-sm text-muted-foreground">
              Mostrando <b className="text-foreground tabular-nums">{desde}–{hasta}</b> de{" "}
              <b className="text-foreground tabular-nums">{total}</b> {total === 1 ? "actividad" : "actividades"}
            </p>
            {paginas > 1 && (
              <nav className="flex flex-wrap items-center justify-center gap-1" aria-label="Paginación">
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

function textoAnotados(a: FilaActividad) {
  return a.estado === "finalizada" ? `${a.presentes}/${a.participantes}` : String(a.participantes)
}

function Acciones({ a, className }: { a: FilaActividad; className?: string }) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-lg" asChild className="text-marino hover:bg-dorado/15">
            <Link href={`/actividades/${a.id}`} aria-label={`Ver ${a.nombre}`}>
              <EyeIcon />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Ver detalle</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-lg" asChild className="text-marino hover:bg-dorado/15">
            <Link href={`/actividades/${a.id}/editar`} aria-label={`Editar ${a.nombre}`}>
              <PencilIcon />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Editar</TooltipContent>
      </Tooltip>
    </div>
  )
}

function FilaTabla({ a }: { a: FilaActividad }) {
  const cancelada = a.estado === "cancelada"
  return (
    <TableRow className={cn(cancelada && "opacity-60")}>
      <TableCell className="px-4 py-3">
        <div className="flex items-center gap-3">
          <IconoTipoActividad tipo={a.tipo} />
          <div className="min-w-0">
            <Link href={`/actividades/${a.id}`} className="block truncate font-medium hover:underline">
              {a.nombre}
            </Link>
            <p className="truncate text-xs text-muted-foreground">
              {a.profesor_nombre ? `Prof. ${a.profesor_nombre}` : a.precio > 0 ? "" : "Sin cargo"}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell className="px-4">
        <p className="tabular-nums">{formatearFecha(a.inicio)}</p>
        <p className="text-xs text-muted-foreground tabular-nums">{formatearHora(a.inicio)} h</p>
      </TableCell>
      <TableCell className="px-4">
        <InsigniaTipoActividad tipo={a.tipo} />
      </TableCell>
      <TableCell className="px-4">
        <InsigniaEstadoActividad estado={a.estado} />
      </TableCell>
      <TableCell className="px-4 text-center">
        <span className="font-heading text-xl font-semibold tabular-nums">{textoAnotados(a)}</span>
        {a.estado === "finalizada" && <p className="text-[0.65rem] text-muted-foreground">presentes</p>}
      </TableCell>
      <TableCell className="px-4">
        <ProgresoCobro cobrado={a.monto_cobrado} esperado={a.monto_esperado} />
      </TableCell>
      <TableCell className="px-4">
        <Acciones a={a} className="justify-center" />
      </TableCell>
    </TableRow>
  )
}

function TarjetaActividad({ a }: { a: FilaActividad }) {
  return (
    <li className={cn("rounded-xl border bg-card p-3", a.estado === "cancelada" && "opacity-60")}>
      <div className="flex items-start gap-3">
        <IconoTipoActividad tipo={a.tipo} />
        <Link href={`/actividades/${a.id}`} className="min-w-0 flex-1">
          <p className="truncate font-medium">{a.nombre}</p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {formatearFecha(a.inicio)} · {formatearHora(a.inicio)} h
            {a.profesor_nombre && ` · Prof. ${a.profesor_nombre}`}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <InsigniaEstadoActividad estado={a.estado} />
          </div>
        </Link>
        <Acciones a={a} className="flex-col gap-0" />
      </div>
      <div className="mt-2 flex items-end justify-between gap-3 border-t pt-2">
        <p className="text-sm">
          <b className="tabular-nums">{textoAnotados(a)}</b>{" "}
          <span className="text-muted-foreground">{a.estado === "finalizada" ? "presentes" : "anotados"}</span>
        </p>
        <ProgresoCobro cobrado={a.monto_cobrado} esperado={a.monto_esperado} className="text-right" />
      </div>
    </li>
  )
}
