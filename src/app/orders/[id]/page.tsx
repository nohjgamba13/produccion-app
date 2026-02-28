"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type Role = "admin" | "supervisor" | "operator" | "operador" | null;

const PROFILES_TABLE = "profiles";
const ORDERS_TABLE = "ordenes_de_produccion";
const ITEMS_TABLE = "orden_items";
const STAGES_TABLE = "etapas_de_produccion";

const EVIDENCES_BUCKET = "evidences"; // si tu bucket se llama distinto, cámbialo aquí

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

const STAGE_STATUS = {
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  APPROVED: "approved",
} as const;

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

function dueBadge(due?: string | null, status?: string | null) {
  if ((status ?? "").toLowerCase() === "completed") return { label: "Completada", cls: "bg-green-100 text-green-800" };
  const d = daysUntil(due);
  if (d === null) return { label: "Sin fecha", cls: "bg-gray-100 text-gray-700" };
  if (d < 0) return { label: "Vencida", cls: "bg-red-100 text-red-800" };
  if (d <= 2) return { label: `Por vencer (${d}d)`, cls: "bg-orange-100 text-orange-800" };
  if (d <= 5) return { label: `Próxima (${d}d)`, cls: "bg-yellow-100 text-yellow-800" };
  return { label: `En tiempo (${d}d)`, cls: "bg-emerald-100 text-emerald-800" };
}

function isStageKey(v: any): v is StageKey {
  return STAGES.includes(v);
}

function stageLabel(v?: string | null) {
  if (!v) return "-";
  return isStageKey(v) ? STAGE_LABEL[v] : v;
}

function nextStage(stage: string | null) {
  const i = STAGES.findIndex((s) => s === stage);
  if (i < 0) return null;
  if (i === STAGES.length - 1) return null;
  return STAGES[i + 1];
}

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const orderId = params?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<Role>(null);
  const [myStage, setMyStage] = useState<string | null>(null);

  const [order, setOrder] = useState<OrderRow | null>(null);
  const [items, setItems] = useState<OrderItemRow[]>([]);
  const [stages, setStages] = useState<StageRow[]>([]);

  // Permisos por etapa (para ocultar botón)
  const [canApproveMap, setCanApproveMap] = useState<Record<string, boolean>>({});

  const [uploadingStage, setUploadingStage] = useState<string | null>(null);
  const [fileByStage, setFileByStage] = useState<Record<string, File | null>>({});
  const [notesByStage, setNotesByStage] = useState<Record<string, string>>({});

  const isOperator = role === "operator" || role === "operador";
  const canSeeAll = role === "admin" || role === "supervisor";

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const init = async () => {
    if (!orderId) return;

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

      if (r === "operator" || r === "operador") {
        const st = await supabase.rpc("user_stage", { uid: u.id });
        setMyStage((st.data ?? null) as string | null);
      } else {
        setMyStage(null);
      }

      await loadAll(r, u.id);
    } catch (e: any) {
      setErrorMsg(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const loadAll = async (r?: Role, uid?: string) => {
    setErrorMsg("");

    const o = await supabase
      .from(ORDERS_TABLE)
      .select("id, display_code_manual, order_type, status, current_stage, client_name, due_date, created_at, quantity")
      .eq("id", orderId)
      .single();

    if (o.error) {
      setErrorMsg("No pude cargar la orden: " + o.error.message);
      setOrder(null);
      return;
    }
    setOrder(o.data as OrderRow);

    const it = await supabase
      .from(ITEMS_TABLE)
      .select("id, order_id, product_id, product_name, product_image_path, category, sku, qty, lead_time_days, created_at")
      .eq("order_id", orderId)
      .order("category", { ascending: true })
      .order("created_at", { ascending: true });

    if (it.error) {
      setErrorMsg("No pude cargar items: " + it.error.message);
      setItems([]);
    } else {
      setItems((it.data ?? []) as OrderItemRow[]);
    }

    const st = await supabase
      .from(STAGES_TABLE)
      .select("order_id, stage, status, started_at, approved_at, evidence_url, notes")
      .eq("order_id", orderId);

    if (st.error) {
      setErrorMsg("No pude cargar etapas: " + st.error.message);
      setStages([]);
    } else {
      const rows = (st.data ?? []) as StageRow[];
      rows.sort((a, b) => STAGES.indexOf(a.stage as any) - STAGES.indexOf(b.stage as any));
      setStages(rows);

      const map: Record<string, string> = {};
      for (const s of rows) map[s.stage] = s.notes ?? "";
      setNotesByStage(map);
    }

    if (r === "operator" || r === "operador") {
      const stg = await supabase.rpc("user_stage", { uid });
      setMyStage((stg.data ?? null) as string | null);
    }

    // Cargar permisos por etapa (para ocultar botón)
    if (uid) {
      const perms: Record<string, boolean> = {};
      for (const s of (st.data ?? []) as any[]) {
        const rr = await supabase.rpc("can_approve_stage", { uid, st: s.stage });
        perms[s.stage] = !!rr.data;
      }
      setCanApproveMap(perms);
    }
  };

  const itemsGrouped = useMemo(() => {
    const map: Record<string, OrderItemRow[]> = {};
    for (const it of items) {
      const c = (it.category ?? "").trim() || "Sin categoría";
      if (!map[c]) map[c] = [];
      map[c].push(it);
    }
    return map;
  }, [items]);

  const visibleStages = useMemo(() => {
    if (canSeeAll) return stages;
    if (isOperator) return stages.filter((s) => s.stage === myStage);
    return [];
  }, [stages, canSeeAll, isOperator, myStage]);

  const uploadEvidence = async (stageName: string) => {
    setErrorMsg("");
    const file = fileByStage[stageName];
    if (!file) return alert("Selecciona un archivo primero.");

    setUploadingStage(stageName);

    try {
      const ext = file.name.split(".").pop() || "jpg";
      const safe = `${orderId}/${stageName}-${Date.now()}.${ext}`;

      const up = await supabase.storage.from(EVIDENCES_BUCKET).upload(safe, file, { upsert: true });
      if (up.error) throw up.error;

      const pub = supabase.storage.from(EVIDENCES_BUCKET).getPublicUrl(safe);
      const url = pub.data.publicUrl;
      if (!url) throw new Error("No se pudo obtener URL pública del archivo.");

      const upd = await supabase
        .from(STAGES_TABLE)
        .update({ evidence_url: url })
        .eq("order_id", orderId)
        .eq("stage", stageName);

      if (upd.error) throw upd.error;

      await loadAll(role, user?.id);
      alert("✅ Evidencia subida.");
    } catch (e: any) {
      alert("❌ Error subiendo evidencia: " + (e?.message ?? String(e)));
    } finally {
      setUploadingStage(null);
    }
  };

  const saveNotes = async (stageName: string) => {
    setSaving(true);
    try {
      const upd = await supabase
        .from(STAGES_TABLE)
        .update({ notes: notesByStage[stageName] ?? "" })
        .eq("order_id", orderId)
        .eq("stage", stageName);

      if (upd.error) throw upd.error;

      await loadAll(role, user?.id);
      alert("✅ Notas guardadas.");
    } catch (e: any) {
      alert("❌ Error guardando notas: " + (e?.message ?? String(e)));
    } finally {
      setSaving(false);
    }
  };

  const approve = async (stageName: string) => {
  if (!order) return;

  setErrorMsg("");
  setSaving(true);

  try {
    // ✅ 1 sola llamada: aprueba y avanza la orden en BD
    const res = await supabase.rpc("approve_stage_and_advance", {
  oid: orderId,
  st: stageName,
});

    if (res.error) throw res.error;

    // ✅ Recargar orden y etapas para ver el cambio inmediatamente
    await loadAll(role, user?.id);

    alert("✅ Etapa aprobada. Nueva etapa: " + (res.data ?? ""));
  } catch (e: any) {
    alert("❌ Error aprobando: " + (e?.message ?? String(e)));
  } finally {
    setSaving(false);
  }
};

  if (loading) return <div className="p-6">Cargando orden...</div>;
  if (!order) return <div className="p-6">No se pudo cargar la orden.</div>;

  const badge = dueBadge(order.due_date, order.status);

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white border rounded-2xl p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-2xl font-bold">{order.display_code_manual ?? "(sin consecutivo)"}</div>
              <div className="text-sm text-gray-600">
                Cliente: <b>{order.client_name ?? "-"}</b> · Tipo: <b>{String(order.order_type ?? "-").toUpperCase()}</b>
              </div>
              <div className="text-sm text-gray-600">
                Etapa actual: <b>{stageLabel(order.current_stage)}</b> · Cantidad total: <b>{order.quantity ?? "-"}</b>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded-full ${badge.cls}`}>{badge.label}</span>
                <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                  Entrega: <b>{fmtDate(order.due_date)}</b>
                </span>
                <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                  Creada: <b>{fmtDate(order.created_at)}</b>
                </span>
              </div>

              {isOperator && (
                <div className="text-xs text-gray-500 mt-2">
                  Estás viendo solo tu módulo: <b>{stageLabel(myStage)}</b>
                </div>
              )}
            </div>

            <div className="flex gap-2 flex-wrap">
              <button className="border px-3 py-2 rounded-xl bg-white" onClick={() => (window.location.href = "/")}>
                ← Volver
              </button>
              <button className="border px-3 py-2 rounded-xl bg-white" onClick={() => loadAll(role, user?.id)}>
                Recargar
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="mt-3 border border-red-300 bg-red-50 text-red-700 rounded-xl p-3 text-sm">
              <b>Error:</b> {errorMsg}
            </div>
          )}
        </div>

        {/* Items */}
        <div className="mt-4 bg-white border rounded-2xl p-4">
          <div className="text-lg font-semibold">Artículos de la orden</div>

          {Object.keys(itemsGrouped).length === 0 ? (
            <div className="text-sm text-gray-500 mt-2">Esta orden no tiene artículos.</div>
          ) : (
            <div className="mt-3 space-y-6">
              {Object.keys(itemsGrouped)
                .sort((a, b) => a.localeCompare(b))
                .map((cat) => (
                  <div key={cat}>
                    <div className="flex items-center justify-between">
                      <div className="font-bold">{cat}</div>
                      <span className="text-xs px-2 py-1 rounded-full border bg-white">{itemsGrouped[cat].length}</span>
                    </div>

                    <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {itemsGrouped[cat].map((it) => (
                        <div key={it.id} className="border rounded-2xl overflow-hidden bg-white">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={it.product_image_path} alt={it.product_name} className="w-full h-28 object-cover border-b" />
                          <div className="p-3">
                            <div className="font-semibold">{it.product_name}</div>
                            <div className="text-xs text-gray-600">SKU: {it.sku ?? "-"}</div>
                            <div className="text-xs text-gray-600">
                              Cantidad: <b>{it.qty}</b> · Lead time: <b>{it.lead_time_days} días</b>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Etapas */}
        <div className="mt-4 bg-white border rounded-2xl p-4">
          <div className="text-lg font-semibold">Etapas</div>

          {!canSeeAll && <div className="text-xs text-gray-500 mt-1">* Como operario, solo ves tu etapa asignada.</div>}

          <div className="mt-3 space-y-3">
            {visibleStages.map((s) => {
              const isCurrent = (order.current_stage ?? "") === s.stage;
              const allowed = !!canApproveMap[s.stage];

              const statusPill =
                s.status === STAGE_STATUS.APPROVED
                  ? "bg-green-100 text-green-800"
                  : s.status === STAGE_STATUS.IN_PROGRESS
                  ? "bg-blue-100 text-blue-800"
                  : "bg-gray-100 text-gray-700";

              return (
                <div key={s.stage} className="border rounded-2xl p-4 bg-white">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="font-bold text-lg">
                        {stageLabel(s.stage)}
                        {isCurrent && <span className="ml-2 text-xs px-2 py-1 rounded-full bg-black text-white">Actual</span>}
                      </div>

                      <div className="mt-1 flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-1 rounded-full ${statusPill}`}>{String(s.status).toUpperCase()}</span>
                        <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                          Inicio: <b>{fmtDate(s.started_at)}</b>
                        </span>
                        <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                          Aprobación: <b>{fmtDate(s.approved_at)}</b>
                        </span>
                      </div>

                      {isCurrent && !allowed && (
                        <div className="mt-2 text-xs text-red-600">
                          No tienes permiso para aprobar esta etapa.
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      {/* ✅ Solo se muestra si es etapa actual y tiene permiso */}
                      {isCurrent && allowed && (
                        <button
                          className="px-3 py-2 rounded-xl bg-black text-white disabled:opacity-50"
                          disabled={saving}
                          onClick={() => approve(s.stage)}
                        >
                          {saving ? "Procesando..." : "Aprobar etapa"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Evidencia */}
                  <div className="mt-3 grid gap-2">
                    <div className="text-sm font-semibold">Evidencia</div>

                    {s.evidence_url ? (
                      <a className="text-sm underline" href={s.evidence_url} target="_blank" rel="noreferrer">
                        Ver evidencia
                      </a>
                    ) : (
                      <div className="text-sm text-gray-500">Sin evidencia</div>
                    )}

                    {/* Subida solo para etapa actual */}
                    {isCurrent && (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="file"
                          onChange={(e) => setFileByStage((prev) => ({ ...prev, [s.stage]: e.target.files?.[0] ?? null }))}
                          disabled={uploadingStage === s.stage}
                        />
                        <button
                          className="border px-3 py-2 rounded-xl bg-white disabled:opacity-50"
                          disabled={uploadingStage === s.stage || !fileByStage[s.stage]}
                          onClick={() => uploadEvidence(s.stage)}
                        >
                          {uploadingStage === s.stage ? "Subiendo..." : "Subir evidencia"}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Notas */}
                  <div className="mt-3 grid gap-2">
                    <div className="text-sm font-semibold">Notas</div>
                    <textarea
                      className="border rounded-xl p-3 w-full min-h-[90px]"
                      value={notesByStage[s.stage] ?? ""}
                      onChange={(e) => setNotesByStage((prev) => ({ ...prev, [s.stage]: e.target.value }))}
                      placeholder="Notas de esta etapa..."
                    />
                    <div className="flex gap-2">
                      <button className="border px-3 py-2 rounded-xl bg-white disabled:opacity-50" disabled={saving} onClick={() => saveNotes(s.stage)}>
                        Guardar notas
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {visibleStages.length === 0 && <div className="text-sm text-gray-500">No hay etapas visibles para tu usuario.</div>}
          </div>
        </div>
      </div>
    </main>
  );
}