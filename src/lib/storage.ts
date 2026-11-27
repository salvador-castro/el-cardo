"use client"

import { createClient } from "@/lib/supabase/client"

export type Bucket = "fotos" | "documentos" | "comprobantes"

const LIMITE_MB: Record<Bucket, number> = { fotos: 5, documentos: 10, comprobantes: 10 }
const TIPOS_PERMITIDOS: Record<Bucket, string[]> = {
  fotos: ["image/jpeg", "image/png", "image/webp"],
  documentos: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
  comprobantes: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
}

// Achica fotos del celular antes de subirlas (máx. `lado` px, JPEG).
export async function reducirImagen(archivo: File, lado = 900, calidad = 0.85): Promise<File> {
  if (!archivo.type.startsWith("image/")) return archivo
  const bitmap = await createImageBitmap(archivo)
  const escala = Math.min(1, lado / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(bitmap.width * escala)
  canvas.height = Math.round(bitmap.height * escala)
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", calidad))
  if (!blob) return archivo
  return new File([blob], archivo.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" })
}

function extension(archivo: File) {
  const porNombre = archivo.name.split(".").pop()?.toLowerCase()
  if (porNombre && porNombre.length <= 5) return porNombre
  return archivo.type.split("/")[1] ?? "bin"
}

// Sube directo a Storage con la sesión del usuario (evita el límite de tamaño de las funciones).
// Devuelve la ruta dentro del bucket: `<carpeta>/<aleatorio>.<ext>`.
export async function subirArchivo(bucket: Bucket, carpeta: string, archivo: File): Promise<string> {
  if (!TIPOS_PERMITIDOS[bucket].includes(archivo.type)) {
    throw new Error(bucket === "fotos" ? "La foto tiene que ser JPG, PNG o WEBP." : "El archivo tiene que ser PDF o imagen.")
  }
  if (archivo.size > LIMITE_MB[bucket] * 1024 * 1024) {
    throw new Error(`El archivo supera los ${LIMITE_MB[bucket]} MB.`)
  }

  const path = `${carpeta}/${crypto.randomUUID()}.${extension(archivo)}`
  const supabase = createClient()
  const { error } = await supabase.storage.from(bucket).upload(path, archivo, {
    contentType: archivo.type,
    upsert: false,
  })
  if (error) throw new Error("No se pudo subir el archivo. Probá de nuevo.")
  return path
}
