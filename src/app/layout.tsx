import "./globals.css";
import type { Metadata } from "next";
import TopNav from "../components/TopNav";

export const metadata: Metadata = {
  title: "Sistema de Producción",
  description: "App de producción",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-gray-100">
        <TopNav />
        {children}
      </body>
    </html>
  );
}
