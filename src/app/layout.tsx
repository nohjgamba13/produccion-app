import "./globals.css";
import Layout from "../components/Layout";

export const metadata = {
  title: "Sistema de Producción",
  description: "Gestión de órdenes, pedidos y procesos",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <Layout>{children}</Layout>
      </body>
    </html>
  );
}