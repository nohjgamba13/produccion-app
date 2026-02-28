"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Role = "admin" | "supervisor" | "operator" | null;

function roleLabel(role: Role) {
  if (role === "admin") return "Administrador";
  if (role === "supervisor") return "Supervisor";
  if (role === "operator") return "Operario";
  return "Sin rol";
}

function roleBadgeClass(role: Role) {
  if (role === "admin") return "bg-indigo-50 text-indigo-700 border-indigo-200";
  if (role === "supervisor") return "bg-blue-50 text-blue-700 border-blue-200";
  if (role === "operator") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  return "bg-gray-50 text-gray-700 border-gray-200";
}

function NavLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        "px-3 py-2 rounded-md text-sm font-medium transition",
        active
          ? "bg-gray-900 text-white"
          : "text-gray-700 hover:bg-gray-100 hover:text-gray-900",
      ].join(" ")}
    >
      {label}
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

        const prof = await supabase
          .from("profiles")
          .select("role")
          .eq("user_id", user.id)
          .single();

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

  const links = useMemo(() => {
    const base = [
      { href: "/", label: "Tablero" },
      { href: "/catalog", label: "Catálogo" },
    ];

    if (canCreateOrder) base.splice(1, 0, { href: "/orders/new", label: "Crear orden" });

    if (isAdmin) {
      base.push({ href: "/admin/users", label: "Usuarios" });
      base.push({ href: "/admin/stages", label: "Módulos" });
    }

    return base;
  }, [canCreateOrder, isAdmin]);

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const showNav = pathname !== "/login" && pathname !== "/register";

  return (
    <div className="sticky top-0 z-50">
      {/* Barra corporativa superior */}
      <div className="h-1 w-full bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700" />

      <header className="w-full bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="h-20 flex items-center justify-between gap-4">
            {/* Izquierda: Logo + Marca */}
            <div className="flex items-center gap-4 min-w-0">
              <Link href="/" className="flex items-center gap-3">
                <Image
                  src="/logo-empresa.png"
                  alt="Logo Empresa"
                  width={160}
                  height={48}
                  priority
                  className="object-contain"
                />
                <div className="hidden sm:block leading-tight">
                  <div className="text-base font-semibold text-gray-900">
                    Sistema de Producción
                  </div>
                  <div className="text-xs text-gray-500">
                    Gestión de órdenes y etapas
                  </div>
                </div>
              </Link>
            </div>

            {/* Centro: Menú */}
            {showNav && (
              <nav className="hidden lg:flex items-center gap-1">
                {links.map((l) => (
                  <NavLink
                    key={l.href}
                    href={l.href}
                    label={l.label}
                    active={pathname === l.href}
                  />
                ))}
              </nav>
            )}

            {/* Derecha: Usuario + Rol + Logout */}
            <div className="flex items-center gap-3">
              {!showNav ? null : (
                <>
                  <div className="hidden md:block text-right leading-tight">
                    <div className="text-sm font-medium text-gray-900">
                      {loading ? "Cargando..." : (userEmail || "—")}
                    </div>
                    <div className="text-xs text-gray-500">Acceso seguro</div>
                  </div>

                  <span
                    className={[
                      "hidden sm:inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-semibold",
                      roleBadgeClass(role),
                    ].join(" ")}
                    title="Rol"
                  >
                    {roleLabel(role)}
                  </span>

                  <button
                    onClick={logout}
                    className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-gray-900 text-white text-sm font-semibold hover:bg-black transition"
                  >
                    Cerrar sesión
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Menú mobile/tablet */}
          {showNav && (
            <div className="lg:hidden pb-3 -mt-1 flex flex-wrap gap-2">
              {links.map((l) => (
                <NavLink
                  key={l.href}
                  href={l.href}
                  label={l.label}
                  active={pathname === l.href}
                />
              ))}
              <span
                className={[
                  "sm:hidden inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-semibold",
                  roleBadgeClass(role),
                ].join(" ")}
              >
                {roleLabel(role)}
              </span>
            </div>
          )}
        </div>
      </header>
    </div>
  );
}