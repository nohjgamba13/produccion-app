"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";

type Role = "admin" | "supervisor" | "operator" | null;

const PROFILES_TABLE = "profiles";
const ORDERS_TABLE = "ordenes_de_produccion";

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
  status: string | null; // active / completed
  order_type: string | null; // venta / produccion
  current_stage: string | null;
  due_date: string | null;
  created_at: string | null;
};

function isOverdue(due?: string | null, status?: string | null) {
  if (!due) return false;
  if ((status ?? "").toLowerCase() === "completed") return false;
  try {
    const today0 = new Date();
    today0.setHours(0, 0, 0, 0);
    return new Date(due).getTime() < today0.getTime();
  } catch {
    return false;
  }
}

function yyyyMm(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<Role>(null);
  const [user, setUser] = useState<any>(null);

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  // filtros simples
  const [onlyActive, setOnlyActive] = useState(false); // si lo activas, reporta solo activas
  const [onlyOverdue, setOnlyOverdue] = useState(false);

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

      if (r !== "admin" && r !== "supervisor") {
        window.location.href = "/";
        return;
      }

      await loadOrders();
    } catch (e: any) {
      setErrorMsg(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async () => {
    setErrorMsg("");

    const res = await supabase
      .from(ORDERS_TABLE)
      .select("id, status, order_type, current_stage, due_date, created_at")
      .order("created_at", { ascending: false });

    if (res.error) {
      setErrorMsg("Error cargando órdenes: " + res.error.message);
      setOrders([]);
      return;
    }

    setOrders((res.data ?? []) as OrderRow[]);
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (onlyActive && (o.status ?? "") !== "active") return false;
      if (onlyOverdue && !isOverdue(o.due_date, o.status)) return false;
      return true;
    });
  }, [orders, onlyActive, onlyOverdue]);

  // KPIs
  const kpis = useMemo(() => {
    const total = filteredOrders.length;
    const active = filteredOrders.filter((o) => (o.status ?? "") === "active").length;
    const completed = filteredOrders.filter((o) => (o.status ?? "") === "completed").length;
    const overdue = filteredOrders.filter((o) => isOverdue(o.due_date, o.status)).length;
    return { total, active, completed, overdue };
  }, [filteredOrders]);

  // Órdenes por etapa (bar)
  const byStage = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of STAGES) map[s] = 0;
    for (const o of filteredOrders) {
      const st = (o.current_stage ?? "venta") as string;
      map[st] = (map[st] ?? 0) + 1;
    }
    return STAGES.map((s) => ({ stage: STAGE_LABEL[s], count: map[s] ?? 0 }));
  }, [filteredOrders]);

  // Órdenes por tipo (pie)
  const byType = useMemo(() => {
    let venta = 0;
    let produccion = 0;
    for (const o of filteredOrders) {
      const t = (o.order_type ?? "").toLowerCase();
      if (t === "produccion") produccion++;
      else if (t === "venta") venta++;
    }
    return [
      { name: "Venta", value: venta },
      { name: "Producción", value: produccion },
    ];
  }, [filteredOrders]);

  // Completadas por mes (últimos 6 meses)
  const completedByMonth = useMemo(() => {
    const now = new Date();
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(yyyyMm(d));
    }

    const map: Record<string, number> = {};
    for (const m of months) map[m] = 0;

    for (const o of filteredOrders) {
      if ((o.status ?? "") !== "completed") continue;
      if (!o.created_at) continue;
      const d = new Date(o.created_at);
      const key = yyyyMm(d);
      if (map[key] !== undefined) map[key] += 1;
    }

    return months.map((m) => ({ month: m, completed: map[m] ?? 0 }));
  }, [filteredOrders]);

  if (loading) return <div className="p-6">Cargando reportes...</div>;

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Reportes</h1>
            <div className="text-sm text-gray-600">
              Usuario: <b>{user?.email ?? "-"}</b> — Rol: <b>{role ?? "sin rol"}</b>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button className="border px-3 py-2 rounded-xl bg-white" onClick={() => (window.location.href = "/")}>
              ← Volver
            </button>
            <button className="border px-3 py-2 rounded-xl bg-white" onClick={loadOrders}>
              Recargar
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-4 border border-red-300 bg-red-50 text-red-700 rounded-2xl p-3 text-sm">
            <b>Error:</b> {errorMsg}
          </div>
        )}

        {/* filtros */}
        <div className="mt-4 bg-white border rounded-2xl p-4 flex gap-6 flex-wrap items-center">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} />
            Solo activas
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={onlyOverdue} onChange={(e) => setOnlyOverdue(e.target.checked)} />
            Solo vencidas
          </label>
        </div>

        {/* KPIs */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Total", value: kpis.total },
            { label: "Activas", value: kpis.active },
            { label: "Completadas", value: kpis.completed },
            { label: "Vencidas", value: kpis.overdue },
          ].map((k) => (
            <div key={k.label} className="bg-white border rounded-2xl p-4">
              <div className="text-sm text-gray-600">{k.label}</div>
              <div className="text-3xl font-bold">{k.value}</div>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="bg-white border rounded-2xl p-4">
            <div className="font-semibold mb-3">Órdenes por etapa</div>
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer>
                <BarChart data={byStage}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="stage" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white border rounded-2xl p-4">
            <div className="font-semibold mb-3">Órdenes por tipo</div>
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={byType} dataKey="value" nameKey="name" outerRadius={110} label>
                    {/* no ponemos colores específicos por regla; Recharts aplicará defaults */}
                    {byType.map((_, idx) => (
                      <Cell key={idx} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white border rounded-2xl p-4 lg:col-span-2">
            <div className="font-semibold mb-3">Completadas por mes (últimos 6 meses)</div>
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer>
                <LineChart data={completedByMonth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="completed" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="mt-4 text-xs text-gray-500">
          Nota: estas gráficas usan la información actual de órdenes. Más adelante podemos añadir tiempos por etapa, productividad por operario y exportar a Excel/PDF.
        </div>
      </div>
    </main>
  );
}