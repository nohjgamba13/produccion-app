"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  PlusCircle,
  Package,
  Users,
  Blocks,
  LogOut,
  Shield,
  Briefcase,
  User2,
  ClipboardCheck,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";

type Role = "admin" | "supervisor" | "operator" | null;

function roleLabel(role: Role) {
  if (role === "admin") return "Administrador";
  if (role === "supervisor") return "Supervisor";
  if (role === "operator") return "Operario";
  return "Sin rol";
}

function roleBadgeClass(role: Role) {
  if (role === "admin") return "bg-violet-50 text-violet-700 border-violet-200";
  if (role === "supervisor") return "bg-sky-50 text-sky-700 border-sky-200";
  if (role === "operator") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  return "bg-gray-50 text-gray-700 border-gray-200";
}

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  show: boolean;
};

function NavLink({
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
        "inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition",
        active ? "bg-blue-600 text-white shadow-sm" : "text-gray-700 hover:bg-gray-100 hover:text-gray-900",
      ].join(" ")}
    >
      <span className="shrink-0">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

export default function TopNav() {
  const router = useRouter();
  const pathname = usePathname();

  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string>("");
  const [role, setRole] = useState<Role>(null);

  const isAdmin = role === "admin";
  const isSupervisor = role === "supervisor";
  const canCreateOrder = isAdmin || isSupervisor;
  const canViewCompleted = isAdmin || isSupervisor;

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase.auth.getUser();
        const user = data.user;

        if (!alive) return;

        if (!user) {
          setUserEmail("");
          setRole(null);
          setLoading(false);
          return;
        }

        setUserEmail(user.email ?? "");

        const prof = await supabase.from("profiles").select("role").eq("user_id", user.id).single();

        if (!alive) return;

        setRole((prof.data?.role ?? null) as Role);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const items: NavItem[] = useMemo(() => {
    return [
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
        href: "/completed-orders",
        label: "Órdenes completadas",
        icon: <ClipboardCheck size={18} />,
        show: canViewCompleted,
      },
      {
        href: "/catalog",
        label: "Catálogo",
        icon: <Package size={18} />,
        show: true,
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
    ];
  }, [canCreateOrder, canViewCompleted, isAdmin]);

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const showNav = pathname !== "/login" && pathname !== "/register";

  return (
    <div className="sticky top-0 z-50">
      <div className="h-1 w-full bg-gradient-to-r from-blue-700 via-sky-500 to-violet-600" />

      <header className="w-full bg-white/90 backdrop-blur border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="h-20 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <Link href="/" className="flex items-center gap-3">
                <Image
                  src="/logo-empresa.png"
                  alt="Logo Empresa"
                  width={80}
                  height={24}
                  priority
                  className="object-contain"
                />

                <div className="hidden sm:block leading-tight">
                  <div className="text-base font-semibold text-gray-900 flex items-center gap-2">
                    <Briefcase size={18} className="text-blue-600" />
                    <span>Sistema de Producción</span>
                  </div>
                  <div className="text-xs text-gray-500">Órdenes • Etapas • Evidencias</div>
                </div>
              </Link>
            </div>

            {showNav && (
              <nav className="hidden lg:flex items-center gap-1">
                {items
                  .filter((x) => x.show)
                  .map((l) => (
                    <NavLink key={l.href} href={l.href} label={l.label} icon={l.icon} active={pathname === l.href} />
                  ))}
              </nav>
            )}

            <div className="flex items-center gap-3">
              {!showNav ? null : (
                <>
                  <div className="hidden md:flex items-center gap-3 text-right leading-tight">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-sm flex items-center justify-center">
                      <User2 size={18} />
                    </div>

                    <div>
                      <div className="text-sm font-semibold text-gray-900 truncate max-w-[220px]">{loading ? "Cargando..." : userEmail || "Sin sesión"}</div>
                      <div className="flex items-center justify-end gap-2 mt-0.5">
                        <span className={["inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border", roleBadgeClass(role)].join(" ")}>
                          <Shield size={12} />
                          {roleLabel(role)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={logout}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    <LogOut size={16} />
                    <span className="hidden sm:inline">Salir</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {showNav && (
            <div className="lg:hidden pb-3 flex gap-2 overflow-x-auto">
              {items
                .filter((x) => x.show)
                .map((l) => (
                  <NavLink key={l.href} href={l.href} label={l.label} icon={l.icon} active={pathname === l.href} />
                ))}
            </div>
          )}
        </div>
      </header>
    </div>
  );
}
