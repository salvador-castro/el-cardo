import Image from "next/image"
import Link from "next/link"

import { cn } from "@/lib/utils"

export function Marca({ className, compacta = false }: { className?: string; compacta?: boolean }) {
  return (
    <Link href="/" className={cn("flex items-center gap-3", className)} aria-label="El Cardo Polo Club — Inicio">
      <Image
        src="/marca/escudo-crema.png"
        alt=""
        width={52}
        height={36}
        className={cn("h-auto shrink-0", compacta ? "w-10" : "w-12")}
        priority
      />
      <span className="leading-none">
        <b className="block font-marca text-[0.82rem] font-semibold text-crema">EL CARDO</b>
        <small className="mt-1 block font-marca text-[0.5rem] tracking-[0.34em] text-dorado">POLO CLUB</small>
      </span>
    </Link>
  )
}
