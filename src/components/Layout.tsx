"use client";

import Image from "next/image";
import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  PlusCircle,
  Package,
  CheckCircle2,
  ClipboardList,
  Store,
  Building2,
  Users,
  Layers,
  LineChart,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";

type Role = "admin" | "supervisor" | "operator" | "ventas_tienda" | null;

export default function Layout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [role, setRole] = useState<Role>(null);
  const [email, setEmail] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return;

      setEmail(user.email ?? "");

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      setRole((profile?.role ?? null) as Role);
    })();
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const isAdmin = role === "admin";
  const isSupervisor = role === "supervisor";
  const isVentasTienda = role === "ventas_tienda";

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const Item = ({
    href,
    label,
    icon,
    show = true,
  }: {
    href: string;
    label: string;
    icon: React.ReactNode;
    show?: boolean;
  }) => {
    if (!show) return null;

    const active = pathname === href;

    return (
      <button
        type="button"
        onClick={() => router.push(href)}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition text-left ${
          active
            ? "bg-blue-600 text-white"
            : "text-gray-700 hover:bg-gray-100"
        }`}
      >
        {icon}
        <span>{label}</span>
      </button>
    );
  };

  const SidebarContent = () => (
    <div className="h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-3 mb-8 pb-4 border-b">
          <Image
            src="/logo-empresa.png"
            alt="Logo"
            width={40}
            height={40}
            className="h-10 w-auto object-contain"
          />
          <div>
            <div className="text-base font-semibold text-gray-900">
              Sistema Producción
            </div>
            <div className="text-xs text-gray-500">
              Gestión empresarial
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Item
            href="/"
            label="Tablero"
            icon={<LayoutDashboard size={18} />}
          />

          <Item
            href="/orders/new"
            label="Crear orden"
            icon={<PlusCircle size={18} />}
            show={isAdmin || isSupervisor}
          />

          <Item
            href="/catalog"
            label="Catálogo"
            icon={<Package size={18} />}
          />

          <Item
            href="/completed-orders"
            label="Completadas"
            icon={<CheckCircle2 size={18} />}
            show={isAdmin || isSupervisor}
          />

          <Item
            href="/pedidos-tienda"
            label="Pedidos tienda"
            icon={<Store size={18} />}
            show={isAdmin || isSupervisor || isVentasTienda}
          />

          {isAdmin && (
            <>
              <div className="mt-4 text-xs text-gray-400 px-1">ADMIN</div>

              <Item
                href="/admin/orders"
                label="Administrar"
                icon={<ClipboardList size={18} />}
              />
              <Item
                href="/admin/tiendas"
                label="Tiendas"
                icon={<Building2 size={18} />}
              />
              <Item
                href="/admin/users"
                label="Usuarios"
                icon={<Users size={18} />}
              />
              <Item
                href="/admin/stages"
                label="Módulos"
                icon={<Layers size={18} />}
              />

              <div className="mt-4 text-xs text-gray-400 px-1">GERENCIA</div>

              <Item
                href="/gerencia"
                label="Panel gerencial"
                icon={<LineChart size={18} />}
              />
            </>
          )}
        </div>
      </div>

      <div className="pt-4 border-t">
        <div className="text-sm text-gray-600 truncate">{email}</div>
        <div className="text-xs text-gray-400 mb-3 capitalize">
          {role ?? "sin rol"}
        </div>

        <button
          onClick={logout}
          className="w-full bg-gray-900 text-white py-2 rounded-xl flex items-center justify-center gap-2 hover:bg-black transition"
        >
          <LogOut size={16} />
          Salir
        </button>
      </div>
    </div>
  );

  const title =
    pathname === "/" ? "tablero" : pathname.replaceAll("/", " / ");

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="lg:hidden h-14 bg-white border-b flex items-center justify-between px-4 sticky top-0 z-40">
        <div className="flex items-center gap-3 min-w-0">
          <Image
            src="/logo-empresa.png"
            alt="Logo"
            width={32}
            height={32}
            className="h-8 w-auto object-contain"
          />
          <div className="font-semibold truncate">Sistema Producción</div>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="p-2 rounded-lg border bg-white"
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/30">
          <button
            type="button"
            aria-label="Cerrar menu"
            className="absolute inset-0"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw] bg-white p-4 shadow-xl overflow-y-auto">
            <SidebarContent />
          </div>
        </div>
      )}

      <div className="lg:flex">
        <aside className="hidden lg:flex lg:w-64 lg:min-h-screen bg-white border-r p-4">
          <SidebarContent />
        </aside>

        <main className="flex-1 min-w-0">
          <div className="hidden lg:flex h-14 bg-white border-b items-center px-6 font-semibold capitalize sticky top-0 z-30">
            {title}
          </div>

          <div className="p-4 lg:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
