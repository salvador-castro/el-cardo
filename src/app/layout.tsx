import type { Metadata, Viewport } from "next"
import { Cinzel, Cormorant_Garamond, Work_Sans } from "next/font/google"

import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

import "./globals.css"

const workSans = Work_Sans({ variable: "--font-work-sans", subsets: ["latin"] })
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
})
const cinzel = Cinzel({ variable: "--font-cinzel", subsets: ["latin"], weight: ["500", "600"] })

export const metadata: Metadata = {
  title: {
    default: "El Cardo Polo Club · Gestión",
    template: "%s · El Cardo",
  },
  description: "Sistema de gestión interno de El Cardo Polo Club.",
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: "#0e1a30",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-AR"
      className={`${workSans.variable} ${cormorant.variable} ${cinzel.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  )
}
