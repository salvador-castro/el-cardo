import { AlertTriangleIcon, CircleCheckIcon, CircleDashedIcon, ClockIcon, GraduationCapIcon } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { iniciales } from "@/lib/formato"
import { ETIQUETA_APTO, ETIQUETA_TIPO_JUGADOR, type EstadoApto, type TipoJugador } from "@/lib/jugadores/constantes"
import { cn } from "@/lib/utils"

export function AvatarJugador({
  jugador,
  fotoUrl,
  className,
}: {
  jugador: { nombre: string | null; apellido: string | null }
  fotoUrl?: string | null
  className?: string
}) {
  return (
    <Avatar className={cn("size-10 border border-border", className)}>
      {fotoUrl && <AvatarImage src={fotoUrl} alt="" className="object-cover" />}
      <AvatarFallback className="bg-marino text-xs font-semibold text-crema">{iniciales(jugador)}</AvatarFallback>
    </Avatar>
  )
}

const ESTILO_TIPO: Record<TipoJugador, string> = {
  socio: "bg-marino text-crema",
  no_socio: "bg-secondary text-secondary-foreground",
  alumno: "bg-[#e8e1f0] text-[#5c3f73]",
  externo: "bg-[#e6eedd] text-[#4a5f37]",
}

export function InsigniaTipo({ tipo }: { tipo: TipoJugador }) {
  return <Badge className={ESTILO_TIPO[tipo]}>{ETIQUETA_TIPO_JUGADOR[tipo]}</Badge>
}

export function InsigniaProfesor() {
  return (
    <Badge variant="outline" className="border-dorado/60 text-dorado-oscuro">
      <GraduationCapIcon /> Profesor
    </Badge>
  )
}

export function InsigniaApto({ estado, compacta = false }: { estado: EstadoApto; compacta?: boolean }) {
  const config = {
    vigente: { icono: CircleCheckIcon, clase: "bg-exito-suave text-exito" },
    por_vencer: { icono: ClockIcon, clase: "bg-alerta-suave text-alerta" },
    vencido: { icono: AlertTriangleIcon, clase: "bg-peligro-suave text-destructive" },
    sin_apto: { icono: CircleDashedIcon, clase: "bg-muted text-muted-foreground" },
  }[estado]
  const Icono = config.icono
  return (
    <Badge className={config.clase} title={ETIQUETA_APTO[estado]}>
      <Icono />
      {compacta ? ETIQUETA_APTO[estado].replace("Apto ", "") : ETIQUETA_APTO[estado]}
    </Badge>
  )
}

// Aviso por cualquier documento vencido o por vencer (apto, seguro, deslinde u otro).
export function InsigniaDocumentos({ alerta }: { alerta: string | null }) {
  if (alerta === "vencido") {
    return (
      <Badge className="bg-peligro-suave text-destructive">
        <AlertTriangleIcon /> Documento vencido
      </Badge>
    )
  }
  if (alerta === "por_vencer") {
    return (
      <Badge className="bg-alerta-suave text-alerta">
        <ClockIcon /> Documento por vencer
      </Badge>
    )
  }
  return null
}

export function InsigniaInactivo() {
  return <Badge variant="outline" className="text-muted-foreground">Inactivo</Badge>
}
