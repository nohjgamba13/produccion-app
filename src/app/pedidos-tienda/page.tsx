'use client';

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Role = "admin" | "supervisor" | "operator" | "ventas_tienda" | null;

type Pedido = {
  id: string;
  fecha_entrega: string;
  notas: string | null;
  status: string;
  current_stage: string;
  created_at: string;
  tienda_id: string;
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

function stageLabel(value: string) {
  if (value === "crear_orden") return "Crear orden";
  if (value === "editar_aprobar_rechazar") return "Editar y aprobar/rechazar";
  if (value === "entregar_orden") return "Entregar orden";
  return value;
}

export default function PedidosTiendaPage() {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [role, setRole] = useState<Role>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [tiendas, setTiendas] = useState<Record<string, Tienda>>({});
  const [search, setSearch] = useState("");

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

      const pres = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (pres.error) throw pres.error;

      const r = (pres.data?.role ?? null) as Role;
      setRole(r);

      if (!(r === "admin" || r === "supervisor" || r === "ventas_tienda")) {
        setErrorMsg("No tienes permisos para ver pedidos tienda.");
        setLoading(false);
        return;
      }

      const res = await supabase
        .from("pedidos_tienda")
        .select("id, tienda_id, fecha_entrega, notas, status, current_stage, created_at")
        .order("created_at", { ascending: false });

      if (res.error) throw res.error;

      const all = (res.data ?? []) as Pedido[];
      const active = all.filter((p) => !isArchivedStatus(p.status));
      setPedidos(active);

      const tiendaIds = Array.from(new Set(active.map((p) => p.tienda_id).filter(Boolean)));
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pedidos.filter((p) => {
      if (!q) return true;
      const tienda = tiendas[p.tienda_id];
      const hay = `${p.id} ${tienda?.nombre ?? ""} ${tienda?.ciudad ?? ""} ${p.notas ?? ""} ${p.status} ${p.current_stage}`.toLowerCase();
      return hay.includes(q);
    });
  }, [pedidos, tiendas, search]);

  const isAdminOrSupervisor = role === "admin" || role === "supervisor";

  if (loading) return <div className="p-6">Cargando pedidos tienda...</div>;

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white border rounded-2xl p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold">Pedidos tienda</h1>
              <div className="text-sm text-gray-600">
                Módulo independiente para solicitudes de tiendas con 3 etapas.
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Link href="/catalog" className="border px-4 py-2 rounded-xl bg-white">
                Ver catálogo
              </Link>
              {isAdminOrSupervisor && (
                <>
                  <Link href="/pedidos-tienda/admin" className="border px-4 py-2 rounded-xl bg-white">
                    Administrar
                  </Link>
                  <Link href="/pedidos-tienda/consultar" className="border px-4 py-2 rounded-xl bg-white">
                    Cerrados
                  </Link>
                </>
              )}
              <Link href="/pedidos-tienda/new" className="px-4 py-2 rounded-xl bg-black text-white">
                Crear orden
              </Link>
            </div>
          </div>

          {errorMsg && (
            <div className="mt-4 border border-red-300 bg-red-50 text-red-700 rounded-xl p-3 text-sm">
              <b>Error:</b> {errorMsg}
            </div>
          )}

          {!errorMsg && (
            <>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                <input
                  className="border rounded-xl px-3 py-2 bg-white"
                  placeholder="Buscar por tienda, notas, id, estado o etapa..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />

                <div className="text-sm text-gray-600 flex items-center">
                  Activos: <b className="ml-1">{filtered.length}</b>
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
                          <td className="py-3 pr-3">{stageLabel(p.current_stage)}</td>
                          <td className="py-3 pr-3">{p.status}</td>
                          <td className="py-3 pr-3 max-w-[360px]">
                            <div className="line-clamp-2 text-gray-600">{p.notas || "-"}</div>
                          </td>
                          <td className="py-3 pr-3">
                            <Link href={`/pedidos-tienda/${p.id}`} className="underline">
                              Ver detalle
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {filtered.length === 0 && (
                  <div className="text-sm text-gray-500 py-6">
                    No hay pedidos activos con esos filtros.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
