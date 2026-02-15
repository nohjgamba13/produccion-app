"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Role = "admin" | "supervisor" | "operator" | null;

const PROFILES_TABLE = "profiles";

type ProfileRow = {
  user_id: string;
  full_name: string | null; // en tu caso a veces guardas email aquí
  role: "admin" | "supervisor" | "operator" | null;
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

  // crear perfil manual (por si alguien no aparece)
  const [newUserId, setNewUserId] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "supervisor" | "operator">("operator");

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
      setUser(u);

      if (!u) {
        window.location.href = "/login";
        return;
      }

      const pres = await supabase.from(PROFILES_TABLE).select("role").eq("user_id", u.id).single();
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
    setErrorMsg("");
    const res = await supabase
      .from(PROFILES_TABLE)
      .select("user_id, full_name, role, is_active, created_at")
      .order("created_at", { ascending: false });

    if (res.error) {
      setErrorMsg("No pude cargar profiles: " + res.error.message);
      setRows([]);
      return;
    }
    setRows((res.data ?? []) as ProfileRow[]);
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => {
      const hay = `${r.full_name ?? ""} ${r.user_id} ${r.role ?? ""}`.toLowerCase();
      return hay.includes(s);
    });
  }, [rows, q]);

  const updateRole = async (user_id: string, role: "admin" | "supervisor" | "operator") => {
    setSavingId(user_id);
    setErrorMsg("");
    try {
      const up = await supabase.from(PROFILES_TABLE).update({ role }).eq("user_id", user_id);
      if (up.error) throw up.error;
      await loadProfiles();
    } catch (e: any) {
      setErrorMsg(e?.message ?? String(e));
      alert("Error actualizando rol: " + (e?.message ?? String(e)));
    } finally {
      setSavingId(null);
    }
  };

  const toggleActive = async (user_id: string, current: boolean | null) => {
    setSavingId(user_id);
    setErrorMsg("");
    try {
      const up = await supabase.from(PROFILES_TABLE).update({ is_active: !current }).eq("user_id", user_id);
      if (up.error) throw up.error;
      await loadProfiles();
    } catch (e: any) {
      setErrorMsg(e?.message ?? String(e));
      alert("Error actualizando activo: " + (e?.message ?? String(e)));
    } finally {
      setSavingId(null);
    }
  };

  const createProfile = async () => {
    setErrorMsg("");

    const uid = newUserId.trim();
    if (!uid) return alert("Pega el user_id del usuario (UUID).");
    if (!/^[0-9a-fA-F-]{36}$/.test(uid)) return alert("El user_id debe ser un UUID válido (36 caracteres).");

    setSavingId(uid);
    try {
      const ins = await supabase.from(PROFILES_TABLE).insert({
        user_id: uid,
        full_name: newName.trim() ? newName.trim() : null,
        role: newRole,
        is_active: true,
      });
      if (ins.error) throw ins.error;

      setNewUserId("");
      setNewName("");
      setNewRole("operator");
      await loadProfiles();
      alert("Perfil creado ✅");
    } catch (e: any) {
      setErrorMsg(e?.message ?? String(e));
      alert("Error creando perfil: " + (e?.message ?? String(e)));
    } finally {
      setSavingId(null);
    }
  };

  if (loading) return <div className="p-6">Cargando...</div>;

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Gestión de Usuarios y Roles</h1>
            <div className="text-sm text-gray-600">
              Sesión: <b>{user?.email ?? "-"}</b> — Rol: <b>{myRole ?? "sin rol"}</b>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button className="border px-3 py-2 rounded-xl bg-white" onClick={() => (window.location.href = "/")}>
              ← Volver
            </button>
            <button className="border px-3 py-2 rounded-xl bg-white" onClick={loadProfiles}>
              Recargar
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-4 border border-red-300 bg-red-50 text-red-700 rounded-2xl p-3 text-sm">
            <b>Error:</b> {errorMsg}
          </div>
        )}

        {/* Crear perfil (opcional) */}
        <div className="mt-4 bg-white border rounded-2xl p-4">
          <div className="font-semibold">Crear perfil (si un usuario no aparece)</div>
          <div className="text-xs text-gray-500 mt-1">
            Esto NO crea el usuario en Auth. Solo crea el registro en <b>profiles</b>. El user_id lo tomas del usuario una vez
            se registre/inicie sesión.
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-[1.2fr_1fr_0.6fr_0.5fr]">
            <input
              className="border p-2 rounded-xl"
              placeholder="user_id (UUID) del usuario"
              value={newUserId}
              onChange={(e) => setNewUserId(e.target.value)}
            />
            <input
              className="border p-2 rounded-xl"
              placeholder="Nombre / email (opcional)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <select className="border p-2 rounded-xl" value={newRole} onChange={(e) => setNewRole(e.target.value as any)}>
              <option value="operator">operator</option>
              <option value="supervisor">supervisor</option>
              <option value="admin">admin</option>
            </select>
            <button className="bg-black text-white rounded-xl px-3 py-2 disabled:opacity-50" onClick={createProfile} disabled={!!savingId}>
              Crear
            </button>
          </div>
        </div>

        {/* Buscador */}
        <div className="mt-4 bg-white border rounded-2xl p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="font-semibold">Usuarios</div>
            <input
              className="border p-2 rounded-xl"
              placeholder="Buscar por nombre/email, id o rol..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="py-2">Usuario</th>
                  <th className="py-2">user_id</th>
                  <th className="py-2">Rol</th>
                  <th className="py-2">Activo</th>
                  <th className="py-2">Creado</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.user_id} className="border-t">
                    <td className="py-2">
                      <div className="font-semibold">{r.full_name ?? "-"}</div>
                    </td>
                    <td className="py-2 font-mono text-xs">{shortId(r.user_id)}</td>
                    <td className="py-2">
                      <select
                        className="border p-2 rounded-xl"
                        value={(r.role ?? "operator") as any}
                        onChange={(e) => updateRole(r.user_id, e.target.value as any)}
                        disabled={savingId === r.user_id}
                      >
                        <option value="operator">operator</option>
                        <option value="supervisor">supervisor</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td className="py-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${r.is_active ? "bg-green-100" : "bg-gray-200"}`}>
                        {r.is_active ? "Sí" : "No"}
                      </span>
                    </td>
                    <td className="py-2 text-xs text-gray-600">{r.created_at ? r.created_at.slice(0, 10) : "-"}</td>
                    <td className="py-2 text-right">
                      <button
                        className="border px-3 py-2 rounded-xl bg-white disabled:opacity-50"
                        onClick={() => toggleActive(r.user_id, r.is_active)}
                        disabled={savingId === r.user_id}
                      >
                        {r.is_active ? "Desactivar" : "Activar"}
                      </button>
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td className="py-6 text-gray-500" colSpan={6}>
                      No hay usuarios con ese filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 text-xs text-gray-500">
            Tip: puedes dar acceso a esta página solo a admin, entrando por: <b>/admin/users</b>
          </div>
        </div>
      </div>
    </main>
  );
}