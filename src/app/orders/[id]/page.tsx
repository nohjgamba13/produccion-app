"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type Role = "admin" | "supervisor" | "operator" | null;

const PROFILES_TABLE = "profiles";
const ORDERS_TABLE = "ordenes_de_produccion";
const ITEMS_TABLE = "orden_items";
const STAGES_TABLE = "etapas_de_produccion";
const EVIDENCES_BUCKET = "evidences";

const STAGES = [
  "venta",
  "diseno",
  "estampado",
  "confeccion",
  "revision_calidad",
  "despacho",
] as const;

type StageKey = (typeof STAGES)[number];

const STAGE_LABEL: Record<StageKey, string> = {
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
  id: number;
  order_id: string;
  product_id: string | null;
  product_name: string;
  product_image_path: string;
  category: string;
  sku: string | null;
  qty: number;
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

function stageLabel(v?: string | null) {
  if (!v) return "-";

  return STAGE_LABEL[v as StageKey] ?? v;
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

  const [notesByStage, setNotesByStage] = useState<
    Record<string, string>
  >({});

  const [fileByStage, setFileByStage] = useState<
    Record<string, File | null>
  >({});

  useEffect(() => {
    void init();
  }, [orderId]);

  const init = async () => {
    if (!orderId) return;

    setLoading(true);

    try {
      const ures = await supabase.auth.getUser();

      const u = ures.data.user;

      if (!u) {
        window.location.href = "/login";
        return;
      }

      setUser(u);

      const pres = await supabase
        .from(PROFILES_TABLE)
        .select("role, stage")
        .eq("user_id", u.id)
        .single();

      if (pres.error) throw pres.error;

      setRole((pres.data?.role ?? null) as Role);

      setMyStage(
        (pres.data?.stage ?? null) as string | null
      );

      await loadAll();
    } catch (e: any) {
      setErrorMsg(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const loadAll = async () => {
    const o = await supabase
      .from(ORDERS_TABLE)
      .select("*")
      .eq("id", orderId)
      .single();

    if (o.error) {
      setErrorMsg(o.error.message);
      return;
    }

    setOrder(o.data as OrderRow);

    const it = await supabase
      .from(ITEMS_TABLE)
      .select("*")
      .eq("order_id", orderId);

    if (!it.error) {
      setItems((it.data ?? []) as OrderItemRow[]);
    }

    const st = await supabase
      .from(STAGES_TABLE)
      .select("*")
      .eq("order_id", orderId);

    if (!st.error) {
      const rows = (st.data ?? []) as StageRow[];

      rows.sort(
        (a, b) =>
          STAGES.indexOf(a.stage as any) -
          STAGES.indexOf(b.stage as any)
      );

      setStages(rows);

      const map: Record<string, string> = {};

      for (const s of rows) {
        map[s.stage] = s.notes ?? "";
      }

      setNotesByStage(map);
    }
  };

  const uploadEvidence = async (
    stageName: string
  ) => {
    const file = fileByStage[stageName];

    if (!file) {
      alert("Selecciona una imagen.");
      return;
    }

    try {
      const filePath = `${orderId}/${Date.now()}-${file.name}`;

      const up = await supabase.storage
        .from(EVIDENCES_BUCKET)
        .upload(filePath, file);

      if (up.error) throw up.error;

      const pub = supabase.storage
        .from(EVIDENCES_BUCKET)
        .getPublicUrl(filePath);

      const url = pub.data.publicUrl;

      const upd = await supabase
        .from(STAGES_TABLE)
        .update({
          evidence_url: url,
        })
        .eq("order_id", orderId)
        .eq("stage", stageName);

      if (upd.error) throw upd.error;

      await loadAll();

      alert("✅ Evidencia subida");
    } catch (e: any) {
      alert(e?.message ?? String(e));
    }
  };

  const saveNotes = async (
    stageName: string
  ) => {
    setSaving(true);

    try {
      const upd = await supabase
        .from(STAGES_TABLE)
        .update({
          notes:
            notesByStage[stageName] ?? "",
        })
        .eq("order_id", orderId)
        .eq("stage", stageName);

      if (upd.error) throw upd.error;

      await loadAll();

      alert("✅ Notas guardadas");
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  const approveStage = async (
    stageName: string
  ) => {
    try {
      const res = await supabase.rpc(
        "approve_stage_and_advance",
        {
          oid: orderId,
          st: stageName,
        }
      );

      if (res.error) throw res.error;

      await loadAll();

      alert("✅ Etapa aprobada");
    } catch (e: any) {
      alert(e?.message ?? String(e));
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        Cargando...
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-6">
        Orden no encontrada.
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-6xl mx-auto space-y-4">

        {/* HEADER */}
        <div className="bg-white border rounded-2xl p-4">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <div className="text-2xl font-bold">
                {order.display_code_manual ??
                  "Sin consecutivo"}
              </div>

              <div className="text-sm text-gray-600">
                Cliente:{" "}
                <b>{order.client_name}</b>
              </div>

              <div className="text-sm text-gray-600">
                Etapa actual:{" "}
                <b>
                  {stageLabel(
                    order.current_stage
                  )}
                </b>
              </div>
            </div>

            <button
              className="border px-3 py-2 rounded-xl bg-white"
              onClick={() =>
                (window.location.href = "/")
              }
            >
              ← Volver
            </button>
          </div>

          {errorMsg && (
            <div className="mt-3 border border-red-300 bg-red-50 text-red-700 rounded-xl p-3 text-sm">
              {errorMsg}
            </div>
          )}
        </div>

        {/* PRODUCTOS */}
        <div className="bg-white border rounded-2xl p-4">
          <div className="text-lg font-bold">
            Productos
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {items.map((it) => (
              <div
                key={it.id}
                className="border rounded-2xl p-3 flex gap-3"
              >
                {it.product_image_path ? (
                  <img
                    src={it.product_image_path}
                    alt={it.product_name}
                    className="w-24 h-24 object-cover rounded-xl border"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-xl border bg-gray-100" />
                )}

                <div>
                  <div className="font-bold">
                    {it.product_name}
                  </div>

                  <div className="text-sm text-gray-600">
                    SKU: {it.sku ?? "-"}
                  </div>

                  <div className="text-sm text-gray-600">
                    Cantidad: {it.qty}
                  </div>

                  <div className="text-sm text-gray-600">
                    Categoría: {it.category}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ETAPAS */}
        <div className="bg-white border rounded-2xl p-4">
          <div className="text-lg font-bold">
            Etapas de producción
          </div>

          <div className="mt-4 space-y-4">
            {stages.map((s) => {
              const isCurrent =
                order.current_stage ===
                s.stage;

              return (
                <div
                  key={s.stage}
                  className="border rounded-2xl p-4"
                >
                  <div className="font-bold text-lg">
                    {stageLabel(s.stage)}
                  </div>

                  <div className="text-sm text-gray-600 mt-1">
                    Estado: <b>{s.status}</b>
                  </div>

                  {/* NOTAS */}
                  <div className="mt-4">
                    <div className="text-sm font-semibold mb-2">
                      Notas de la etapa
                    </div>

                    <textarea
                      className="w-full border rounded-xl p-3 bg-white min-h-[120px]"
                      value={
                        notesByStage[s.stage] ??
                        ""
                      }
                      onChange={(e) =>
                        setNotesByStage(
                          (prev) => ({
                            ...prev,
                            [s.stage]:
                              e.target.value,
                          })
                        )
                      }
                      disabled={!isCurrent}
                    />

                    {isCurrent && (
                      <button
                        className="mt-2 border px-3 py-2 rounded-xl bg-white"
                        onClick={() =>
                          saveNotes(s.stage)
                        }
                        disabled={saving}
                      >
                        Guardar notas
                      </button>
                    )}
                  </div>

                  {/* EVIDENCIA */}
                  <div className="mt-4">
                    {s.evidence_url && (
                      <div className="mb-3">
                        <img
                          src={s.evidence_url}
                          alt="Evidencia"
                          className="max-w-xs rounded-xl border"
                        />
                      </div>
                    )}

                    {isCurrent && (
                      <>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) =>
                            setFileByStage(
                              (prev) => ({
                                ...prev,
                                [s.stage]:
                                  e.target
                                    .files?.[0] ??
                                  null,
                              })
                            )
                          }
                        />

                        <div className="flex gap-2 mt-3">
                          <button
                            className="border px-3 py-2 rounded-xl bg-white"
                            onClick={() =>
                              uploadEvidence(
                                s.stage
                              )
                            }
                          >
                            Subir evidencia
                          </button>

                          <button
                            className="px-3 py-2 rounded-xl bg-black text-white"
                            onClick={() =>
                              approveStage(
                                s.stage
                              )
                            }
                          >
                            Aprobar etapa
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}