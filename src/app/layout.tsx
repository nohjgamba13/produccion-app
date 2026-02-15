import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sistema de Producción",
  description: "Gestión de producción por etapas",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-gray-100">
        {/* Top bar global */}
        <header className="sticky top-0 z-50 bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {/* Logo */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="Logo"
                className="h-10 w-10 rounded-xl object-contain border bg-white"
              />
              <div className="leading-tight">
                <div className="text-lg font-bold">3PUNTOS</div>
                <div className="text-xs text-gray-500">Sistema de Producción</div>
              </div>
            </div>

            <div className="text-xs text-gray-500 hidden sm:block">
              Producción · 6 etapas · Roles
            </div>
          </div>
        </header>

        {/* App content */}
        <div>{children}</div>
      </body>
    </html>
  );
}
