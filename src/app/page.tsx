"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Role = "admin" | "supervisor" | "operator" | null;

const PROFILES_TABLE = "profiles";
const ORDERS_TABLE = "ordenes_de_produccion";
const ITEMS_TABLE = "orden_items";

const STAGES = ["venta", "diseno", "estampado", "confeccion", "revision_calidad", "despacho"] as const;

const STAGE_LABEL: Record<(typeof STAGES)[number], string> = {
  venta: "Venta",
  diseno: "Diseño",
  estampado: "Estampado",
  confeccion: "Confección",
  revision_calidad: "Revisión y calidad",
  despacho: "Despacho",
};

type OrderRow = {
  id: string;
  display_code_manual: string | null;
  order_type: string | null;
  status: string | null;
  current_stage: string | null;
  client_name: string | null;
  due_date: string | null;
  created_at: string | null;
  quantity: number | null;
};

type OrderItemRow = {
  order_id: string;
  product_name: string;
  category: string;
  qty: number;
  product_image_path: string;
};

function fmtDate(iso?: string | null) {
  if (!iso) return "-";
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return String(iso);
  }
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function daysUntil(due?: string | null) {
  if (!due) return null;
  try {
    const ms = new Date(due).getTime() - startOfToday();
    return Math.floor(ms / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

// PASO 4: semáforo
function dueBadge(due?: string | null, status?: string | null) {
  if ((status ?? "").toLowerCase() === "completed") return { label: "Completada", cls: "bg-green-100 text-green-800" };
  const d = daysUntil(due);
  if (d === null) return { label: "Sin fecha", cls: "bg-gray-100 text-gray-700" };
  if (d < 0) return { label: "Vencida", cls: "bg-red-100 text-red-800" };
  if (d <= 2) return { label: `Por vencer (${d}d)`, cls: "bg-orange-100 text-orange-800" };
  if (d <= 5) return { label: `Próxima (${d}d)`, cls: "bg-yellow-100 text-yellow-800" };
  return { label: `En tiempo (${d}d)`, cls: "bg-emerald-100 text-emerald-800" };
}

// PASO 5: orden urgente primero
function urgencyKey(o: OrderRow) {
  // menor = más urgente
  const st = (o.status ?? "").toLowerCase();
  if (st === "completed") return 999999; // al final
  const d = daysUntil(o.due_date);
  if (d === null) return 500000; // sin fecha después de las urgentes
  return d; // vencidas (<0) quedan primero
}

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<Role>(null);

  // Etapa asignada al operario (PASO 1)
  const [myStage, setMyStage] = useState<string | null>(null);

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [items, setItems] = useState<OrderItemRow[]>([]);

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
      setRole(r);

      // obtener etapa del operario (si aplica)
      if (r === "operator") {
        const st = await supabase.rpc("user_stage", { uid: u.id });
        setMyStage((st.data ?? null) as string | null);
      } else {
        setMyStage(null);
      }

      await loadData(r, u.id);
    } catch (e: any) {
      setErrorMsg(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const loadData = async (r?: Role, uid?: string) => {
    setErrorMsg("");

    // Cargar órdenes
    const ordRes = await supabase
      .from(ORDERS_TABLE)
      .select("id, display_code_manual, order_type, status, current_stage, client_name, due_date, created_at, quantity")
      // PASO 5: en UI ordenamos por urgencia, aquí traemos bastante data
      .limit(500);

    if (ordRes.error) {
      setErrorMsg("Error cargando órdenes: " + ordRes.error.message);
      setOrders([]);
      setItems([]);
      return;
    }

    let ord = (ordRes.data ?? []) as OrderRow[];

    // PASO 1: filtrar visibilidad
    if (r === "operator") {
      const st = await supabase.rpc("user_stage", { uid: uid });
      const stage = (st.data ?? null) as string | null;

      // operario ve SOLO órdenes cuya etapa actual es su etapa
      ord = ord.filter((o) => (o.current_stage ?? "") === (stage ?? ""));
    }

    // PASO 5: ordenar más urgente primero (vencidas, por vencer, etc) + más antiguas primero
    ord.sort((a, b) => {
      const ka = urgencyKey(a);
      const kb = urgencyKey(b);
      if (ka !== kb) return ka - kb;
      const ca = a.created_at ? new Date(a.created_at).getTime() : 0;
      const cb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return ca - cb;
    });

    setOrders(ord);

    // Cargar items de esas órdenes (para mostrar resumen)
    const ids = ord.map((o) => o.id);
    if (ids.length === 0) {
      setItems([]);
      return;
    }

    const itRes = await supabase
      .from(ITEMS_TABLE)
      .select("order_id, product_name, category, qty, product_image_path")
      .in("order_id", ids);

    if (itRes.error) {
      setErrorMsg("Error cargando items: " + itRes.error.message);
      setItems([]);
      return;
    }

    setItems((itRes.data ?? []) as OrderItemRow[]);
  };

  const itemsByOrder = useMemo(() => {
    const map: Record<string, OrderItemRow[]> = {};
    for (const it of items) {
      if (!map[it.order_id]) map[it.order_id] = [];
      map[it.order_id].push(it);
    }
    return map;
  }, [items]);

  const canCreate = role === "admin" || role === "supervisor";

  const openOrder = (id: string) => {
    window.location.href = `/orders/${id}`;
  };

  if (loading) return <div className="p-6">Cargando...</div>;

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white border rounded-2xl p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-2xl font-bold">Tablero</div>
              <div className="text-sm text-gray-600">
                Usuario: <b>{user?.email ?? "-"}</b> — Rol: <b>{role ?? "sin rol"}</b>
                {role === "operator" && (
                  <>
                    {" "}
                    — Módulo: <b>{STAGE_LABEL[(myStage as any) ?? "venta"] ?? myStage ?? "sin asignar"}</b>
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <button className="border px-3 py-2 rounded-xl bg-white" onClick={() => loadData(role, user?.id)}>
                Recargar
              </button>
              <button className="border px-3 py-2 rounded-xl bg-white" onClick={() => (window.location.href = "/catalog")}>
                Catálogo
              </button>
              {(role === "admin") && (
                <button className="border px-3 py-2 rounded-xl bg-white" onClick={() => (window.location.href = "/admin/users")}>
                  Usuarios/Roles
                </button>
              )}
              {canCreate && (
                <button className="px-3 py-2 rounded-xl bg-black text-white" onClick={() => (window.location.href = "/orders/new")}>
                  + Crear orden
                </button>
              )}
            </div>
          </div>

          {errorMsg && (
            <div className="mt-3 border border-red-300 bg-red-50 text-red-700 rounded-xl p-3 text-sm">
              <b>Error:</b> {errorMsg}
            </div>
          )}
        </div>

        {/* Lista ordenada por urgencia (PASO 5) */}
        <div className="mt-4 grid gap-3">
          {orders.map((o) => {
            const badge = dueBadge(o.due_date, o.status);
            const its = itemsByOrder[o.id] ?? [];
            const first = its[0];
            const restCount = Math.max(0, its.length - 1);

            return (
              <button
                key={o.id}
                onClick={() => openOrder(o.id)}
                className="w-full text-left bg-white border rounded-2xl p-4 hover:bg-gray-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-bold truncate">{o.display_code_manual ?? "(sin consecutivo)"}</div>
                    <div className="text-sm text-gray-600 truncate">
                      Cliente: <b>{o.client_name ?? "-"}</b> · Etapa: <b>{STAGE_LABEL[(o.current_stage as any) ?? "venta"] ?? o.current_stage ?? "-"}</b>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs px-2 py-1 rounded-full ${badge.cls}`}>{badge.label}</span>
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                      {String(o.order_type ?? "-").toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  {first?.product_image_path ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={first.product_image_path} alt="Producto" className="w-12 h-12 rounded-xl object-cover border" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl border bg-gray-100" />
                  )}

                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">
                      {its.length === 0 ? "Sin items" : `${first.product_name}${restCount ? ` + ${restCount} más` : ""}`}
                    </div>
                    <div className="text-xs text-gray-600">
                      Cant. total: <b>{o.quantity ?? "-"}</b> · Entrega: <b>{fmtDate(o.due_date)}</b> · Creada: <b>{fmtDate(o.created_at)}</b>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}

          {orders.length === 0 && (
            <div className="text-sm text-gray-500 bg-white border rounded-2xl p-4">
              No hay órdenes para mostrar en tu módulo.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

