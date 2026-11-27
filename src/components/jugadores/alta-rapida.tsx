"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2Icon, ZapIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition, type ReactNode } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"

import { altaRapidaJugador, type JugadorCreado } from "@/app/(app)/jugadores/actions"
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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatearHandicap } from "@/lib/formato"
import { HANDICAPS } from "@/lib/jugadores/constantes"
import { esquemaAltaRapida, type DatosAltaRapida } from "@/lib/jugadores/esquema"

type Props = {
  // Se llama con el jugador recién creado (p. ej. para agregarlo a un equipo).
  onCreado?: (jugador: JugadorCreado) => void
  // Precarga el nombre (p. ej. lo que se escribió en un buscador).
  nombreInicial?: string
  trigger?: ReactNode
}

function separarNombre(texto = "") {
  const partes = texto.trim().split(/\s+/).filter(Boolean)
  if (partes.length < 2) return { nombre: partes[0] ?? "", apellido: "" }
  return { nombre: partes.slice(0, -1).join(" "), apellido: partes.at(-1) ?? "" }
}

// Modal reutilizable: nombre, apellido, hándicap y club. Se crea como "externo".
export function AltaRapidaJugador({ onCreado, nombreInicial, trigger }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [pendiente, startTransition] = useTransition()
  const router = useRouter()

  const form = useForm<DatosAltaRapida>({
    resolver: zodResolver(esquemaAltaRapida),
    defaultValues: { ...separarNombre(nombreInicial), handicap: 0, club_origen: "" },
  })

  const abrir = (v: boolean) => {
    if (v) form.reset({ ...separarNombre(nombreInicial), handicap: 0, club_origen: "" })
    setAbierto(v)
  }

  const onSubmit = form.handleSubmit((datos) => {
    startTransition(async () => {
      const r = await altaRapidaJugador(datos)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      setAbierto(false)
      if (onCreado) {
        onCreado(r.datos)
        toast.success(`${r.datos.nombre} ${r.datos.apellido} dado de alta.`)
      } else {
        toast.success(`${r.datos.nombre} ${r.datos.apellido} dado de alta.`, {
          action: { label: "Ver ficha", onClick: () => router.push(`/jugadores/${r.datos.id}`) },
        })
        router.refresh()
      }
    })
  })

  const errores = form.formState.errors

  return (
    <Dialog open={abierto} onOpenChange={abrir}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="lg" className="bg-card">
            <ZapIcon /> Alta rápida
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">Alta rápida</DialogTitle>
          <DialogDescription>
            Para jugadores de afuera o invitados. Se crea como <b>externo</b>; después podés completar la ficha.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate id="alta-rapida">
          <FieldGroup className="gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Field data-invalid={!!errores.nombre}>
                <FieldLabel htmlFor="ar-nombre">Nombre</FieldLabel>
                <Input id="ar-nombre" autoFocus autoComplete="off" aria-invalid={!!errores.nombre} {...form.register("nombre")} />
                <FieldError errors={[errores.nombre]} />
              </Field>
              <Field data-invalid={!!errores.apellido}>
                <FieldLabel htmlFor="ar-apellido">Apellido</FieldLabel>
                <Input id="ar-apellido" autoComplete="off" aria-invalid={!!errores.apellido} {...form.register("apellido")} />
                <FieldError errors={[errores.apellido]} />
              </Field>
            </div>
            <div className="grid grid-cols-[7rem_1fr] gap-3">
              <Field data-invalid={!!errores.handicap}>
                <FieldLabel htmlFor="ar-handicap">Hándicap</FieldLabel>
                <Controller
                  control={form.control}
                  name="handicap"
                  render={({ field }) => (
                    <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                      <SelectTrigger id="ar-handicap" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {HANDICAPS.map((h) => (
                          <SelectItem key={h} value={String(h)}>
                            {formatearHandicap(h)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="ar-club">Club de origen</FieldLabel>
                <Input id="ar-club" autoComplete="off" placeholder="Opcional" {...form.register("club_origen")} />
              </Field>
            </div>
          </FieldGroup>
        </form>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="link" asChild className="px-0 text-muted-foreground">
            <Link href="/jugadores/nuevo" onClick={() => setAbierto(false)}>
              Prefiero el alta completa
            </Link>
          </Button>
          <Button type="submit" form="alta-rapida" size="lg" disabled={pendiente}>
            {pendiente && <Loader2Icon className="animate-spin" />}
            Dar de alta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
