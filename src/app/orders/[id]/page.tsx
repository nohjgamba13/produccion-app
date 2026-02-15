"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type Role = "admin" | "supervisor" | "operator" | null;

const ORDERS_TABLE = "ordenes_de_produccion";
const STAGES_TABLE = "etapas_de_produccion";
const PROFILES_TABLE = "profiles";
const EVIDENCE_BUCKET = "evidences";

const STAGES = ["venta", "diseno", "estampado", "confeccion", "revision_calidad", "despacho"] as const;

const STAGE_STATUS = {
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  APPROVED: "approved",
} as const;

const STAGE_LABEL: Record<(typeof STAGES)[number], string> = {
  venta: "Venta",
  diseno: "Diseño",
  estampado: "Estampado",
  confeccion: "Confección",
  revision_calidad: "Revisión y calidad",
  despacho: "Despacho",
};

const NEXT_STAGE: Record<string, string | null> = {
  venta: "diseno",
  diseno: "estampado",
  estampado: "confeccion",
  confeccion: "revision_calidad",
  revision_calidad: "despacho",
  despacho: null,
};

function formatDate(iso?: string | null) {
  if (!iso) return "-";
  try {
    return new Date(iso).toISOString().slice(0, 19).replace("T", " ");
  } catch {
    return String(iso);
  }
}

function isValidHttpUrl(u?: string | null) {
  return !!u && /^https?:\/\//i.test(u);
}

type ProfileLite = {
  user_id: string;
  role: string;
};

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const orderId = params?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<Role>(null);

  const [order, setOrder] = useState<any>(null);
  const [stages, setStages] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const [people, setPeople] = useState<ProfileLite[]>([]);

  const [uploadingStage, setUploadingStage] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadNote, setUploadNote] = useState<string>("");

  const [qcChecked, setQcChecked] = useState(false);

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const init = async () => {
    setLoading(true);
    setErrorMsg("");

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

      // lista de perfiles para asignación (mostramos user_id + role)
      const pplRes = await supabase.from(PROFILES_TABLE).select("user_id, role").order("role", { ascending: true });
      if (!pplRes.error) setPeople((pplRes.data ?? []) as ProfileLite[]);

      await fetchOrder();
    } catch (e: any) {
      setErrorMsg(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const fetchOrder = async () => {
    if (!orderId) return;

    const ordRes = await supabase
      .from(ORDERS_TABLE)
      .select(
        "id, display_code_manual, order_type, status, current_stage, product_id, product_name, product_image_path, quantity, client_name, created_at, due_date"
      )
      .eq("id", orderId)
      .single();

    if (ordRes.error) {
      setErrorMsg("Error cargando orden: " + ordRes.error.message);
      setOrder(null);
      setStages([]);
      return;
    }

    setOrder(ordRes.data);

    const stgRes = await supabase
      .from(STAGES_TABLE)
      .select("id, order_id, stage, status, started_at, approved_at, evidence_url, notes, assigned_user_id, assigned_by, assigned_at")
      .eq("order_id", orderId);

    if (stgRes.error) {
      setErrorMsg("Error cargando etapas: " + stgRes.error.message);
      setStages([]);
      return;
    }

    setStages(stgRes.data ?? []);

    const qc = (stgRes.data ?? []).find((s: any) => s.stage === "revision_calidad");
    setQcChecked(qc?.status === STAGE_STATUS.APPROVED);
  };

  const stageMap = useMemo(() => {
    const map: Record<string, any> = {};
    for (const s of stages) map[s.stage] = s;
    return map;
  }, [stages]);

  const canApprove = role === "admin" || role === "supervisor";
  const canWorkAsSupervisor = role === "admin" || role === "supervisor";

  const isStageActive = (stageKey: string) => {
    const s = stageMap[stageKey];
    if (!s) return order?.current_stage === stageKey && order?.status === "active";
    return s.status === STAGE_STATUS.IN_PROGRESS;
  };

  const isStageApproved = (stageKey: string) => {
    const s = stageMap[stageKey];
    return s?.status === STAGE_STATUS.APPROVED;
  };

  const canOperatorWorkThisStage = (stageKey: string) => {
    const s = stageMap[stageKey];
    if (!s) return false;
    if (!user?.id) return false;

    // supervisor/admin siempre puede trabajar
    if (canWorkAsSupervisor) return true;

    // operario solo si está asignado a esa etapa
    return role === "operator" && s.assigned_user_id === user.id;
  };

  const ensureStageRow = async (stageKey: string) => {
    const existing = stageMap[stageKey];
    if (existing) return existing;

    const initialStatus =
      order?.current_stage === stageKey && order?.status === "active" ? STAGE_STATUS.IN_PROGRESS : STAGE_STATUS.PENDING;

    const ins = await supabase
      .from(STAGES_TABLE)
      .insert({
        order_id: orderId,
        stage: stageKey,
        status: initialStatus,
        started_at: initialStatus === STAGE_STATUS.IN_PROGRESS ? new Date().toISOString() : null,
      })
      .select("id, order_id, stage, status, started_at, approved_at, evidence_url, notes, assigned_user_id, assigned_by, assigned_at")
      .single();

    if (ins.error) throw ins.error;
    return ins.data;
  };

  const activateStage = async (stageKey: string) => {
    const s = await ensureStageRow(stageKey);
    if (s.status === STAGE_STATUS.IN_PROGRESS || s.status === STAGE_STATUS.APPROVED) return;

    const up = await supabase
      .from(STAGES_TABLE)
      .update({ status: STAGE_STATUS.IN_PROGRESS, started_at: new Date().toISOString() })
      .eq("order_id", orderId)
      .eq("stage", stageKey);

    if (up.error) throw up.error;
  };

  const assignStage = async (stageKey: string, assigneeUserId: string | null) => {
    if (!canWorkAsSupervisor) return alert("Solo admin/supervisor puede asignar operarios.");

    setSaving(true);
    setErrorMsg("");

    try {
      await ensureStageRow(stageKey);

      const up = await supabase
        .from(STAGES_TABLE)
        .update({
          assigned_user_id: assigneeUserId,
          assigned_by: user?.id ?? null,
          assigned_at: assigneeUserId ? new Date().toISOString() : null,
        })
        .eq("order_id", orderId)
        .eq("stage", stageKey);

      if (up.error) throw up.error;

      await fetchOrder();
    } catch (e: any) {
      setErrorMsg(e?.message ?? String(e));
      alert("Error asignando: " + (e?.message ?? String(e)));
    } finally {
      setSaving(false);
    }
  };

  const approveStage = async (stageKey: string) => {
    if (!order) return;
    if (!canApprove) return alert("Solo supervisor/admin puede aprobar.");

    if (stageKey === "revision_calidad" && !qcChecked) {
      return alert("Marca 'Revisado y aprobado' para poder aprobar.");
    }

    setSaving(true);
    setErrorMsg("");

    try {
      await ensureStageRow(stageKey);

      const upStage = await supabase
        .from(STAGES_TABLE)
        .update({
          status: STAGE_STATUS.APPROVED,
          approved_at: new Date().toISOString(),
          notes: stageKey === "revision_calidad" ? "QC: revisado y aprobado" : undefined,
        })
        .eq("order_id", orderId)
        .eq("stage", stageKey);

      if (upStage.error) throw upStage.error;

      const next = NEXT_STAGE[stageKey];

      if (next) {
        await activateStage(next);

        const upOrder = await supabase.from(ORDERS_TABLE).update({ current_stage: next }).eq("id", orderId);
        if (upOrder.error) throw upOrder.error;
      } else {
        const upOrder = await supabase.from(ORDERS_TABLE).update({ status: "completed", current_stage: "despacho" }).eq("id", orderId);
        if (upOrder.error) throw upOrder.error;
      }

      await fetchOrder();
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e?.message ?? String(e));
      alert("Error aprobando etapa: " + (e?.message ?? String(e)));
    } finally {
      setSaving(false);
    }
  };

  const uploadEvidence = async () => {
    if (!uploadingStage || !uploadFile || !orderId) return;
    if (uploadingStage === "revision_calidad") return alert("En Revisión y calidad no se sube evidencia (solo check).");

    // permiso para trabajar (operario asignado o supervisor/admin)
    if (!canOperatorWorkThisStage(uploadingStage)) {
      return alert("No tienes permiso para subir evidencia en esta etapa (no estás asignado).");
    }

    setSaving(true);
    setErrorMsg("");

    try {
      await ensureStageRow(uploadingStage);

      const ext = uploadFile.name.split(".").pop() || "bin";
      const safeStage = String(uploadingStage).replace(/[^a-z0-9_]/gi, "_");
      const filePath = `orders/${orderId}/${safeStage}/${Date.now()}.${ext}`;

      const up = await supabase.storage.from(EVIDENCE_BUCKET).upload(filePath, uploadFile, { upsert: true });
      if (up.error) throw up.error;

      const pub = supabase.storage.from(EVIDENCE_BUCKET).getPublicUrl(filePath);
      const publicUrl = pub.data.publicUrl;

      const upStage = await supabase
        .from(STAGES_TABLE)
        .update({ evidence_url: publicUrl, notes: uploadNote || null })
        .eq("order_id", orderId)
        .eq("stage", uploadingStage);

      if (upStage.error) throw upStage.error;

      setUploadFile(null);
      setUploadNote("");
      setUploadingStage(null);

      await fetchOrder();
      alert("Evidencia subida ✅");
    } catch (e: any) {
      setErrorMsg(e?.message ?? String(e));
      alert("❌ Error subiendo evidencia: " + (e?.message ?? String(e)));
    } finally {
      setSaving(false);
    }
  };

  const userLabel = (uid?: string | null) => {
    if (!uid) return "Sin asignar";
    const p = people.find((x) => x.user_id === uid);
    const short = uid.slice(0, 8) + "…";
    return p ? `${p.role} (${short})` : short;
  };

  const stageCard = (stageKey: (typeof STAGES)[number]) => {
    const s = stageMap[stageKey];
    const active = isStageActive(stageKey);
    const approved = isStageApproved(stageKey);
    const needsEvidence = stageKey !== "revision_calidad";

    const canWork = active && !approved && canOperatorWorkThisStage(stageKey);

    return (
      <div key={stageKey} className="border rounded-2xl bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-bold">{STAGE_LABEL[stageKey]}</div>
            <div className="text-xs text-gray-600">
              Estado:{" "}
              <b>
                {s?.status ??
                  (order?.current_stage === stageKey && order?.status === "active" ? STAGE_STATUS.IN_PROGRESS : STAGE_STATUS.PENDING)}
              </b>
            </div>
          </div>

          <div className="flex gap-2">
            {approved && <span className="text-xs px-2 py-1 rounded-full bg-green-100">Aprobada</span>}
            {active && !approved && <span className="text-xs px-2 py-1 rounded-full bg-yellow-100">Activa</span>}
          </div>
        </div>

        <div className="mt-3 text-xs text-gray-600 space-y-1">
          <div>Inicio: {formatDate(s?.started_at)}</div>
          <div>Aprobación: {formatDate(s?.approved_at)}</div>
          <div>Asignado a: <b>{userLabel(s?.assigned_user_id)}</b></div>
        </div>

        {/* Asignación */}
        <div className="mt-3 border rounded-xl p-3 bg-gray-50">
          <div className="text-sm font-semibold">Asignación</div>
          <div className="text-xs text-gray-600">Supervisor/admin puede asignar un operario (opcional).</div>

          <select
            className="border p-2 rounded-xl w-full mt-2"
            disabled={!canWorkAsSupervisor || saving}
            value={s?.assigned_user_id ?? ""}
            onChange={(e) => assignStage(stageKey, e.target.value ? e.target.value : null)}
          >
            <option value="">(Sin asignar)</option>
            {people
              .filter((p) => p.role === "operator" || p.role === "supervisor" || p.role === "admin")
              .map((p) => (
                <option key={p.user_id} value={p.user_id}>
                  {p.role} · {p.user_id.slice(0, 8)}…
                </option>
              ))}
          </select>

          <div className="text-[11px] text-gray-500 mt-2">
            Asignado por: {userLabel(s?.assigned_by)} · {formatDate(s?.assigned_at)}
          </div>
        </div>

        {/* Evidencia */}
        {needsEvidence && (
          <div className="mt-3">
            <div className="text-sm font-semibold">Evidencia</div>

            {s?.evidence_url ? (
              <div className="mt-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.evidence_url} alt="Evidencia" className="w-full max-h-64 object-cover rounded-xl border" />
              </div>
            ) : (
              <div className="text-xs text-gray-500 mt-1">No hay evidencia subida.</div>
            )}

            {canWork && (
              <div className="mt-3 border rounded-xl p-3 bg-gray-50">
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setUploadFile(f);
                    setUploadingStage(stageKey);
                  }}
                />

                <input
                  className="border p-2 rounded-xl w-full mt-2 text-sm"
                  placeholder="Nota (opcional)"
                  value={uploadingStage === stageKey ? uploadNote : ""}
                  onChange={(e) => setUploadNote(e.target.value)}
                />

                <button
                  className="mt-2 border px-3 py-2 rounded-xl bg-white disabled:opacity-50"
                  disabled={saving || uploadingStage !== stageKey || !uploadFile}
                  onClick={uploadEvidence}
                >
                  {saving && uploadingStage === stageKey ? "Subiendo..." : "Subir evidencia"}
                </button>
              </div>
            )}

            {!canWork && active && !approved && (
              <div className="text-xs text-gray-500 mt-2">
                * Para subir evidencia necesitas estar asignado a esta etapa (o ser supervisor/admin).
              </div>
            )}
          </div>
        )}

        {/* QC */}
        {stageKey === "revision_calidad" && (
          <div className="mt-3 border rounded-xl p-3 bg-gray-50">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={qcChecked} onChange={(e) => setQcChecked(e.target.checked)} disabled={approved} />
              Revisado y aprobado
            </label>
          </div>
        )}

        {/* Aprobar */}
        <div className="mt-4">
          <button
            className="border px-3 py-2 rounded-xl bg-black text-white disabled:opacity-50"
            disabled={!canApprove || saving || !active || approved}
            onClick={() => approveStage(stageKey)}
          >
            {saving ? "Guardando..." : "Aprobar etapa"}
          </button>
        </div>
      </div>
    );
  };

  if (loading) return <div className="p-6">Cargando...</div>;
  if (!order) return <div className="p-6 text-red-600">{errorMsg || "No se pudo cargar la orden."}</div>;

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-5xl mx-auto">
        <button className="border px-3 py-2 rounded-xl bg-white" onClick={() => (window.location.href = "/")}>
          ← Volver al tablero
        </button>

        <div className="mt-3 grid gap-4 md:grid-cols-[1fr_320px] items-start">
          <div>
            <h1 className="text-2xl font-bold">{order.display_code_manual || "(sin consecutivo)"}</h1>

            <div className="text-sm text-gray-700">
              Cliente: <b>{order.client_name ?? "-"}</b> — Producto: <b>{order.product_name ?? "-"}</b> — Cantidad:{" "}
              <b>{order.quantity ?? "-"}</b>
            </div>

            <div className="text-xs text-gray-600 mt-1">
              Estado: <b>{order.status ?? "-"}</b> — Etapa actual: <b>{order.current_stage ?? "-"}</b>
            </div>

            {errorMsg && (
              <div className="mt-4 border border-red-300 bg-red-50 text-red-700 rounded-xl p-3 text-sm">
                <b>Error:</b> {errorMsg}
              </div>
            )}
          </div>

          <div className="bg-white border rounded-2xl p-3">
            <div className="text-sm font-semibold mb-2">Imagen del producto</div>
            {isValidHttpUrl(order.product_image_path) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={order.product_image_path} alt="Producto" className="w-full h-44 object-cover rounded-xl border" />
            ) : (
              <div className="text-xs text-gray-500">(No hay una URL válida en product_image_path.)</div>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">{STAGES.map((s) => stageCard(s))}</div>
      </div>
    </main>
  );
}