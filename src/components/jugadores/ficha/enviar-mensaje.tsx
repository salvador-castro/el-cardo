"use client"

import { BellRingIcon, ChevronDownIcon, HandIcon, LinkIcon, MailIcon, MessageCircleIcon, SendIcon } from "lucide-react"
import { toast } from "sonner"

import { registrarEnvio, type Canal } from "@/app/(app)/cobros/actions"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatearMonto } from "@/lib/formato"
import {
  asuntoRecordatorio,
  enlaceMail,
  mensajeRecordatorio,
  mensajeSaludo,
  type CobroParaMensaje,
} from "@/lib/mensajes"
import { enlaceWhatsapp } from "@/lib/whatsapp"

type CobroPendiente = CobroParaMensaje & { id: string }

// Menú "Enviar": saludo, recordatorio de deuda o link de pago, por WhatsApp o mail.
export function EnviarMensaje({
  nombre,
  telefono,
  email,
  pendientes,
  variante = "outline",
  className,
}: {
  nombre: string
  telefono: string | null
  email: string | null
  pendientes: CobroPendiente[]
  variante?: "outline" | "default"
  className?: string
}) {
  const tieneWhatsapp = Boolean(enlaceWhatsapp(telefono))
  const tieneDeuda = pendientes.length > 0
  const total = pendientes.reduce((t, c) => t + Number(c.monto), 0)

  const abrir = (url: string) => window.open(url, "_blank", "noopener,noreferrer")

  const enviarRecordatorio = (canal: Canal) => {
    const texto = mensajeRecordatorio(nombre, pendientes)
    const url = canal === "whatsapp" ? enlaceWhatsapp(telefono, texto) : email && enlaceMail(email, asuntoRecordatorio(), texto)
    if (!url) return
    abrir(url)
    // Queda registrado en el historial de cada cobro (no bloquea el envío).
    registrarEnvio(
      pendientes.map((c) => c.id),
      canal,
      "recordatorio",
    ).then((r) => {
      if (!r.ok) toast.error("El mensaje se abrió, pero no se pudo registrar en el historial.")
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variante} size="lg" className={className}>
          <SendIcon /> Enviar <ChevronDownIcon className="opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground">
            <MessageCircleIcon className="size-3.5 text-[#128c4a]" /> WhatsApp
            {!tieneWhatsapp && <span className="ml-auto font-normal">sin teléfono válido</span>}
          </DropdownMenuLabel>
          <DropdownMenuItem
            disabled={!tieneWhatsapp || !tieneDeuda}
            onSelect={() => enviarRecordatorio("whatsapp")}
          >
            <BellRingIcon />
            <span className="flex-1">Recordatorio de pago</span>
            {tieneDeuda && <span className="text-xs text-muted-foreground tabular-nums">{formatearMonto(total)}</span>}
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            <LinkIcon />
            <span className="flex-1">Link de pago</span>
            <span className="text-[0.65rem] text-muted-foreground">etapa 5</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!tieneWhatsapp}
            onSelect={() => {
              const url = enlaceWhatsapp(telefono, mensajeSaludo(nombre))
              if (url) abrir(url)
            }}
          >
            <HandIcon />
            Mensaje libre
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground">
            <MailIcon className="size-3.5" /> Email
            {!email && <span className="ml-auto font-normal">sin email</span>}
          </DropdownMenuLabel>
          <DropdownMenuItem disabled={!email || !tieneDeuda} onSelect={() => enviarRecordatorio("email")}>
            <BellRingIcon />
            <span className="flex-1">Recordatorio de pago</span>
            {tieneDeuda && <span className="text-xs text-muted-foreground tabular-nums">{formatearMonto(total)}</span>}
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            <LinkIcon />
            <span className="flex-1">Link de pago</span>
            <span className="text-[0.65rem] text-muted-foreground">etapa 5</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        {!tieneDeuda && (
          <p className="px-2 pt-2 pb-1 text-xs text-muted-foreground">No tiene cobros pendientes para recordar.</p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
