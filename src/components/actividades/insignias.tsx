import { GraduationCapIcon, TrophyIcon, UsersIcon, type LucideIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  ETIQUETA_ESTADO_ACTIVIDAD,
  ETIQUETA_TIPO_ACTIVIDAD,
  type EstadoActividad,
  type TipoActividad,
} from "@/lib/actividades/constantes"
import { formatearMonto } from "@/lib/formato"
import { cn } from "@/lib/utils"

export const ICONO_TIPO_ACTIVIDAD: Record<TipoActividad, LucideIcon> = {
  practica: UsersIcon,
  clase: GraduationCapIcon,
  torneo: TrophyIcon,
}

const ESTILO_TIPO: Record<TipoActividad, string> = {
  practica: "bg-marino text-crema",
  clase: "bg-dorado/20 text-dorado-oscuro",
  torneo: "bg-secondary text-secondary-foreground",
}

export function IconoTipoActividad({ tipo, className }: { tipo: TipoActividad; className?: string }) {
  const Icono = ICONO_TIPO_ACTIVIDAD[tipo]
  return (
    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", ESTILO_TIPO[tipo], className)}>
      <Icono className="size-4" />
    </span>
  )
}

export function InsigniaTipoActividad({ tipo }: { tipo: TipoActividad }) {
  const Icono = ICONO_TIPO_ACTIVIDAD[tipo]
  return (
    <Badge className={ESTILO_TIPO[tipo]}>
      <Icono /> {ETIQUETA_TIPO_ACTIVIDAD[tipo]}
    </Badge>
  )
}

const ESTILO_ESTADO: Record<EstadoActividad, string> = {
  programada: "bg-alerta-suave text-alerta",
  finalizada: "bg-exito-suave text-exito",
  cancelada: "bg-muted text-muted-foreground line-through",
}

export function InsigniaEstadoActividad({ estado }: { estado: EstadoActividad }) {
  return <Badge className={ESTILO_ESTADO[estado]}>{ETIQUETA_ESTADO_ACTIVIDAD[estado]}</Badge>
}

// "Cobrado / esperado" con una barra de progreso.
export function ProgresoCobro({
  cobrado,
  esperado,
  className,
}: {
  cobrado: number
  esperado: number
  className?: string
}) {
  if (esperado <= 0) return <span className={cn("text-sm text-muted-foreground", className)}>Sin cargo</span>
  const pct = Math.min(100, Math.round((cobrado / esperado) * 100))
  return (
    <div className={cn("min-w-28", className)}>
      <p className="text-sm tabular-nums">
        <span className="font-medium">{formatearMonto(cobrado)}</span>
        <span className="text-muted-foreground"> / {formatearMonto(esperado)}</span>
      </p>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className={cn("h-full rounded-full", pct === 100 ? "bg-exito" : "bg-dorado")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
