import { z } from "zod"

export const esquemaLogin = z.object({
  email: z.email("Ingresá un email válido.").trim().toLowerCase(),
  password: z.string().min(1, "Ingresá tu contraseña."),
})

export type DatosLogin = z.infer<typeof esquemaLogin>
