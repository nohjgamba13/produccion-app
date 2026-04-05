"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type Role = "admin" | "supervisor" | "operator" | "ventas_tienda" | null;

type TiendaInfo = {
  id: string;
  nombre: string | null;
  ciudad: string | null;
};

type Pedido = {
  id: string;
  tienda_id: string;
  fecha_entrega: string;
  notas: string | null;
  status: string;
  current_stage: string;
  rejection_note: string | null;
  approved_at: string | null;
  delivered_at: string | null;
};

type Item = {
  id: string;
  product_id: string;
  qty: number;
  product_name: string | null;
  sku: string | null;
  category: string | null;
  product_image_path: string | null;
};

function getErrorMessage(error: unknown) {
  if (!error) return "Error desconocido.";
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  if (typeof error === "object") {
    const e = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
      error_description?: string;
    };

    return (
      e.message ||
      e.details ||
      e.hint ||
      e.error_description ||
      e.code ||
      JSON.stringify(error)
    );
  }

  return String(error);
}

function stageLabel(value: string) {
  if (value === "crear_orden") return "Crear orden";
  if (value === "editar_aprobar_rechazar") return "Editar y aprobar/rechazar";
  if (value === "entregar_orden") return "Entregar orden";
  return value;
}

function statusBadge(value: string) {
  const v = value.toLowerCase();
  if (v.includes("delivered")) return "bg-emerald-100 text-emerald-800";
  if (v.includes("approved")) return "bg-blue-100 text-blue-800";
  if (v.includes("reject")) return "bg-red-100 text-red-800";
  if (v.includes("pending")) return "bg-amber-100 text-amber-800";
  return "bg-gray-100 text-gray-800";
}

export default function PedidoTiendaDetailPage() {
  const params = useParams<{ id: string | string[] }>();
  const pedidoId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [role, setRole] = useState<Role>(null);
  const [userId, setUserId] = useState("");
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [tienda, setTienda] = useState<TiendaInfo | null>(null);
  const [items, setItems] = useState<Item[]>([]);

  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [rejectNote, setRejectNote] = useState("");

  useEffect(() => {
    if (!pedidoId) {
      setLoading(false);
      setErrorMsg("No se recibió el id del pedido en la ruta.");
      return;
    }

    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoId]);

  const init = async () => {
    if (!pedidoId) return;

    setLoading(true);
    setErrorMsg("");

    try {
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (!user) {
        window.location.href = "/login";
        return;
      }

      setUserId(user.id);

      const pres = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (pres.error) throw pres.error;

      const r = (pres.data?.role ?? null) as Role;
      setRole(r);

      if (!(r === "admin" || r === "supervisor" || r === "ventas_tienda")) {
        setErrorMsg("No tienes permisos para ver este pedido.");
        setLoading(false);
        return;
      }

      const pRes = await supabase
        .from("pedidos_tienda")
        .select(
          "id, tienda_id, fecha_entrega, notas, status, current_stage, rejection_note, approved_at, delivered_at"
        )
        .eq("id", pedidoId)
        .maybeSingle();

      if (pRes.error) throw pRes.error;

      if (!pRes.data) {
        setPedido(null);
        setItems([]);
        setTienda(null);
        setErrorMsg("El pedido no existe o no tienes permisos para verlo.");
        return;
      }

      const ped = pRes.data as Pedido;

      const storeRes = await supabase
        .from("tiendas")
        .select("id, nombre, ciudad")
        .eq("id", ped.tienda_id)
        .maybeSingle();

      if (storeRes.error) throw storeRes.error;

      const itemRes = await supabase
        .from("pedido_tienda_items")
        .select(
          "id, product_id, qty, product_name, sku, category, product_image_path"
        )
        .eq("pedido_id", pedidoId)
        .order("created_at", { ascending: true });

      if (itemRes.error) throw itemRes.error;

      setPedido(ped);
      setTienda((storeRes.data ?? null) as TiendaInfo | null);
      setItems((itemRes.data ?? []) as Item[]);
      setNotes(ped.notas ?? "");
      setDueDate(ped.fecha_entrega ?? "");
      setRejectNote(ped.rejection_note ?? "");
    } catch (e: unknown) {
      setErrorMsg(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const canReview = role === "admin" || role === "supervisor";
  const canEdit =
    role === "admin" || role === "supervisor" || role === "ventas_tienda";

  const totalQty = useMemo(
    () => items.reduce((acc, it) => acc + (it.qty || 0), 0),
    [items]
  );

  const updateQty = (id: string, qty: number) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, qty: Math.max(1, qty || 1) } : it))
    );
  };

  const saveChanges = async () => {
    if (!pedido) return;

    setSaving(true);
    setErrorMsg("");

    try {
      const pUpd = await supabase
        .from("pedidos_tienda")
        .update({
          fecha_entrega: dueDate,
          notas: notes.trim() || null,
        })
        .eq("id", pedido.id);

      if (pUpd.error) throw pUpd.error;

      for (const it of items) {
        const upd = await supabase
          .from("pedido_tienda_items")
          .update({ qty: it.qty })
          .eq("id", it.id);

        if (upd.error) throw upd.error;
      }

      await init();
      alert("Cambios guardados.");
    } catch (e: unknown) {
      setErrorMsg(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const moveToReview = async () => {
    if (!pedido) return;

    setSaving(true);
    setErrorMsg("");

    try {
      const res = await supabase
        .from("pedidos_tienda")
        .update({
          current_stage: "editar_aprobar_rechazar",
          status: "pending_review",
          notas: notes.trim() || null,
          fecha_entrega: dueDate,
        })
        .eq("id", pedido.id);

      if (res.error) throw res.error;
      await init();
    } catch (e: unknown) {
      setErrorMsg(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const approvePedido = async () => {
    if (!pedido) return;

    setSaving(true);
    setErrorMsg("");

    try {
      const res = await supabase
        .from("pedidos_tienda")
        .update({
          current_stage: "entregar_orden",
          status: "approved",
          approved_at: new Date().toISOString(),
          approved_by: userId,
          rejection_note: null,
          notas: notes.trim() || null,
          fecha_entrega: dueDate,
        })
        .eq("id", pedido.id);

      if (res.error) throw res.error;
      await init();
    } catch (e: unknown) {
      setErrorMsg(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const rejectPedido = async () => {
    if (!pedido) return;

    if (!rejectNote.trim()) {
      setErrorMsg("Debes escribir una nota de rechazo.");
      return;
    }

    setSaving(true);
    setErrorMsg("");

    try {
      const res = await supabase
        .from("pedidos_tienda")
        .update({
          current_stage: "editar_aprobar_rechazar",
          status: "rejected",
          rejection_note: rejectNote.trim(),
          notas: notes.trim() || null,
          fecha_entrega: dueDate,
        })
        .eq("id", pedido.id);

      if (res.error) throw res.error;
      await init();
    } catch (e: unknown) {
      setErrorMsg(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const deliverPedido = async () => {
    if (!pedido) return;

    setSaving(true);
    setErrorMsg("");

    try {
      const res = await supabase
        .from("pedidos_tienda")
        .update({
          status: "delivered",
          delivered_at: new Date().toISOString(),
          delivered_by: userId,
        })
        .eq("id", pedido.id);

      if (res.error) throw res.error;
      await init();
    } catch (e: unknown) {
      setErrorMsg(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6">Cargando pedido...</div>;

  if (!pedido) {
    return (
      <div className="p-6">
        <div className="border border-red-300 bg-red-50 text-red-700 rounded-xl p-3 text-sm">
          {errorMsg || "No se encontró el pedido."}
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-6xl mx-auto grid gap-4">
        <div className="bg-white border rounded-2xl p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold">Pedido tienda</h1>
              <div className="text-sm text-gray-600">
                Tienda: <b>{tienda?.nombre ?? "-"}</b>
                {tienda?.ciudad ? ` · ${tienda.ciudad}` : ""}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm border rounded-full px-3 py-1 bg-gray-50">
                Etapa: <b>{stageLabel(pedido.current_stage)}</b>
              </span>
              <span
                className={`text-sm rounded-full px-3 py-1 ${statusBadge(
                  pedido.status
                )}`}
              >
                {pedido.status}
              </span>
            </div>
          </div>

          {errorMsg && (
            <div className="mt-4 border border-red-300 bg-red-50 text-red-700 rounded-xl p-3 text-sm">
              <b>Error:</b> {errorMsg}
            </div>
          )}

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-600">Fecha de entrega</label>
              <input
                type="date"
                className="w-full border rounded-xl px-3 py-2 bg-white"
                value={dueDate}
                disabled={!canEdit || pedido.status === "delivered"}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div className="flex items-end text-sm text-gray-600">
              Cantidad total de artículos: <b className="ml-1">{totalQty}</b>
            </div>

            <div className="md:col-span-2">
              <label className="text-sm text-gray-600">Notas</label>
              <textarea
                className="w-full border rounded-xl px-3 py-2 bg-white min-h-[110px]"
                value={notes}
                disabled={!canEdit || pedido.status === "delivered"}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {(pedido.status === "rejected" ||
              pedido.current_stage === "editar_aprobar_rechazar") && (
              <div className="md:col-span-2">
                <label className="text-sm text-gray-600">Nota de rechazo</label>
                <textarea
                  className="w-full border rounded-xl px-3 py-2 bg-white min-h-[90px]"
                  value={rejectNote}
                  disabled={!canReview || pedido.status === "delivered"}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="Escribe el motivo si vas a rechazar la orden"
                />
              </div>
            )}
          </div>

          <div className="mt-4 flex gap-2 flex-wrap">
            {canEdit && pedido.status !== "delivered" && (
              <button
                className="border px-4 py-2 rounded-xl bg-white disabled:opacity-50"
                onClick={saveChanges}
                disabled={saving}
              >
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
            )}

            {canEdit &&
              pedido.current_stage === "crear_orden" &&
              pedido.status !== "delivered" && (
                <button
                  className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-50"
                  onClick={moveToReview}
                  disabled={saving}
                >
                  Enviar a revisión
                </button>
              )}

            {canReview &&
              pedido.current_stage === "editar_aprobar_rechazar" &&
              pedido.status !== "delivered" && (
                <>
                  <button
                    className="px-4 py-2 rounded-xl bg-blue-600 text-white disabled:opacity-50"
                    onClick={approvePedido}
                    disabled={saving}
                  >
                    Aprobar orden
                  </button>

                  <button
                    className="px-4 py-2 rounded-xl bg-red-600 text-white disabled:opacity-50"
                    onClick={rejectPedido}
                    disabled={saving}
                  >
                    Rechazar orden
                  </button>
                </>
              )}

            {canReview &&
              pedido.current_stage === "entregar_orden" &&
              pedido.status === "approved" && (
                <button
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white disabled:opacity-50"
                  onClick={deliverPedido}
                  disabled={saving}
                >
                  Marcar como entregada
                </button>
              )}
          </div>
        </div>

        <div className="bg-white border rounded-2xl p-4">
          <div className="text-xl font-bold">Artículos del pedido</div>

          {items.length === 0 ? (
            <div className="text-sm text-gray-500 mt-2">
              No hay artículos en este pedido.
            </div>
          ) : (
            <div className="mt-3 grid gap-3">
              {items.map((it) => (
                <div
                  key={it.id}
                  className="border rounded-2xl p-3 flex items-center justify-between gap-3 flex-wrap"
                >
                  <div className="flex items-center gap-3">
                    {it.product_image_path ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={it.product_image_path}
                        alt="Producto"
                        className="w-12 h-12 rounded-xl object-cover border"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl border bg-gray-100" />
                    )}

                    <div>
                      <div className="font-semibold">{it.product_name ?? "-"}</div>
                      <div className="text-xs text-gray-600">SKU: {it.sku ?? "-"}</div>
                      <div className="text-xs text-gray-500">{it.category ?? "-"}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      className="w-24 border rounded-xl px-3 py-2 bg-white"
                      value={it.qty}
                      disabled={!canEdit || pedido.status === "delivered"}
                      onChange={(e) => updateQty(it.id, Number(e.target.value))}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
