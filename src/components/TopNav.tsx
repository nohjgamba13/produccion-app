"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Blocks,
  Briefcase,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Package,
  PlusCircle,
  Shield,
  User2,
  Users,
  CheckCircle2,
  Store,
  Building2,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";

type Role = "admin" | "supervisor" | "operator" | "ventas_tienda" | null;

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  show: boolean;
};

function roleLabel(role: Role) {
  if (role === "admin") return "Administrador";
  if (role === "supervisor") return "Supervisor";
  if (role === "operator") return "Operario";
  if (role === "ventas_tienda") return "Ventas tienda";
  return "Sin rol";
}

function roleBadgeClass(role: Role) {
  if (role === "admin") return "bg-violet-50 text-violet-700 border-violet-200";
  if (role === "supervisor") return "bg-sky-50 text-sky-700 border-sky-200";
  if (role === "operator") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (role === "ventas_tienda") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-gray-50 text-gray-700 border-gray-200";
}

function NavChip({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        "inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border transition whitespace-nowrap",
        active
          ? "bg-blue-600 text-white border-blue-600 shadow-sm"
          : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300",
      ].join(" ")}
    >
      <span className="shrink-0">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

function Section({
  title,
  items,
  pathname,
}: {
  title: string;
  items: NavItem[];
  pathname: string;
}) {
  const visible = items.filter((item) => item.show);
  if (!visible.length) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="text-[11px] uppercase tracking-wide text-gray-500 font-bold px-1">
        {title}
      </div>
      <div className="flex flex-wrap gap-2">
        {visible.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <NavChip
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={active}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function TopNav() {
  const router = useRouter();
  const pathname = usePathname();

  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [role, setRole] = useState<Role>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);

        const { data } = await supabase.auth.getUser();
        const user = data.user;

        if (!mounted) return;

        if (!user) {
          setUserEmail("");
          setRole(null);
          setLoading(false);
          return;
        }

        setUserEmail(user.email ?? "");

        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("user_id", user.id)
          .single();

        if (!mounted) return;
        setRole((profile?.role ?? null) as Role);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const isAdmin = role === "admin";
  const isSupervisor = role === "supervisor";
  const isVentasTienda = role === "ventas_tienda";
  const canCreateOrder = isAdmin || isSupervisor;
  const canSeeCompleted = isAdmin || isSupervisor;
  const canSeePedidosTienda = isAdmin || isSupervisor || isVentasTienda;

  const mainItems = useMemo<NavItem[]>(
    () => [
      {
        href: "/",
        label: "Tablero",
        icon: <LayoutDashboard size={18} />,
        show: true,
      },
      {
        href: "/orders/new",
        label: "Crear orden",
        icon: <PlusCircle size={18} />,
        show: canCreateOrder,
      },
      {
        href: "/catalog",
        label: "Catálogo",
        icon: <Package size={18} />,
        show: true,
      },
    ],
    [canCreateOrder]
  );

  const orderItems = useMemo<NavItem[]>(
    () => [
      {
        href: "/admin/orders",
        label: "Administrar órdenes",
        icon: <ClipboardList size={18} />,
        show: isAdmin,
      },
      {
        href: "/completed-orders",
        label: "Órdenes completadas",
        icon: <CheckCircle2 size={18} />,
        show: canSeeCompleted,
      },
      {
        href: "/pedidos-tienda",
        label: "Pedidos tienda",
        icon: <Store size={18} />,
        show: canSeePedidosTienda,
      },
    ],
    [isAdmin, canSeeCompleted, canSeePedidosTienda]
  );

  const adminItems = useMemo<NavItem[]>(
    () => [
      {
        href: "/admin/tiendas",
        label: "Tiendas",
        icon: <Building2 size={18} />,
        show: isAdmin,
      },
      {
        href: "/admin/users",
        label: "Usuarios",
        icon: <Users size={18} />,
        show: isAdmin,
      },
      {
        href: "/admin/stages",
        label: "Módulos",
        icon: <Blocks size={18} />,
        show: isAdmin,
      },
    ],
    [isAdmin]
  );

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const hideNav = pathname === "/login" || pathname === "/register";

  return (
    <div className="sticky top-0 z-50">
      <div className="h-1 w-full bg-gradient-to-r from-blue-700 via-sky-500 to-violet-600" />

      <header className="w-full bg-white/95 backdrop-blur border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <Link href="/" className="flex items-center gap-3 min-w-0">
                <Image
                  src="/logo-empresa.png"
                  alt="Logo Empresa"
                  width={84}
                  height={28}
                  priority
                  className="object-contain"
                />

                <div className="leading-tight min-w-0">
                  <div className="text-base font-semibold text-gray-900 flex items-center gap-2">
                    <Briefcase size={18} className="text-blue-600" />
                    <span className="truncate">Sistema de Producción</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    Órdenes, pedidos, etapas y seguimiento
                  </div>
                </div>
              </Link>
            </div>

            {!hideNav && (
              <div className="flex items-center gap-3 flex-wrap xl:justify-end">
                <div className="hidden md:flex items-center gap-3 leading-tight">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-sm flex items-center justify-center">
                    <User2 size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {loading ? "Cargando..." : userEmail || "—"}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      <Shield size={14} />
                      <span>Acceso seguro</span>
                    </div>
                  </div>
                </div>

                <span
                  className={[
                    "inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-semibold",
                    roleBadgeClass(role),
                  ].join(" ")}
                  title="Rol"
                >
                  <Shield size={14} />
                  {roleLabel(role)}
                </span>

                <button
                  onClick={logout}
                  className="inline-flex items-center gap-2 justify-center px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition shadow-sm"
                >
                  <LogOut size={18} />
                  <span className="hidden sm:inline">Cerrar sesión</span>
                </button>
              </div>
            )}
          </div>

          {!hideNav && (
            <div className="mt-4 border-t border-gray-100 pt-4 grid gap-4">
              <Section title="General" items={mainItems} pathname={pathname} />
              <Section title="Órdenes y pedidos" items={orderItems} pathname={pathname} />
              <Section title="Administración" items={adminItems} pathname={pathname} />
            </div>
          )}
        </div>
      </header>
    </div>
  );
}
