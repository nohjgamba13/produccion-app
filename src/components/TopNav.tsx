"use client";

import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Role = "admin" | "supervisor" | "operator" | null;

export default function TopNav({
  email,
  role,
}: {
  email?: string | null;
  role?: Role;
}) {
  const [open, setOpen] = useState(false);

  const go = (path: string) => {
    setOpen(false);
    window.location.href = path;
  };

  const signOut = async () => {
    await supabase.auth.signOut({ scope: "global" });
    localStorage.clear();
    sessionStorage.clear();
    window.location.replace("/login");
  };

  return (
    <div className="bg-white border-b shadow-sm">
      <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center justify-between gap-3">

        {/* Logo / Nombre */}
        <div className="flex items-center gap-3">
          <div
            className="font-bold text-lg cursor-pointer"
            onClick={() => go("/")}
          >
            Producción
          </div>

          {/* Desktop menu */}
          <div className="hidden md:flex items-center gap-2">
            <button
              className="px-3 py-2 rounded-xl hover:bg-gray-100"
              onClick={() => go("/")}
            >
              Kanban
            </button>

            {(role === "admin" || role === "supervisor") && (
              <button
                className="px-3 py-2 rounded-xl hover:bg-gray-100"
                onClick={() => go("/orders/new")}
              >
                + Crear orden
              </button>
            )}

            <button
              className="px-3 py-2 rounded-xl hover:bg-gray-100"
              onClick={() => go("/catalog")}
            >
              Catálogo
            </button>

            {role === "admin" && (
              <button
                className="px-3 py-2 rounded-xl hover:bg-gray-100"
                onClick={() => go("/admin/users")}
              >
                Usuarios
              </button>
            )}
          </div>
        </div>

        {/* Usuario + acciones */}
        <div className="flex items-center gap-3">

          {/* Desktop info */}
          <div className="hidden md:block text-right">
            <div className="text-sm font-semibold">
              {email ?? "-"}
            </div>
            <div className="text-xs text-gray-600">
              Rol: {role ?? "sin rol"}
            </div>
          </div>

          <button
            onClick={signOut}
            className="hidden md:block border px-3 py-2 rounded-xl hover:bg-gray-100"
          >
            Cerrar sesión
          </button>

          {/* Mobile button */}
          <button
            className="md:hidden border px-3 py-2 rounded-xl"
            onClick={() => setOpen((v) => !v)}
          >
            ☰
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="md:hidden border-t px-4 py-3 space-y-2 bg-white">
          <div className="text-sm font-semibold">
            {email ?? "-"}
          </div>
          <div className="text-xs text-gray-600 mb-2">
            Rol: {role ?? "sin rol"}
          </div>

          <button
            className="w-full text-left px-3 py-2 rounded-xl hover:bg-gray-100"
            onClick={() => go("/")}
          >
            Kanban
          </button>

          {(role === "admin" || role === "supervisor") && (
            <button
              className="w-full text-left px-3 py-2 rounded-xl hover:bg-gray-100"
              onClick={() => go("/orders/new")}
            >
              + Crear orden
            </button>
          )}

          <button
            className="w-full text-left px-3 py-2 rounded-xl hover:bg-gray-100"
            onClick={() => go("/catalog")}
          >
            Catálogo
          </button>

          {role === "admin" && (
            <button
              className="w-full text-left px-3 py-2 rounded-xl hover:bg-gray-100"
              onClick={() => go("/admin/users")}
            >
              Usuarios
            </button>
          )}

          <button
            className="w-full text-left border px-3 py-2 rounded-xl"
            onClick={signOut}
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

