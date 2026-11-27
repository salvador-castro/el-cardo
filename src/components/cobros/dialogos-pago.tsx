"use client"

import { Loader2Icon, Undo2Icon, XIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { anularPago, registrarDevolucion } from "@/app/(app)/cobros/actions"
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
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { formatearMonto } from "@/lib/formato"
import { cn } from "@/lib/utils"

// Anular un pago (por ejemplo, cargado por error). Los cobros vuelven a quedar impagos.
export function AnularPago({ pagoId, monto }: { pagoId: string; monto: number }) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [motivo, setMotivo] = useState("")
  const [pendiente, startTransition] = useTransition()

  const confirmar = () =>
    startTransition(async () => {
      const r = await anularPago(pagoId, motivo)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success("Pago anulado.")
      setAbierto(false)
      router.refresh()
    })

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Anular pago" title="Anular pago" className="text-muted-foreground hover:text-destructive">
          <XIcon />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">¿Anular el pago de {formatearMonto(monto)}?</DialogTitle>
          <DialogDescription>
            Los cobros que pagaba vuelven a quedar pendientes. El pago queda en el historial como anulado.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="anular-motivo">Motivo</FieldLabel>
          <Textarea id="anular-motivo" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Cargado por error, rebotó la transferencia…" />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAbierto(false)}>
            Volver
          </Button>
          <Button variant="destructive" onClick={confirmar} disabled={pendiente || !motivo.trim()}>
            {pendiente && <Loader2Icon className="animate-spin" />}
            Anular pago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Devolver plata del saldo a favor.
export function RegistrarDevolucion({ jugadorId, saldo }: { jugadorId: string; saldo: number }) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [monto, setMonto] = useState(String(saldo))
  const [medio, setMedio] = useState<"efectivo" | "transferencia">("transferencia")
  const [nota, setNota] = useState("")
  const [pendiente, startTransition] = useTransition()
  const n = Number(monto)
  const valido = Number.isFinite(n) && n > 0 && n <= saldo

  const confirmar = () =>
    startTransition(async () => {
      const r = await registrarDevolucion(jugadorId, n, medio, nota)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(`Devolución de ${formatearMonto(n)} registrada.`)
      setAbierto(false)
      router.refresh()
    })

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <button type="button" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-exito hover:underline">
          <Undo2Icon className="size-3" /> Registrar devolución
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">Registrar devolución</DialogTitle>
          <DialogDescription>Tiene {formatearMonto(saldo)} a favor. Lo que devuelvas se descuenta de ese saldo.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field>
            <FieldLabel htmlFor="dev-monto">Monto</FieldLabel>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <Input id="dev-monto" type="number" inputMode="numeric" min={0} max={saldo} value={monto} onChange={(e) => setMonto(e.target.value)} className="pl-7 tabular-nums" />
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Cómo se devuelve">
            {(["transferencia", "efectivo"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={medio === m}
                onClick={() => setMedio(m)}
                className={cn("rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted/50", medio === m && "border-dorado bg-dorado/10 ring-1 ring-dorado/40")}
              >
                {m === "transferencia" ? "Transferencia" : "Efectivo"}
              </button>
            ))}
          </div>
          <Field>
            <FieldLabel htmlFor="dev-nota">Nota</FieldLabel>
            <Input id="dev-nota" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Opcional" />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAbierto(false)}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={pendiente || !valido}>
            {pendiente && <Loader2Icon className="animate-spin" />}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
