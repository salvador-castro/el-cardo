"use client"

import { BanIcon, EllipsisVerticalIcon, FlagIcon, PencilIcon, RotateCcwIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { cambiarEstadoActividad } from "@/app/(app)/actividades/actions"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { EstadoActividad } from "@/lib/actividades/constantes"
import { formatearMonto } from "@/lib/formato"

export function AccionesActividad({
  id,
  nombre,
  estado,
  impagos,
  rutaEditar,
}: {
  // Por defecto, la edición de actividades.
  rutaEditar?: string
  id: string
  nombre: string
  estado: EstadoActividad
  // Cobros pendientes o vencidos (se anulan al cancelar).
  impagos: { cantidad: number; monto: number }
}) {
  const router = useRouter()
  const [pendiente, startTransition] = useTransition()
  const [confirmarCancelar, setConfirmarCancelar] = useState(false)

  const cambiar = (nuevo: EstadoActividad, mensaje: string) =>
    startTransition(async () => {
      const r = await cambiarEstadoActividad(id, nuevo)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(mensaje)
      setConfirmarCancelar(false)
      router.refresh()
    })

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {estado === "programada" && (
          <Button size="lg" onClick={() => cambiar("finalizada", "Actividad finalizada.")} disabled={pendiente}>
            <FlagIcon /> Finalizar
          </Button>
        )}
        {estado === "cancelada" && (
          <Button size="lg" onClick={() => cambiar("programada", "La actividad se reactivó.")} disabled={pendiente}>
            <RotateCcwIcon /> Reactivar
          </Button>
        )}
        <Button variant="outline" size="lg" asChild>
          <Link href={rutaEditar ?? `/actividades/${id}/editar`}>
            <PencilIcon /> Editar
          </Link>
        </Button>
        {estado !== "cancelada" && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-lg" aria-label="Más acciones" disabled={pendiente}>
                <EllipsisVerticalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {estado === "finalizada" && (
                <DropdownMenuItem onSelect={() => cambiar("programada", "La actividad volvió a programada.")}>
                  <RotateCcwIcon /> Volver a programada
                </DropdownMenuItem>
              )}
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmarCancelar(true)}>
                <BanIcon /> Cancelar actividad
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <AlertDialog open={confirmarCancelar} onOpenChange={setConfirmarCancelar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar «{nombre}»?</AlertDialogTitle>
            <AlertDialogDescription>
              {impagos.cantidad > 0
                ? `Se anulan ${impagos.cantidad} ${impagos.cantidad === 1 ? "cobro impago" : "cobros impagos"} (${formatearMonto(impagos.monto)}). `
                : ""}
              Los pagos ya registrados no se tocan. Los jugadores siguen figurando en la actividad y la podés reactivar
              después: en ese caso se vuelven a generar los cobros.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                cambiar("cancelada", "Actividad cancelada.")
              }}
              disabled={pendiente}
            >
              Cancelar actividad
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
