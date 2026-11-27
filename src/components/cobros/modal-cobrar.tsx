"use client"

import { BanknoteIcon, CheckIcon, LandmarkIcon, Loader2Icon, PaperclipIcon, PiggyBankIcon, WalletIcon, XIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useRef, useState, useTransition, type ReactNode } from "react"
import { toast } from "sonner"

import { registrarPago, usarSaldoAFavor } from "@/app/(app)/cobros/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { formatearFecha, formatearMonto } from "@/lib/formato"
import { hoyISO } from "@/lib/jugadores/esquema"
import { subirArchivo } from "@/lib/storage"
import { cn } from "@/lib/utils"
import { saldoCobro, type CobroImpago } from "./insignias-cobro"

type Medio = "efectivo" | "transferencia" | "saldo" | "mercadopago"

const MEDIOS: { valor: Medio; titulo: string; detalle: string; icono: typeof BanknoteIcon }[] = [
  { valor: "efectivo", titulo: "Efectivo", detalle: "Queda pagado ahora.", icono: BanknoteIcon },
  { valor: "transferencia", titulo: "Transferencia", detalle: "Queda pagado ahora.", icono: LandmarkIcon },
  { valor: "saldo", titulo: "Saldo a favor", detalle: "Usa lo que tiene a favor.", icono: PiggyBankIcon },
  { valor: "mercadopago", titulo: "Mercado Pago", detalle: "Link de pago (próximamente).", icono: WalletIcon },
]

// Cómo se reparte un monto entre los cobros elegidos: del más viejo al más nuevo.
function repartir(cobros: CobroImpago[], monto: number) {
  let resto = monto
  return [...cobros]
    .sort((a, b) => a.vencimiento.localeCompare(b.vencimiento))
    .map((c) => {
      const aplica = Math.min(resto, saldoCobro(c))
      resto -= aplica
      return { cobro: c, aplica }
    })
}

export function ModalCobrar({
  jugador,
  cobros,
  saldoAFavor,
  preseleccion,
  trigger,
}: {
  jugador: { id: string; nombre: string }
  cobros: CobroImpago[]
  saldoAFavor: number
  // Cobros marcados al abrir (por defecto, todos).
  preseleccion?: string[]
  trigger: ReactNode
}) {
  const [abierto, setAbierto] = useState(false)
  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        {abierto && (
          <Contenido
            jugador={jugador}
            cobros={cobros}
            saldoAFavor={saldoAFavor}
            preseleccion={preseleccion}
            onCerrar={() => setAbierto(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function Contenido({
  jugador,
  cobros,
  saldoAFavor,
  preseleccion,
  onCerrar,
}: {
  jugador: { id: string; nombre: string }
  cobros: CobroImpago[]
  saldoAFavor: number
  preseleccion?: string[]
  onCerrar: () => void
}) {
  const router = useRouter()
  const [pendiente, startTransition] = useTransition()
  const ordenados = useMemo(() => [...cobros].sort((a, b) => a.vencimiento.localeCompare(b.vencimiento)), [cobros])
  const [elegidos, setElegidos] = useState<Set<string>>(() => new Set(preseleccion ?? ordenados.map((c) => c.id)))
  const seleccion = ordenados.filter((c) => elegidos.has(c.id))
  const deuda = seleccion.reduce((t, c) => t + saldoCobro(c), 0)

  const [montoTexto, setMontoTexto] = useState<string | null>(null) // null = todo lo elegido
  const [medio, setMedio] = useState<Medio>("efectivo")
  const [fecha, setFecha] = useState(hoyISO())
  const [nota, setNota] = useState("")
  const [archivo, setArchivo] = useState<File | null>(null)
  const inputArchivo = useRef<HTMLInputElement>(null)

  const tope = medio === "saldo" ? Math.min(deuda, saldoAFavor) : deuda
  const monto = montoTexto === null ? tope : Number(montoTexto)
  const montoValido = Number.isFinite(monto) && monto > 0 && monto <= tope
  const parcial = montoValido && monto < deuda
  const reparto = repartir(seleccion, montoValido ? monto : 0)

  const alternar = (id: string) =>
    setElegidos((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const confirmar = () => {
    if (!seleccion.length) {
      toast.error("Elegí al menos un cobro.")
      return
    }
    if (!montoValido) {
      toast.error(monto > tope ? `El monto no puede superar ${formatearMonto(tope)}.` : "Ingresá el monto.")
      return
    }
    startTransition(async () => {
      if (medio === "saldo") {
        const r = await usarSaldoAFavor(jugador.id, seleccion.map((c) => c.id), monto)
        if (!r.ok) {
          toast.error(r.error)
          return
        }
        toast.success(`Se aplicaron ${formatearMonto(r.datos.aplicado)} del saldo a favor.`)
      } else if (medio === "efectivo" || medio === "transferencia") {
        let comprobantePath: string | null = null
        if (archivo) {
          try {
            comprobantePath = await subirArchivo("comprobantes", jugador.id, archivo)
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "No se pudo subir el comprobante.")
            return
          }
        }
        const r = await registrarPago({
          jugadorId: jugador.id,
          cobroIds: seleccion.map((c) => c.id),
          monto,
          medio,
          fecha,
          nota,
          comprobantePath,
        })
        if (!r.ok) {
          toast.error(r.error)
          return
        }
        toast.success(parcial ? `Pago parcial de ${formatearMonto(monto)} registrado.` : `Pago de ${formatearMonto(monto)} registrado.`)
      }
      onCerrar()
      router.refresh()
    })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-heading text-2xl">Cobrar a {jugador.nombre}</DialogTitle>
        <DialogDescription>Elegí qué paga y cómo. Si paga una parte, se aplica del cobro más viejo al más nuevo.</DialogDescription>
      </DialogHeader>

      <div className="space-y-5">
        {/* 1. Qué cobra */}
        <section className="space-y-2">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-medium">1. Qué paga</p>
            <button
              type="button"
              className="text-xs font-medium text-dorado-oscuro hover:underline"
              onClick={() =>
                setElegidos(seleccion.length === ordenados.length ? new Set() : new Set(ordenados.map((c) => c.id)))
              }
            >
              {seleccion.length === ordenados.length ? "Desmarcar todo" : "Todo lo adeudado"}
            </button>
          </div>
          <ul className="divide-y rounded-xl border">
            {ordenados.map((c) => {
              const marcado = elegidos.has(c.id)
              const aplica = reparto.find((r) => r.cobro.id === c.id)?.aplica ?? 0
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => alternar(c.id)}
                    aria-pressed={marcado}
                    className={cn("flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50", marcado && "bg-dorado/5")}
                  >
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded border",
                        marcado ? "border-marino bg-marino text-crema" : "border-input",
                      )}
                      aria-hidden
                    >
                      {marcado && <CheckIcon className="size-3.5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{c.descripcion}</span>
                      <span className={cn("block text-xs", c.estado === "vencido" ? "text-destructive" : "text-muted-foreground")}>
                        {c.estado === "vencido" ? "Venció" : "Vence"} el {formatearFecha(c.vencimiento)}
                        {c.monto_pagado > 0 && ` · ya pagó ${formatearMonto(c.monto_pagado)}`}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block text-sm font-medium tabular-nums">{formatearMonto(saldoCobro(c))}</span>
                      {marcado && montoValido && aplica < saldoCobro(c) && (
                        <span className="block text-[0.7rem] text-alerta tabular-nums">
                          {aplica > 0 ? `paga ${formatearMonto(aplica)}` : "no alcanza"}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

        {/* 2. Cómo paga */}
        <section className="space-y-2">
          <p className="text-sm font-medium">2. Cómo paga</p>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Medio de pago">
            {MEDIOS.map((m) => {
              const deshabilitado = m.valor === "mercadopago" || (m.valor === "saldo" && saldoAFavor <= 0)
              const Icono = m.icono
              return (
                <button
                  key={m.valor}
                  type="button"
                  role="radio"
                  aria-checked={medio === m.valor}
                  disabled={deshabilitado}
                  onClick={() => {
                    setMedio(m.valor)
                    setMontoTexto(null)
                  }}
                  className={cn(
                    "flex items-start gap-2 rounded-lg border px-3 py-2 text-left transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50",
                    medio === m.valor && "border-dorado bg-dorado/10 ring-1 ring-dorado/40",
                  )}
                >
                  <Icono className="mt-0.5 size-4 shrink-0 text-dorado-oscuro" />
                  <span>
                    <span className="block text-sm font-medium">{m.titulo}</span>
                    <span className="block text-xs text-muted-foreground">
                      {m.valor === "saldo" ? (saldoAFavor > 0 ? `Tiene ${formatearMonto(saldoAFavor)} a favor.` : "No tiene saldo a favor.") : m.detalle}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        {/* 3. Cuánto y detalles */}
        <section className="space-y-3">
          <p className="text-sm font-medium">3. Cuánto</p>
          <Field>
            <FieldLabel htmlFor="cobrar-monto" className="sr-only">
              Monto
            </FieldLabel>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="cobrar-monto"
                type="number"
                inputMode="numeric"
                min={0}
                step={500}
                value={montoTexto ?? String(tope)}
                onChange={(e) => setMontoTexto(e.target.value)}
                className="h-12 pl-7 font-heading text-2xl font-semibold tabular-nums"
              />
            </div>
            <FieldDescription>
              {parcial
                ? `Pago parcial: quedan ${formatearMonto(deuda - monto)} pendientes.`
                : medio === "saldo" && saldoAFavor < deuda
                  ? `El saldo a favor alcanza para ${formatearMonto(saldoAFavor)}.`
                  : `Total elegido: ${formatearMonto(deuda)}.`}
              {montoTexto !== null && (
                <button type="button" className="ml-2 font-medium text-dorado-oscuro hover:underline" onClick={() => setMontoTexto(null)}>
                  Usar el total
                </button>
              )}
            </FieldDescription>
          </Field>

          {(medio === "efectivo" || medio === "transferencia") && (
            <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
              <Field>
                <FieldLabel htmlFor="cobrar-fecha">Fecha</FieldLabel>
                <Input id="cobrar-fecha" type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="cobrar-nota">Nota</FieldLabel>
                <Textarea
                  id="cobrar-nota"
                  rows={1}
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  placeholder={medio === "transferencia" ? "N.º de operación, banco…" : "Opcional"}
                  className="min-h-9"
                />
              </Field>
              <div className="sm:col-span-2">
                <input
                  ref={inputArchivo}
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
                />
                {archivo ? (
                  <p className="flex items-center gap-2 text-sm">
                    <PaperclipIcon className="size-4 text-muted-foreground" />
                    <span className="truncate">{archivo.name}</span>
                    <Button variant="ghost" size="icon-sm" aria-label="Quitar comprobante" onClick={() => setArchivo(null)}>
                      <XIcon />
                    </Button>
                  </p>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => inputArchivo.current?.click()}>
                    <PaperclipIcon /> Adjuntar comprobante (opcional)
                  </Button>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      <DialogFooter>
        <Button variant="outline" size="lg" onClick={onCerrar}>
          Cancelar
        </Button>
        <Button size="lg" onClick={confirmar} disabled={pendiente || !seleccion.length || medio === "mercadopago"} className="min-w-40">
          {pendiente && <Loader2Icon className="animate-spin" />}
          {montoValido ? `Registrar ${formatearMonto(monto)}` : "Registrar pago"}
        </Button>
      </DialogFooter>
    </>
  )
}
