"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Role = "admin" | "supervisor" | "operator" | "operador" | null;

export default function TopNav() {
  const [email, setEmail] = useState<string>("-");
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const ures = await supabase.auth.getUser();
      const u = ures.data.user;

      if (!u) {
        setEmail("-");
        setRole(null);
        setLoading(false);
        return;
      }

      setEmail(u.email ?? "-");

      const pres = await supabase.from("profiles").select("role").eq("user_id", u.id).single();
      setRole((pres.data?.role ?? null) as Role);

      setLoading(false);
    })();
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <header className="w-full bg-white border-b">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="font-bold">Producción</div>
          <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
            {loading ? "Cargando..." : `Rol: ${role ?? "sin rol"}`}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-700">{email}</span>

          <button
            className="border px-3 py-2 rounded-xl bg-white hover:bg-gray-50"
            onClick={() => (window.location.href = "/")}
          >
            Tablero
          </button>

          <button
            className="border px-3 py-2 rounded-xl bg-white hover:bg-gray-50"
            onClick={() => (window.location.href = "/catalog")}
          >
            Catálogo
          </button>

          {role === "admin" && (
            <>
              <button
                className="border px-3 py-2 rounded-xl bg-white hover:bg-gray-50"
                onClick={() => (window.location.href = "/admin/users")}
              >
                Usuarios
              </button>

              <button
                className="border px-3 py-2 rounded-xl bg-white hover:bg-gray-50"
                onClick={() => (window.location.href = "/admin/stages")}
              >
                Módulos
              </button>
            </>
          )}

          <button className="px-3 py-2 rounded-xl bg-black text-white" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </div>
    </header>
  );
}