"use client"

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { formatearMonto } from "@/lib/formato"

// Precio para los jugadores que se agregan. Vacío = el precio de la actividad.
export function CampoPrecio({
  id,
  valor,
  onChange,
  precioActividad,
}: {
  id: string
  valor: string
  onChange: (v: string) => void
  precioActividad: number
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>Precio para estos jugadores</FieldLabel>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">$</span>
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={0}
          step={500}
          value={valor}
          placeholder={String(precioActividad)}
          onChange={(e) => onChange(e.target.value)}
          className="pl-7 tabular-nums"
        />
      </div>
      <FieldDescription>
        Vacío: pagan el precio de la actividad ({formatearMonto(precioActividad)}). Si cada uno paga distinto, después lo
        cambiás desde el menú de cada jugador.
      </FieldDescription>
    </Field>
  )
}

// "" o el precio de la actividad → null (sin precio especial).
export function leerPrecio(valor: string, precioActividad: number): number | null | "invalido" {
  if (valor.trim() === "") return null
  const n = Number(valor)
  if (!Number.isFinite(n) || n < 0) return "invalido"
  return n === precioActividad ? null : n
}
