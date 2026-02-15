"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import TopNav from "../components/TopNav";

type Role = "admin" | "supervisor" | "operator" | null;

const ORDERS_TABLE = "ordenes_de_produccion";
const PROFILES_TABLE = "profiles";

const STAGES = ["venta", "diseno", "estampado", "confeccion", "revision_calidad", "despacho"] as const;

const STAGE_LABEL: Record<(typeof STAGES)[number], string> = {
  venta: "Venta",
  diseno: "Diseño",
  estampado: "Estampado",
  confeccion: "Confección",
  revision_calidad: "Revisión y calidad",
  despacho: "Despacho",
};

export default function HomePage() {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<Role>(null);

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string>("");

  const [boardStatus, setBoardStatus] = useState<"active" | "completed" | "all">("active");

  const didInit = useRef(false);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user?.id) loadOrders(boardStatus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardStatus, user?.id]);

  const init = async () => {
    setLoading(true);
    setPageError("");

    try {
      const userRes = await supabase.auth.getUser();
      const u = userRes.data.user ?? null;
      setUser(u);

      if (!u) {
        window.location.href = "/login";
        return;
      }

      const profRes = await supabase.from(PROFILES_TABLE).select("role").eq("user_id", u.id).single();
      setRole((profRes.data?.role ?? null) as Role);

      await loadOrders(boardStatus);
    } catch (e: any) {
      console.error(e);
      setPageError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async (status: "active" | "completed" | "all") => {
    setPageError("");

    // ✅ usamos display_code_manual
    let q = supabase
      .from(ORDERS_TABLE)
      .select(
        "id, display_code_manual, order_type, status, current_stage, product_name, quantity, client_name, created_at, due_date"
      )
      .order("created_at", { ascending: true });

    if (status !== "all") q = q.eq("status", status);

    const res = await q;
    if (res.error) {
      setPageError(res.error.message);
      setOrders([]);
      return;
    }

    setOrders(res.data ?? []);
  };

  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const s of STAGES) map[s] = [];
    for (const o of orders) {
      const stage = o.current_stage ?? "venta";
      if (!map[stage]) map[stage] = [];
      map[stage].push(o);
    }
    return map;
  }, [orders]);

  if (loading) return <div className="p-6">Cargando...</div>;

  return (
    <main className="min-h-screen bg-gray-100">
      <TopNav email={user?.email} role={role ?? undefined} />

      <div className="p-4">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="bg-white border rounded-xl p-1 flex">
            <button
              className={`px-3 py-2 rounded-lg text-sm ${boardStatus === "active" ? "bg-black text-white" : ""}`}
              onClick={() => setBoardStatus("active")}
            >
              Activas
            </button>
            <button
              className={`px-3 py-2 rounded-lg text-sm ${boardStatus === "completed" ? "bg-black text-white" : ""}`}
              onClick={() => setBoardStatus("completed")}
            >
              Completadas
            </button>
            <button
              className={`px-3 py-2 rounded-lg text-sm ${boardStatus === "all" ? "bg-black text-white" : ""}`}
              onClick={() => setBoardStatus("all")}
            >
              Todas
            </button>
          </div>

          {pageError && (
            <div className="border border-red-300 bg-red-50 text-red-700 rounded-xl p-2 text-sm">
              <b>Error:</b> {pageError}
            </div>
          )}
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.map((stage) => (
            <div key={stage} className="min-w-[290px] bg-white rounded-2xl shadow-sm flex-shrink-0 overflow-hidden">
              <div className="bg-black text-white px-3 py-2">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{STAGE_LABEL[stage]}</div>
                  <div className="text-xs bg-white/20 px-2 py-1 rounded-full">{grouped[stage]?.length ?? 0}</div>
                </div>
              </div>

              <div className="p-3 space-y-3">
                {(grouped[stage] ?? []).map((o) => (
                  <div
                    key={o.id}
                    onClick={() => (window.location.href = "/orders/" + o.id)}
                    className="rounded-xl p-3 cursor-pointer border bg-gray-50 hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-bold text-lg">
                        {o.display_code_manual || "(sin consecutivo)"}
                      </div>
                      <span
                        className={`text-[11px] px-2 py-1 rounded-full ${
                          o.order_type === "produccion" ? "bg-blue-200" : "bg-green-200"
                        }`}
                      >
                        {o.order_type ?? "-"}
                      </span>
                    </div>

                    <div className="text-sm text-gray-700 mt-1">{o.product_name ?? "(sin nombre)"}</div>
                    <div className="text-xs text-gray-500">Cliente: {o.client_name ?? "-"}</div>

                    <div className="flex items-center justify-between mt-2">
                      <div className="text-sm font-semibold">{o.quantity} uds</div>
                      <div className="text-[11px] text-gray-500">{String(o.status ?? "").toUpperCase()}</div>
                    </div>
                  </div>
                ))}

                {(grouped[stage] ?? []).length === 0 && (
                  <div className="text-xs text-gray-400 text-center py-6">Sin órdenes</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}


