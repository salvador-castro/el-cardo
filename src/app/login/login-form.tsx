"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2Icon } from "lucide-react"
import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { iniciarSesion } from "./actions"
import { esquemaLogin, type DatosLogin } from "./esquema"

export function LoginForm({ next, errorInicial }: { next?: string; errorInicial?: string }) {
  const [error, setError] = useState<string | undefined>(errorInicial)
  const [pendiente, startTransition] = useTransition()

  const form = useForm<DatosLogin>({
    resolver: zodResolver(esquemaLogin),
    defaultValues: { email: "", password: "" },
  })

  const onSubmit = form.handleSubmit((datos) => {
    setError(undefined)
    startTransition(async () => {
      const resultado = await iniciarSesion(datos, next)
      if (resultado?.error) setError(resultado.error)
    })
  })

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Field data-invalid={!!form.formState.errors.email}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            autoFocus
            aria-invalid={!!form.formState.errors.email}
            {...form.register("email")}
          />
          <FieldError errors={[form.formState.errors.email]} />
        </Field>

        <Field data-invalid={!!form.formState.errors.password}>
          <FieldLabel htmlFor="password">Contraseña</FieldLabel>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            aria-invalid={!!form.formState.errors.password}
            {...form.register("password")}
          />
          <FieldError errors={[form.formState.errors.password]} />
        </Field>

        <Button type="submit" size="lg" className="w-full" disabled={pendiente}>
          {pendiente && <Loader2Icon className="animate-spin" />}
          Ingresar
        </Button>
      </FieldGroup>
    </form>
  )
}
