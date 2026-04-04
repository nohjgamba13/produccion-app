"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Role = "admin" | "supervisor" | "operator" | "operador" | null;

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
  id: number;
  order_id: string;
  product_id: string | null;
  product_name: string;
  product_image_path: string;
  category: string;
  sku: string | null;
  qty: number;
  lead_time_days: number;
  created_at: string;
};

type StageRow = {
  order_id: string;
  stage: string;
  status: string;
  started_at: string | null;
  approved_at: string | null;
  evidence_url: string | null;
  notes: string | null;
};

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

function fmtDate(iso?: string | null) {
  if (!iso) return "-";
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return String(iso);
  }
}

function isStageKey(v: unknown): v is StageKey {
  return typeof v === "string" && (STAGES as readonly string[]).includes(v);
}

function stageLabel(v?: string | null) {
  if (!v) return "-";
  return isStageKey(v) ? STAGE_LABEL[v] : String(v);
}

function statusBadge(status?: string | null) {
  const s = String(status ?? "").toLowerCase();
  if (s === "completed") return { label: "Completada", cls: "bg-green-100 text-green-800" };
  if (s === "approved") return { label: "Aprobada", cls: "bg-emerald-100 text-emerald-800" };
  if (s === "in_progress") return { label: "En progreso", cls: "bg-blue-100 text-blue-800" };
  if (s === "pending") return { label: "Pendiente", cls: "bg-gray-100 text-gray-700" };
  return { label: status || "-", cls: "bg-gray-100 text-gray-700" };
}

export default function CompletedOrdersPage() {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<Role>(null);

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [items, setItems] = useState<OrderItemRow[]>([]);
  const [stages, setStages] = useState<StageRow[]>([]);

  const [q, setQ] = useState("");
  const [saleType, setSaleType] = useState("ALL");
  const [stageFilter, setStageFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const canView = role === "admin" || role === "supervisor";

  useEffect(() => {
    void init();
  }, []);

  useEffect(() => {
    if (!canView) return;

    const reload = () => {
      void loadData();
    };

    const channel = supabase
      .channel("completed-orders-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "ordenes_de_produccion" }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "orden_items" }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "etapas_de_produccion" }, reload)
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [canView]);

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

      const pres = await supabase.from("profiles").select("role").eq("user_id", u.id).single();
      const r = (pres.data?.role ?? null) as Role;
      setRole(r);

      if (!(r === "admin" || r === "supervisor")) {
        window.location.href = "/";
        return;
      }

      await loadData();
    } catch (e: any) {
      setErrorMsg(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    setErrorMsg("");

    const ordRes = await supabase
      .from("ordenes_de_produccion")
      .select("id, display_code_manual, order_type, status, current_stage, client_name, due_date, created_at, quantity")
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (ordRes.error) {
      setErrorMsg("Error cargando órdenes completadas: " + ordRes.error.message);
      setOrders([]);
      setItems([]);
      setStages([]);
      return;
    }

    const orderRows = (ordRes.data ?? []) as OrderRow[];
    setOrders(orderRows);

    const ids = orderRows.map((o) => o.id);
    if (ids.length === 0) {
      setItems([]);
      setStages([]);
      setExpandedId(null);
      return;
    }

    const [itRes, stRes] = await Promise.all([
      supabase
        .from("orden_items")
        .select("id, order_id, product_id, product_name, product_image_path, category, sku, qty, lead_time_days, created_at")
        .in("order_id", ids)
        .order("created_at", { ascending: true }),
      supabase
        .from("etapas_de_produccion")
        .select("order_id, stage, status, started_at, approved_at, evidence_url, notes")
        .in("order_id", ids),
    ]);

    if (itRes.error) {
      setErrorMsg("Error cargando artículos: " + itRes.error.message);
      setItems([]);
    } else {
      setItems((itRes.data ?? []) as OrderItemRow[]);
    }

    if (stRes.error) {
      setErrorMsg((prev) => prev || "Error cargando etapas: " + stRes.error.message);
      setStages([]);
    } else {
      const rows = ((stRes.data ?? []) as StageRow[]).sort(
        (a, b) => STAGES.indexOf(a.stage as StageKey) - STAGES.indexOf(b.stage as StageKey)
      );
      setStages(rows);
    }
  };

  const itemsByOrder = useMemo(() => {
    const map: Record<string, OrderItemRow[]> = {};
    for (const it of items) {
      if (!map[it.order_id]) map[it.order_id] = [];
      map[it.order_id].push(it);
    }
    return map;
  }, [items]);

  const stagesByOrder = useMemo(() => {
    const map: Record<string, StageRow[]> = {};
    for (const st of stages) {
      if (!map[st.order_id]) map[st.order_id] = [];
      map[st.order_id].push(st);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => STAGES.indexOf(a.stage as StageKey) - STAGES.indexOf(b.stage as StageKey));
    }
    return map;
  }, [stages]);

  const orderTypeOptions = useMemo(() => {
    return Array.from(new Set(orders.map((o) => String(o.order_type ?? "").trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [orders]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return orders.filter((o) => {
      if ((o.status ?? "").toLowerCase() !== "completed") return false;

      const its = itemsByOrder[o.id] ?? [];
      const sts = stagesByOrder[o.id] ?? [];

      const haystack = [
        o.display_code_manual,
        o.client_name,
        o.order_type,
        o.current_stage,
        ...its.map((x) => x.product_name),
        ...its.map((x) => x.sku ?? ""),
        ...its.map((x) => x.category),
        ...sts.map((x) => x.notes ?? ""),
      ]
        .join(" ")
        .toLowerCase();

      if (term && !haystack.includes(term)) return false;
      if (saleType !== "ALL" && String(o.order_type ?? "") !== saleType) return false;
      if (stageFilter !== "ALL" && String(o.current_stage ?? "") !== stageFilter) return false;
      if (dateFrom && (!o.created_at || String(o.created_at).slice(0, 10) < dateFrom)) return false;
      if (dateTo && (!o.created_at || String(o.created_at).slice(0, 10) > dateTo)) return false;

      return true;
    });
  }, [orders, itemsByOrder, stagesByOrder, q, saleType, stageFilter, dateFrom, dateTo]);

  if (loading) return <div className="p-6">Cargando órdenes completadas...</div>;

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white border rounded-2xl p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold">Órdenes completadas</h1>
              <div className="text-sm text-gray-600">
                Usuario: <b>{user?.email ?? "-"}</b> · Rol: <b>{role ?? "sin rol"}</b>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Aquí se listan únicamente órdenes finalizadas. El tablero principal ya no las mostrará.
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <button className="border px-3 py-2 rounded-xl bg-white" onClick={() => (window.location.href = "/")}>
                ← Volver al tablero
              </button>
              <button className="border px-3 py-2 rounded-xl bg-white" onClick={() => void loadData()}>
                Recargar
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="mt-3 border border-red-300 bg-red-50 text-red-700 rounded-xl p-3 text-sm">
              <b>Error:</b> {errorMsg}
            </div>
          )}

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <input
              className="border rounded-xl px-3 py-2 w-full"
              placeholder="Buscar por cliente, consecutivo, producto, SKU o notas"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />

            <select className="border rounded-xl px-3 py-2 w-full" value={saleType} onChange={(e) => setSaleType(e.target.value)}>
              <option value="ALL">Todos los canales / tipos</option>
              {orderTypeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {String(opt).toUpperCase()}
                </option>
              ))}
            </select>

            <select className="border rounded-xl px-3 py-2 w-full" value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
              <option value="ALL">Todas las etapas finales</option>
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABEL[s]}
                </option>
              ))}
            </select>

            <input className="border rounded-xl px-3 py-2 w-full" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <input className="border rounded-xl px-3 py-2 w-full" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-600">
            <span className="px-2 py-1 rounded-full bg-gray-100">Resultados: <b>{filtered.length}</b></span>
            <button
              className="border px-3 py-1.5 rounded-xl bg-white"
              onClick={() => {
                setQ("");
                setSaleType("ALL");
                setStageFilter("ALL");
                setDateFrom("");
                setDateTo("");
              }}
            >
              Limpiar filtros
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          {filtered.map((o) => {
            const its = itemsByOrder[o.id] ?? [];
            const sts = stagesByOrder[o.id] ?? [];
            const first = its[0];
            const open = expandedId === o.id;
            const badge = statusBadge(o.status);

            return (
              <div key={o.id} className="bg-white border rounded-2xl overflow-hidden">
                <button
                  className="w-full text-left p-4 hover:bg-gray-50"
                  onClick={() => setExpandedId((prev) => (prev === o.id ? null : o.id))}
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="font-bold truncate">{o.display_code_manual ?? "(sin consecutivo)"}</div>
                      <div className="text-sm text-gray-600 truncate">
                        Cliente: <b>{o.client_name ?? "-"}</b> · Tipo/canal: <b>{String(o.order_type ?? "-").toUpperCase()}</b>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Creada: <b>{fmtDate(o.created_at)}</b> · Entrega: <b>{fmtDate(o.due_date)}</b> · Etapa final: <b>{stageLabel(o.current_stage)}</b>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                      <span className={`text-xs px-2 py-1 rounded-full ${badge.cls}`}>{badge.label}</span>
                      <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">Items: <b>{its.length}</b></span>
                      <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">Cant. total: <b>{o.quantity ?? "-"}</b></span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    {first?.product_image_path ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={first.product_image_path} alt="Producto" className="w-12 h-12 rounded-xl object-cover border" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl border bg-gray-100" />
                    )}

                    <div className="min-w-0 text-sm">
                      <div className="font-semibold truncate">{its.length ? `${first.product_name}${its.length > 1 ? ` + ${its.length - 1} más` : ""}` : "Sin artículos"}</div>
                      <div className="text-xs text-gray-600">Haz clic para {open ? "ocultar" : "ver"} el historial completo de venta a despacho.</div>
                    </div>
                  </div>
                </button>

                {open && (
                  <div className="border-t p-4 grid gap-4 lg:grid-cols-2">
                    <section className="space-y-4">
                      <div>
                        <h2 className="font-semibold">Resumen de la venta</h2>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2 text-sm">
                          <div className="border rounded-xl p-3 bg-gray-50">Cliente: <b>{o.client_name ?? "-"}</b></div>
                          <div className="border rounded-xl p-3 bg-gray-50">Consecutivo: <b>{o.display_code_manual ?? "-"}</b></div>
                          <div className="border rounded-xl p-3 bg-gray-50">Tipo/canal: <b>{String(o.order_type ?? "-").toUpperCase()}</b></div>
                          <div className="border rounded-xl p-3 bg-gray-50">Estado: <b>{o.status ?? "-"}</b></div>
                          <div className="border rounded-xl p-3 bg-gray-50">Fecha creación: <b>{fmtDate(o.created_at)}</b></div>
                          <div className="border rounded-xl p-3 bg-gray-50">Fecha entrega: <b>{fmtDate(o.due_date)}</b></div>
                        </div>
                      </div>

                      <div>
                        <h2 className="font-semibold">Artículos vendidos</h2>
                        <div className="mt-2 space-y-2">
                          {its.length === 0 && <div className="text-sm text-gray-500">Sin artículos registrados.</div>}
                          {its.map((it) => (
                            <div key={it.id} className="border rounded-2xl p-3 flex gap-3">
                              {it.product_image_path ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={it.product_image_path} alt={it.product_name} className="w-16 h-16 rounded-xl object-cover border shrink-0" />
                              ) : (
                                <div className="w-16 h-16 rounded-xl border bg-gray-100 shrink-0" />
                              )}
                              <div className="min-w-0 text-sm">
                                <div className="font-semibold">{it.product_name}</div>
                                <div className="text-gray-600">SKU: <b>{it.sku ?? "-"}</b> · Categoría: <b>{it.category ?? "-"}</b></div>
                                <div className="text-gray-600">Cantidad: <b>{it.qty}</b> · Lead time: <b>{it.lead_time_days}</b> días</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </section>

                    <section>
                      <h2 className="font-semibold">Proceso completo: venta a despacho</h2>
                      <div className="mt-2 space-y-3">
                        {sts.length === 0 && <div className="text-sm text-gray-500">No hay etapas registradas.</div>}
                        {sts.map((st) => {
                          const sb = statusBadge(st.status);
                          return (
                            <div key={`${st.order_id}-${st.stage}`} className="border rounded-2xl p-4 bg-gray-50">
                              <div className="flex items-start justify-between gap-3 flex-wrap">
                                <div>
                                  <div className="font-semibold">{stageLabel(st.stage)}</div>
                                  <div className="text-xs text-gray-600 mt-1">
                                    Inicio: <b>{fmtDate(st.started_at)}</b> · Aprobación: <b>{fmtDate(st.approved_at)}</b>
                                  </div>
                                </div>
                                <span className={`text-xs px-2 py-1 rounded-full ${sb.cls}`}>{sb.label}</span>
                              </div>

                              <div className="mt-3 text-sm text-gray-700 whitespace-pre-wrap">
                                <b>Notas:</b> {st.notes?.trim() ? st.notes : "Sin notas"}
                              </div>

                              <div className="mt-3 text-sm">
                                {st.evidence_url ? (
                                  <a className="underline" href={st.evidence_url} target="_blank" rel="noreferrer">
                                    Ver evidencia de {stageLabel(st.stage)}
                                  </a>
                                ) : (
                                  <span className="text-gray-500">Sin evidencia adjunta</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  </div>
                )}
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="text-sm text-gray-500 bg-white border rounded-2xl p-4">
              No hay órdenes completadas que coincidan con los filtros.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
