"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Role = "admin" | "supervisor" | "operator" | null;

type Stage =
  | "venta"
  | "diseno"
  | "estampado"
  | "confeccion"
  | "revision_calidad"
  | "despacho"
  | null;

const PROFILES_TABLE = "profiles";

const STAGES: Stage[] = [
  "venta",
  "diseno",
  "estampado",
  "confeccion",
  "revision_calidad",
  "despacho",
];

type ProfileRow = {
  user_id: string;
  full_name: string | null;
  role: Role;
  stage: Stage;
  is_active: boolean | null;
  created_at: string | null;
};

function shortId(id: string) {
  return id.slice(0, 8) + "…" + id.slice(-4);
}

export default function AdminUsersPage() {
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const [user, setUser] = useState<any>(null);
  const [myRole, setMyRole] = useState<Role>(null);

  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    setLoading(true);

    try {
      const ures = await supabase.auth.getUser();

      const u = ures.data.user ?? null;

      setUser(u);

      if (!u) {
        window.location.href = "/login";
        return;
      }

      const pres = await supabase
        .from(PROFILES_TABLE)
        .select("role")
        .eq("user_id", u.id)
        .single();

      const r = (pres.data?.role ?? null) as Role;

      setMyRole(r);

      if (r !== "admin") {
        window.location.href = "/";
        return;
      }

      await loadProfiles();
    } catch (e: any) {
      setErrorMsg(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const loadProfiles = async () => {
    const res = await supabase
      .from(PROFILES_TABLE)
      .select(
        "user_id, full_name, role, stage, is_active, created_at"
      )
      .order("created_at", {
        ascending: false,
      });

    if (res.error) {
      setErrorMsg(res.error.message);
      return;
    }

    setRows((res.data ?? []) as ProfileRow[]);
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();

    if (!s) return rows;

    return rows.filter((r) => {
      const hay =
        `${r.full_name ?? ""} ${r.user_id} ${r.role ?? ""} ${r.stage ?? ""}`.toLowerCase();

      return hay.includes(s);
    });
  }, [rows, q]);

  const updateUser = async (
    user_id: string,
    data: Partial<ProfileRow>
  ) => {
    setSavingId(user_id);

    try {
      const up = await supabase
        .from(PROFILES_TABLE)
        .update(data)
        .eq("user_id", user_id);

      if (up.error) throw up.error;

      await loadProfiles();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return <div className="p-6">Cargando...</div>;
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              Gestión de Usuarios
            </h1>

            <div className="text-sm text-gray-600">
              Sesión: {user?.email}
            </div>
          </div>

          <button
            className="border px-3 py-2 rounded-xl bg-white"
            onClick={() => loadProfiles()}
          >
            Recargar
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 bg-red-100 border border-red-300 text-red-700 p-3 rounded-xl">
            {errorMsg}
          </div>
        )}

        <div className="mt-4 bg-white border rounded-2xl p-4">
          <input
            className="border p-2 rounded-xl w-full"
            placeholder="Buscar usuario..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="mt-4 bg-white border rounded-2xl p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="py-2">Usuario</th>
                <th className="py-2">ID</th>
                <th className="py-2">Rol</th>
                <th className="py-2">Módulo</th>
                <th className="py-2">Activo</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((r) => (
                <tr key={r.user_id} className="border-t">
                  <td className="py-2">
                    {r.full_name ?? "-"}
                  </td>

                  <td className="py-2 font-mono text-xs">
                    {shortId(r.user_id)}
                  </td>

                  <td className="py-2">
                    <select
                      className="border p-2 rounded-xl"
                      value={r.role ?? "operator"}
                      disabled={savingId === r.user_id}
                      onChange={(e) =>
                        updateUser(r.user_id, {
                          role: e.target.value as Role,
                        })
                      }
                    >
                      <option value="operator">
                        operator
                      </option>

                      <option value="supervisor">
                        supervisor
                      </option>

                      <option value="admin">
                        admin
                      </option>
                    </select>
                  </td>

                  <td className="py-2">
                    <select
                      className="border p-2 rounded-xl"
                      value={r.stage ?? ""}
                      disabled={savingId === r.user_id}
                      onChange={(e) =>
                        updateUser(r.user_id, {
                          stage:
                            (e.target.value ||
                              null) as Stage,
                        })
                      }
                    >
                      <option value="">
                        Sin módulo
                      </option>

                      {STAGES.map((s) => (
                        <option key={s} value={s ?? ""}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="py-2">
                    <button
                      className={`px-3 py-2 rounded-xl text-white ${
                        r.is_active
                          ? "bg-green-600"
                          : "bg-gray-500"
                      }`}
                      disabled={savingId === r.user_id}
                      onClick={() =>
                        updateUser(r.user_id, {
                          is_active: !r.is_active,
                        })
                      }
                    >
                      {r.is_active
                        ? "Activo"
                        : "Inactivo"}
                    </button>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="py-6 text-center text-gray-500"
                  >
                    No hay usuarios
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}