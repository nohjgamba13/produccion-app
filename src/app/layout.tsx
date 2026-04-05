import "./globals.css";
import Layout from "../components/Layout";

export default function RootLayout({ children }: any) {
  return (
    <html lang="es">
      <body>
        <Layout>{children}</Layout>
      </body>
    </html>
  );
}
