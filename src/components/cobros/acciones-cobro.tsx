"use client"

import { BanIcon, GiftIcon, Loader2Icon, PencilIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition, type ReactNode } from "react"
import { toast } from "sonner"

import { cambiarMontoCobro, cerrarCobro } from "@/app/(app)/cobros/actions"
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
import { formatearMonto } from "@/lib/formato"

// Editar monto, bonificar o anular un cobro (desde su detalle).
export function AccionesCobro({
  cobroId,
  monto,
  montoPagado,
  impago,
  anulado,
}: {
  cobroId: string
  monto: number
  montoPagado: number
  impago: boolean
  anulado: boolean
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {impago && <EditarMonto cobroId={cobroId} monto={monto} montoPagado={montoPagado} />}
      {impago && (
        <Cerrar
          cobroId={cobroId}
          estado="bonificado"
          titulo="Bonificar el cobro"
          descripcion={
            montoPagado > 0
              ? `Ya pagó ${formatearMonto(montoPagado)}: lo que falta (${formatearMonto(monto - montoPagado)}) no se cobra.`
              : "No se le cobra: queda como bonificado en su cuenta corriente."
          }
          boton={
            <>
              <GiftIcon /> Bonificar
            </>
          }
        />
      )}
      {!anulado && (
        <Cerrar
          cobroId={cobroId}
          estado="anulado"
          titulo="Anular el cobro"
          descripcion={
            montoPagado > 0
              ? `El cobro deja de existir. Lo que ya pagó (${formatearMonto(montoPagado)}) queda como saldo a favor del jugador.`
              : "El cobro deja de existir (queda en el historial como anulado)."
          }
          boton={
            <>
              <BanIcon /> Anular
            </>
          }
          destructivo
        />
      )}
    </div>
  )
}

function EditarMonto({ cobroId, monto, montoPagado }: { cobroId: string; monto: number; montoPagado: number }) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [valor, setValor] = useState(String(monto))
  const [pendiente, startTransition] = useTransition()
  const n = Number(valor)
  const valido = Number.isFinite(n) && n > 0 && n >= montoPagado && n !== monto

  const guardar = () =>
    startTransition(async () => {
      const r = await cambiarMontoCobro(cobroId, n)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success("Monto actualizado.")
      setAbierto(false)
      router.refresh()
    })

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg">
          <PencilIcon /> Editar monto
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">Editar monto</DialogTitle>
          <DialogDescription>Si había un link de pago, deja de servir y hay que generar uno nuevo.</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="ed-monto">Monto</FieldLabel>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">$</span>
            <Input id="ed-monto" type="number" inputMode="numeric" min={montoPagado} step={500} value={valor} onChange={(e) => setValor(e.target.value)} className="pl-7 tabular-nums" />
          </div>
          {montoPagado > 0 && <FieldDescription>No puede ser menor que lo ya pagado ({formatearMonto(montoPagado)}).</FieldDescription>}
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAbierto(false)}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={pendiente || !valido}>
            {pendiente && <Loader2Icon className="animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Cerrar({
  cobroId,
  estado,
  titulo,
  descripcion,
  boton,
  destructivo,
}: {
  cobroId: string
  estado: "anulado" | "bonificado"
  titulo: string
  descripcion: string
  boton: ReactNode
  destructivo?: boolean
}) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [motivo, setMotivo] = useState("")
  const [pendiente, startTransition] = useTransition()

  const confirmar = () =>
    startTransition(async () => {
      const r = await cerrarCobro(cobroId, estado, motivo)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(estado === "anulado" ? "Cobro anulado." : "Cobro bonificado.")
      setAbierto(false)
      router.refresh()
    })

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="lg" className={destructivo ? "text-muted-foreground hover:text-destructive" : undefined}>
          {boton}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">{titulo}</DialogTitle>
          <DialogDescription>{descripcion}</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor={`cerrar-${estado}`}>Motivo</FieldLabel>
          <Textarea id={`cerrar-${estado}`} rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={estado === "bonificado" ? "Beca, invitado del club…" : "Cargado por error…"} />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAbierto(false)}>
            Volver
          </Button>
          <Button variant={destructivo ? "destructive" : "default"} onClick={confirmar} disabled={pendiente || !motivo.trim()}>
            {pendiente && <Loader2Icon className="animate-spin" />}
            {estado === "anulado" ? "Anular cobro" : "Bonificar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
