"use client"

import { ArrowRightLeftIcon, BadgeDollarSignIcon, EllipsisVerticalIcon, GiftIcon, Loader2Icon, UserIcon, UserMinusIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { cambiarBonificado, cambiarPrecioParticipante, moverParticipante, quitarParticipante } from "@/app/(app)/actividades/actions"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { EquipoDetalle, ParticipanteDetalle } from "@/lib/actividades/detalle"
import { formatearMonto, nombreCompleto } from "@/lib/formato"

export function MenuParticipante({
  p,
  equipos,
  conEquipos,
  precioActividad,
  editable,
}: {
  p: ParticipanteDetalle
  equipos: EquipoDetalle[]
  conEquipos: boolean
  precioActividad: number
  editable: boolean
}) {
  const router = useRouter()
  const [pendiente, startTransition] = useTransition()
  const [confirmarQuitar, setConfirmarQuitar] = useState(false)
  const [editarPrecio, setEditarPrecio] = useState(false)
  const conCargo = (p.precio ?? precioActividad) > 0
  const nombre = nombreCompleto(p.jugador)

  const ejecutar = (accion: () => Promise<{ ok: true } | { ok: false; error: string }>, exito: string) =>
    startTransition(async () => {
      const r = await accion()
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(exito)
      setConfirmarQuitar(false)
      setEditarPrecio(false)
      router.refresh()
    })

  const pagado = p.cobro?.estado === "pagado"
  const impago = p.cobro && (p.cobro.estado === "pendiente" || p.cobro.estado === "vencido")

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-lg" aria-label={`Opciones de ${nombre}`} disabled={pendiente}>
            <EllipsisVerticalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="truncate">{nombre}</DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <Link href={`/jugadores/${p.jugador.id}`}>
              <UserIcon /> Ver ficha
            </Link>
          </DropdownMenuItem>
          {editable && conEquipos && equipos.length > 0 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <ArrowRightLeftIcon /> Mover a
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {equipos
                  .filter((e) => e.id !== p.equipo_id)
                  .map((e) => (
                    <DropdownMenuItem
                      key={e.id}
                      onSelect={() => ejecutar(() => moverParticipante(p.id, e.id), `${nombre} pasó a ${e.nombre}.`)}
                    >
                      {e.nombre}
                    </DropdownMenuItem>
                  ))}
                {p.equipo_id && (
                  <DropdownMenuItem
                    onSelect={() => ejecutar(() => moverParticipante(p.id, null), `${nombre} quedó sin equipo.`)}
                  >
                    Sin equipo
                  </DropdownMenuItem>
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
          {editable && !pagado && (
            <DropdownMenuItem onSelect={() => setEditarPrecio(true)}>
              <BadgeDollarSignIcon /> {p.precio === null ? "Precio especial" : "Cambiar precio especial"}
            </DropdownMenuItem>
          )}
          {editable && conCargo && !pagado && (
            <DropdownMenuItem
              onSelect={() =>
                ejecutar(
                  () => cambiarBonificado(p.id, !p.bonificado),
                  p.bonificado ? `${nombre} vuelve a pagar la actividad.` : `${nombre} quedó bonificado.`,
                )
              }
            >
              <GiftIcon /> {p.bonificado ? "Quitar bonificación" : "Bonificar"}
            </DropdownMenuItem>
          )}
          {editable && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmarQuitar(true)}>
                <UserMinusIcon /> Quitar de la actividad
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editarPrecio} onOpenChange={setEditarPrecio}>
        <DialogContent className="sm:max-w-sm">
          {editarPrecio && (
            <FormPrecio
              nombre={nombre}
              precio={p.precio}
              precioActividad={precioActividad}
              pendiente={pendiente}
              onGuardar={(valor) =>
                ejecutar(
                  () => cambiarPrecioParticipante(p.id, valor),
                  valor === null ? `${nombre} paga el precio de la actividad.` : `Precio de ${nombre}: ${formatearMonto(valor)}.`,
                )
              }
              onCancelar={() => setEditarPrecio(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmarQuitar} onOpenChange={setConfirmarQuitar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar a {nombre}?</AlertDialogTitle>
            <AlertDialogDescription>
              {pagado ? (
                <>
                  <b>{nombre} ya pagó esta actividad</b> ({formatearMonto(p.cobro!.monto)}). Lo pagado queda como saldo a favor
                  en su cuenta corriente: se puede usar en otro cobro o devolver.
                </>
              ) : impago ? (
                <>
                  Su cobro pendiente de {formatearMonto(p.cobro!.monto - p.cobro!.monto_pagado)} se anula.
                  {p.cobro!.monto_pagado > 0 && ` Lo que ya pagó (${formatearMonto(p.cobro!.monto_pagado)}) queda como saldo a favor.`}
                </>
              ) : (
                <>Deja de figurar en la actividad.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                ejecutar(() => quitarParticipante(p.id), `${nombre} ya no está en la actividad.`)
              }}
              disabled={pendiente}
            >
              Quitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function FormPrecio({
  nombre,
  precio,
  precioActividad,
  pendiente,
  onGuardar,
  onCancelar,
}: {
  nombre: string
  precio: number | null
  precioActividad: number
  pendiente: boolean
  onGuardar: (precio: number | null) => void
  onCancelar: () => void
}) {
  const [valor, setValor] = useState(String(precio ?? precioActividad))
  const numero = valor.trim() === "" ? NaN : Number(valor)
  const valido = Number.isFinite(numero) && numero >= 0

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (valido) onGuardar(numero === precioActividad ? null : numero)
      }}
    >
      <DialogHeader>
        <DialogTitle className="font-heading text-2xl">Precio para {nombre}</DialogTitle>
        <DialogDescription>
          Solo para esta actividad. El resto paga {formatearMonto(precioActividad)}.
        </DialogDescription>
      </DialogHeader>
      <Field className="my-4">
        <FieldLabel htmlFor="precio-especial">Precio</FieldLabel>
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">$</span>
          <Input
            id="precio-especial"
            type="number"
            inputMode="numeric"
            min={0}
            step={500}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="pl-7 tabular-nums"
            autoFocus
          />
        </div>
        <FieldDescription>Con 0 no se le cobra. Su cobro pendiente se actualiza solo.</FieldDescription>
      </Field>
      <DialogFooter className="gap-2 sm:justify-between">
        {precio !== null ? (
          <Button type="button" variant="link" className="px-0 text-muted-foreground" onClick={() => onGuardar(null)} disabled={pendiente}>
            Usar el de la actividad
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!valido || pendiente}>
            {pendiente && <Loader2Icon className="animate-spin" />}
            Guardar
          </Button>
        </div>
      </DialogFooter>
    </form>
  )
}
