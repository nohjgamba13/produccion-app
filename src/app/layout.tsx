import "./globals.css";
import type { Metadata } from "next";
import TopNav from "../components/TopNav";

export const metadata: Metadata = {
  title: "Sistema de Producción",
  description: "Sistema de producción",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-gray-900">
        <TopNav />
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4">{children}</div>
      </body>
    </html>
  );
}
