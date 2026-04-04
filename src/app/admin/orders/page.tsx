"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Role = "admin" | "supervisor" | "operator" | "operador" | null;

type OrderRow = {
  id: string;
  display_code_manual: string | null;
  client_name: string | null;
  sale_channel: string | null;
  current_stage: string | null;
  status: string | null;
  due_date: string | null;
  created_at: string | null;
  quantity: number | null;
};

const PROFILES_TABLE = "profiles";
const ORDERS_TABLE = "ordenes_de_produccion";
const ITEMS_TABLE = "orden_items";
const STAGES_TABLE = "etapas_de_produccion";
const MUTATION_KEY = "orders:lastMutation";

function fmtDate(value?: string | null) {
  if (!value) return "-";
  try {
    return new Date(value).toISOString().slice(0, 10);
  } catch {
    return String(value);
  }
}

function emitOrdersMutation(type: "delete" | "update" | "create", orderId: string) {
  const payload = { type, orderId, at: Date.now() };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(MUTATION_KEY, JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent("orders-mutated", { detail: payload }));
  }
}

export default function AdminOrdersPage() {
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState<OrderRow[]>([]);

  const loadOrders = useCallback(async () => {
    setErrorMsg("");

    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) {
      window.location.href = "/login";
      return;
    }

    const profileRes = await supabase.from(PROFILES_TABLE).select("role").eq("user_id", user.id).single();
    const role = (profileRes.data?.role ?? null) as Role;

    if (role !== "admin") {
      window.location.href = "/";
      return;
    }

    const res = await supabase
      .from(ORDERS_TABLE)
      .select("id, display_code_manual, client_name, sale_channel, current_stage, status, due_date, created_at, quantity")
      .order("created_at", { ascending: false })
      .limit(500);

    if (res.error) {
      throw new Error("No pude cargar las órdenes: " + res.error.message);
    }

    setOrders((res.data ?? []) as OrderRow[]);
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        await loadOrders();
      } catch (e: any) {
        if (mounted) setErrorMsg(e?.message ?? String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [loadOrders]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;

    return orders.filter((order) => {
      const hay = [
        order.display_code_manual,
        order.client_name,
        order.sale_channel,
        order.current_stage,
        order.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }, [orders, search]);

  const deleteOrder = async (orderId: string) => {
    const ok = window.confirm("¿Seguro que quieres eliminar esta orden? Esta acción no se puede deshacer.");
    if (!ok) return;

    setSavingId(orderId);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const stageDelete = await supabase.from(STAGES_TABLE).delete().eq("order_id", orderId);
      if (stageDelete.error) throw new Error("No pude eliminar las etapas: " + stageDelete.error.message);

      const itemsDelete = await supabase.from(ITEMS_TABLE).delete().eq("order_id", orderId);
      if (itemsDelete.error) throw new Error("No pude eliminar los items: " + itemsDelete.error.message);

      const orderDelete = await supabase.from(ORDERS_TABLE).delete().eq("id", orderId).select("id");
      if (orderDelete.error) throw new Error("No pude eliminar la orden: " + orderDelete.error.message);

      if (!orderDelete.data || orderDelete.data.length === 0) {
        throw new Error(
          "Supabase no eliminó la orden. Normalmente esto pasa por una política RLS de delete/update que no permite al usuario ADMIN borrar registros.",
        );
      }

      setOrders((prev) => prev.filter((order) => order.id !== orderId));
      setSuccessMsg("Orden eliminada correctamente.");
      emitOrdersMutation("delete", orderId);
    } catch (e: any) {
      setErrorMsg(e?.message ?? String(e));
    } finally {
      setSavingId(null);
    }
  };

  if (loading) return <div className="p-6">Cargando órdenes...</div>;

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="bg-white border rounded-2xl p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold">Administrar órdenes</h1>
              <p className="text-sm text-gray-600">Aquí puedes ver, editar y eliminar órdenes creadas en ventas.</p>
            </div>

            <div className="flex gap-2 flex-wrap">
              <button className="border px-3 py-2 rounded-xl bg-white" onClick={() => loadOrders()}>
                Recargar
              </button>
              <Link href="/orders/new" className="px-3 py-2 rounded-xl bg-black text-white">
                + Crear orden
              </Link>
            </div>
          </div>

          <div className="mt-4">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente, consecutivo, canal, etapa o estado"
              className="w-full md:w-[480px] border rounded-xl px-3 py-2"
            />
          </div>

          {errorMsg ? (
            <div className="mt-4 border border-red-300 bg-red-50 text-red-700 rounded-xl p-3 text-sm">{errorMsg}</div>
          ) : null}

          {successMsg ? (
            <div className="mt-4 border border-green-300 bg-green-50 text-green-700 rounded-xl p-3 text-sm">{successMsg}</div>
          ) : null}
        </div>

        <div className="bg-white border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="text-left px-4 py-3">Consecutivo</th>
                  <th className="text-left px-4 py-3">Cliente</th>
                  <th className="text-left px-4 py-3">Canal</th>
                  <th className="text-left px-4 py-3">Etapa</th>
                  <th className="text-left px-4 py-3">Estado</th>
                  <th className="text-left px-4 py-3">Entrega</th>
                  <th className="text-left px-4 py-3">Cantidad</th>
                  <th className="text-right px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => {
                  const busy = savingId === order.id;
                  return (
                    <tr key={order.id} className="border-t">
                      <td className="px-4 py-3 font-semibold">{order.display_code_manual ?? "(sin consecutivo)"}</td>
                      <td className="px-4 py-3">{order.client_name ?? "-"}</td>
                      <td className="px-4 py-3">{order.sale_channel ?? "-"}</td>
                      <td className="px-4 py-3">{order.current_stage ?? "-"}</td>
                      <td className="px-4 py-3">{order.status ?? "-"}</td>
                      <td className="px-4 py-3">{fmtDate(order.due_date)}</td>
                      <td className="px-4 py-3">{order.quantity ?? 0}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/orders/${order.id}`} className="border px-3 py-1.5 rounded-lg bg-white">
                            Ver
                          </Link>
                          <Link href={`/admin/orders/${order.id}/edit`} className="border px-3 py-1.5 rounded-lg bg-white">
                            Editar
                          </Link>
                          <button
                            onClick={() => deleteOrder(order.id)}
                            disabled={busy}
                            className="px-3 py-1.5 rounded-lg bg-red-600 text-white disabled:opacity-60"
                          >
                            {busy ? "Eliminando..." : "Eliminar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">No hay órdenes para mostrar.</div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
