'use client';

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Role = "admin" | "supervisor" | "operator" | "ventas_tienda" | null;

type Pedido = {
  id: string;
  tienda_id: string;
  fecha_entrega: string;
  notas: string | null;
  status: string;
  current_stage: string;
  created_at: string;
};

type Tienda = {
  id: string;
  nombre: string | null;
  ciudad: string | null;
};

function getErrorMessage(error: unknown) {
  if (!error) return "Error desconocido.";
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "object") {
    const e = error as { message?: string; details?: string; hint?: string; code?: string };
    return e.message || e.details || e.hint || e.code || JSON.stringify(error);
  }
  return String(error);
}

function isArchivedStatus(status: string) {
  const s = status.toLowerCase();
  return s === "approved" || s === "delivered" || s === "rejected" || s === "closed";
}

export default function ClosedPedidosTiendaPage() {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [tiendas, setTiendas] = useState<Record<string, Tienda>>({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("__all__");

  useEffect(() => {
    void init();
  }, []);

  const init = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        window.location.href = "/login";
        return;
      }

      const profileRes = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (profileRes.error) throw profileRes.error;

      const role = profileRes.data?.role as Role;
      if (!(role === "admin" || role === "supervisor")) {
        setErrorMsg("No tienes permisos para consultar pedidos cerrados.");
        setLoading(false);
        return;
      }

      const pedidosRes = await supabase
        .from("pedidos_tienda")
        .select("id, tienda_id, fecha_entrega, notas, status, current_stage, created_at")
        .order("created_at", { ascending: false });

      if (pedidosRes.error) throw pedidosRes.error;

      const all = (pedidosRes.data ?? []) as Pedido[];
      const archived = all.filter((p) => isArchivedStatus(p.status));
      setPedidos(archived);

      const tiendaIds = Array.from(new Set(archived.map((p) => p.tienda_id).filter(Boolean)));
      if (tiendaIds.length) {
        const tiendasRes = await supabase.from("tiendas").select("id, nombre, ciudad").in("id", tiendaIds);
        if (tiendasRes.error) throw tiendasRes.error;

        const map: Record<string, Tienda> = {};
        for (const t of (tiendasRes.data ?? []) as Tienda[]) map[t.id] = t;
        setTiendas(map);
      } else {
        setTiendas({});
      }
    } catch (e: unknown) {
      setErrorMsg(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const statuses = useMemo(() => Array.from(new Set(pedidos.map((p) => p.status))), [pedidos]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pedidos.filter((p) => {
      if (statusFilter !== "__all__" && p.status !== statusFilter) return false;
      if (!q) return true;
      const tienda = tiendas[p.tienda_id];
      const hay = `${p.id} ${tienda?.nombre ?? ""} ${tienda?.ciudad ?? ""} ${p.notas ?? ""} ${p.status} ${p.current_stage}`.toLowerCase();
      return hay.includes(q);
    });
  }, [pedidos, tiendas, search, statusFilter]);

  if (loading) return <div className="p-6">Cargando consulta...</div>;

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white border rounded-2xl p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold">Pedidos tienda cerrados</h1>
              <div className="text-sm text-gray-600">
                Consulta pedidos aprobados, entregados o rechazados.
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Link href="/pedidos-tienda" className="border px-4 py-2 rounded-xl bg-white">
                Volver al módulo
              </Link>
              <Link href="/pedidos-tienda/admin" className="border px-4 py-2 rounded-xl bg-white">
                Administración
              </Link>
            </div>
          </div>

          {errorMsg && (
            <div className="mt-4 border border-red-300 bg-red-50 text-red-700 rounded-xl p-3 text-sm">
              <b>Error:</b> {errorMsg}
            </div>
          )}

          <div className="mt-4 grid grid-cols-1 md:grid-cols-[1fr_220px_auto] gap-3">
            <input
              className="border rounded-xl px-3 py-2 bg-white"
              placeholder="Buscar por tienda, notas, id, estado o etapa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select
              className="border rounded-xl px-3 py-2 bg-white"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="__all__">Todos los estados</option>
              {statuses.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <div className="text-sm text-gray-600 flex items-center">
              Total: <b className="ml-1">{filtered.length}</b>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-3 pr-3">Tienda</th>
                  <th className="py-3 pr-3">Entrega</th>
                  <th className="py-3 pr-3">Etapa</th>
                  <th className="py-3 pr-3">Estado</th>
                  <th className="py-3 pr-3">Notas</th>
                  <th className="py-3 pr-3">Acción</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const tienda = tiendas[p.tienda_id];
                  return (
                    <tr key={p.id} className="border-b last:border-0 align-top">
                      <td className="py-3 pr-3">
                        <div className="font-medium">{tienda?.nombre ?? "-"}</div>
                        <div className="text-xs text-gray-500">{tienda?.ciudad ?? ""}</div>
                      </td>
                      <td className="py-3 pr-3">{p.fecha_entrega}</td>
                      <td className="py-3 pr-3">{p.current_stage}</td>
                      <td className="py-3 pr-3">{p.status}</td>
                      <td className="py-3 pr-3 max-w-[360px]">
                        <div className="line-clamp-2 text-gray-600">{p.notas || "-"}</div>
                      </td>
                      <td className="py-3 pr-3">
                        <Link href={`/pedidos-tienda/${p.id}`} className="underline">
                          Consultar
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filtered.length === 0 && (
              <div className="text-sm text-gray-500 py-6">
                No hay pedidos cerrados con esos filtros.
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
