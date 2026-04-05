"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";

type Role = "admin" | "supervisor" | "operator" | "ventas_tienda" | null;

export default function TopNav() {
  const router = useRouter();
  const pathname = usePathname();

  const [role, setRole] = useState<Role>(null);
  const [email, setEmail] = useState("");

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

  const isAdmin = role === "admin";
  const isSupervisor = role === "supervisor";
  const isVentasTienda = role === "ventas_tienda";

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const NavBtn = ({
    href,
    label,
    icon,
    color,
    show = true,
  }: {
    href: string;
    label: string;
    icon: React.ReactNode;
    color: string;
    show?: boolean;
  }) => {
    if (!show) return null;

    const active = pathname === href;

    return (
      <Link
        href={href}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all
        ${
          active
            ? `${color} text-white border-transparent shadow-md`
            : "bg-white text-gray-700 hover:bg-gray-50"
        }`}
      >
        {icon}
        {label}
      </Link>
    );
  };

  return (
    <div className="bg-white border-b p-4 space-y-4">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Image src="/logo-empresa.png" alt="logo" width={80} height={30} />

          <div>
            <div className="font-bold text-gray-900">
              Sistema de Producción
            </div>
            <div className="text-xs text-gray-500">
              Gestión inteligente de órdenes
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-sm">{email}</div>
          <div className="text-xs bg-gray-100 px-2 py-1 rounded capitalize">
            {role}
          </div>

          <button
            onClick={logout}
            className="bg-gray-900 text-white px-3 py-2 rounded-xl flex items-center gap-2 hover:bg-black"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* FILA 1 */}
      <div className="flex flex-wrap gap-2">
        <NavBtn
          href="/"
          label="Tablero"
          icon={<LayoutDashboard size={16} />}
          color="bg-blue-600"
        />

        <NavBtn
          href="/orders/new"
          label="Crear orden"
          icon={<PlusCircle size={16} />}
          color="bg-indigo-600"
          show={isAdmin || isSupervisor}
        />

        <NavBtn
          href="/catalog"
          label="Catálogo"
          icon={<Package size={16} />}
          color="bg-gray-700"
        />

        <NavBtn
          href="/completed-orders"
          label="Completadas"
          icon={<CheckCircle2 size={16} />}
          color="bg-green-600"
          show={isAdmin || isSupervisor}
        />

        <NavBtn
          href="/pedidos-tienda"
          label="Pedidos tienda"
          icon={<Store size={16} />}
          color="bg-orange-500"
          show={isAdmin || isSupervisor || isVentasTienda}
        />
      </div>

      {/* FILA 2 */}
      <div className="flex flex-wrap gap-2">
        <NavBtn
          href="/admin/orders"
          label="Administrar"
          icon={<ClipboardList size={16} />}
          color="bg-purple-600"
          show={isAdmin}
        />

        <NavBtn
          href="/admin/tiendas"
          label="Tiendas"
          icon={<Building2 size={16} />}
          color="bg-pink-600"
          show={isAdmin}
        />

        <NavBtn
          href="/admin/users"
          label="Usuarios"
          icon={<Users size={16} />}
          color="bg-cyan-600"
          show={isAdmin}
        />

        <NavBtn
          href="/admin/stages"
          label="Módulos"
          icon={<Layers size={16} />}
          color="bg-yellow-500"
          show={isAdmin}
        />

        <NavBtn
          href="/gerencia"
          label="Gerencia"
          icon={<LineChart size={16} />}
          color="bg-red-600"
          show={isAdmin}
        />
      </div>
    </div>
  );
}