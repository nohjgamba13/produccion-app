"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Role = "admin" | "supervisor" | "operator" | "operador" | null;

const PROFILES_TABLE = "profiles";

const STAGES = ["venta", "diseno", "estampado", "confeccion", "revision_calidad", "despacho"] as const;
type StageKey = (typeof STAGES)[number];

const STAGE_LABEL: Record<StageKey, string> = {
  venta: "Venta",
  diseno: "Diseño",
  estampado: "Estampado",
  confeccion: "Confección",
  revision_calidad: "Revisión y calidad",
  despacho: "Despacho",
};

type ProfileRow = {
  user_id: string;
  full_name: string | null;
  role: Role;
  stage: string | null;
  is_active: boolean | null;
  created_at: string | null;
};

function fmtDate(iso?: string | null) {
  if (!iso) return "-";
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return String(iso);
  }
}

function isStageKey(v: any): v is StageKey {
  return STAGES.includes(v);
}

function stageLabel(v?: string | null) {
  if (!v) return "Sin asignar";
  return isStageKey(v) ? STAGE_LABEL[v] : v;
}

export default function AdminStagesPage() {
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const [me, setMe] = useState<any>(null);
  const [myRole, setMyRole] = useState<Role>(null);

  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const init = async () => {
    setLoading(true);
    setErrorMsg("");

    try {
      const ures = await supabase.auth.getUser();
      const u = ures.data.user ?? null;
      setMe(u);

      if (!u) {
        window.location.href = "/login";
        return;
      }

      const pres = await supabase.from(PROFILES_TABLE).select("role").eq("user_id", u.id).single();
      const r = (pres.data?.role ?? null) as Role;
      setMyRole(r);

      if (r !== "admin") {
        setErrorMsg("Acceso denegado: solo ADMIN puede entrar aquí.");
        setRows([]);
        return;
      }

      await loadUsers();
    } catch (e: any) {
      setErrorMsg(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    setErrorMsg("");
    const res = await supabase
      .from(PROFILES_TABLE)
      .select("user_id, full_name, role, stage, is_active, created_at")
      .order("created_at", { ascending: true })
      .limit(500);

    if (res.error) {
      setErrorMsg("No pude cargar usuarios: " + res.error.message);
      setRows([]);
      return;
    }

    setRows((res.data ?? []) as ProfileRow[]);
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;

    return rows.filter((r) => {
      const name = (r.full_name ?? "").toLowerCase();
      const role = (r.role ?? "").toLowerCase();
      const stage = (r.stage ?? "").toLowerCase();
      const id = (r.user_id ?? "").toLowerCase();
      return name.includes(s) || role.includes(s) || stage.includes(s) || id.includes(s);
    });
  }, [rows, q]);

  const updateStage = async (user_id: string, stage: string | null) => {
    setSavingUserId(user_id);
    setErrorMsg("");

    try {
      const upd = await supabase.from(PROFILES_TABLE).update({ stage }).eq("user_id", user_id);
      if (upd.error) throw upd.error;

      await loadUsers();
    } catch (e: any) {
      setErrorMsg("Error asignando módulo: " + (e?.message ?? String(e)));
    } finally {
      setSavingUserId(null);
    }
  };

  const toggleActive = async (user_id: string, next: boolean) => {
    setSavingUserId(user_id);
    setErrorMsg("");

    try {
      const upd = await supabase.from(PROFILES_TABLE).update({ is_active: next }).eq("user_id", user_id);
      if (upd.error) throw upd.error;

      await loadUsers();
    } catch (e: any) {
      setErrorMsg("Error cambiando estado: " + (e?.message ?? String(e)));
    } finally {
      setSavingUserId(null);
    }
  };

  if (loading) return <div className="p-6">Cargando...</div>;

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white border rounded-2xl p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-2xl font-bold">Admin · Asignar módulos</div>
              <div className="text-sm text-gray-600">
                Usuario: <b>{me?.email ?? "-"}</b> · Rol: <b>{myRole ?? "sin rol"}</b>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Aquí asignas a cada usuario la etapa/módulo que puede ver/aprobar.
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <button className="border px-3 py-2 rounded-xl bg-white" onClick={() => (window.location.href = "/")}>
                ← Volver
              </button>
              <button className="border px-3 py-2 rounded-xl bg-white" onClick={loadUsers}>
                Recargar
              </button>
              <button className="border px-3 py-2 rounded-xl bg-white" onClick={() => (window.location.href = "/admin/users")}>
                Roles/Usuarios
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="mt-3 border border-red-300 bg-red-50 text-red-700 rounded-xl p-3 text-sm">
              <b>Error:</b> {errorMsg}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input
              className="border rounded-xl px-3 py-2 w-full sm:w-80"
              placeholder="Buscar por nombre, rol, módulo o id..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <div className="text-xs text-gray-500">
              Total: <b>{filtered.length}</b>
            </div>
          </div>
        </div>

        <div className="mt-4 bg-white border rounded-2xl overflow-hidden">
          <div className="p-3 border-b text-sm font-semibold">Usuarios</div>

          <div className="divide-y">
            {filtered.map((u) => {
              const busy = savingUserId === u.user_id;

              return (
                <div key={u.user_id} className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">
                      {u.full_name ?? "(sin nombre)"}{" "}
                      <span className="text-xs text-gray-500">({u.user_id.slice(0, 8)}...)</span>
                    </div>
                    <div className="text-xs text-gray-600">
                      Rol: <b>{u.role ?? "sin rol"}</b> · Módulo: <b>{stageLabel(u.stage)}</b> · Creado: <b>{fmtDate(u.created_at)}</b>
                    </div>
                    <div className="text-xs mt-1">
                      Estado:{" "}
                      {u.is_active === false ? (
                        <span className="px-2 py-1 rounded-full bg-red-100 text-red-800">Inactivo</span>
                      ) : (
                        <span className="px-2 py-1 rounded-full bg-green-100 text-green-800">Activo</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 items-center">
                    <select
                      className="border rounded-xl px-3 py-2"
                      value={u.stage ?? ""}
                      disabled={busy}
                      onChange={(e) => updateStage(u.user_id, e.target.value ? e.target.value : null)}
                    >
                      <option value="">Sin asignar</option>
                      {STAGES.map((s) => (
                        <option key={s} value={s}>
                          {STAGE_LABEL[s]}
                        </option>
                      ))}
                    </select>

                    <button
                      className="border px-3 py-2 rounded-xl bg-white disabled:opacity-50"
                      disabled={busy}
                      onClick={() => toggleActive(u.user_id, !(u.is_active !== false))}
                      title="Activar/Desactivar usuario"
                    >
                      {busy ? "Guardando..." : u.is_active === false ? "Activar" : "Desactivar"}
                    </button>
                  </div>
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="p-4 text-sm text-gray-500">
                No hay usuarios para mostrar (o el filtro no encontró coincidencias).
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}