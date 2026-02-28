"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Role = "admin" | "supervisor" | "operator" | null;

type SaleChannel = "web" | "apps" | "personalizados" | "tienda_fisica" | "institucional";

const CHANNEL_LABEL: Record<SaleChannel, string> = {
  web: "Venta página web",
  apps: "Venta aplicaciones",
  personalizados: "Ventas personalizados",
  tienda_fisica: "Venta tienda física",
  institucional: "Ventas institucionales",
};

type Product = {
  id: string;
  sku: string | null;
  name: string | null;
  description: string | null;
  image_path: string | null;
  category?: string | null;
  is_active?: boolean | null;
};

type ChannelSetting = {
  channel: SaleChannel;
  default_days: number | null;
};

export default function NewOrderPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [role, setRole] = useState<Role>(null);
  const [userId, setUserId] = useState<string>("");

  // Form
  const [clientName, setClientName] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [saleChannel, setSaleChannel] = useState<SaleChannel>("web");

  // Para institucional es obligatorio, para los demás es opcional
  const [dueDate, setDueDate] = useState<string>("");

  const [items, setItems] = useState<{ product_id: string; qty: number }[]>([]);

  // data
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<ChannelSetting[]>([]);

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const init = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const ures = await supabase.auth.getUser();
      const u = ures.data.user;

      if (!u) {
        window.location.href = "/login";
        return;
      }

      setUserId(u.id);

      const pres = await supabase.from("profiles").select("role").eq("user_id", u.id).single();
      const r = (pres.data?.role ?? null) as Role;
      setRole(r);

      if (!(r === "admin" || r === "supervisor")) {
        setErrorMsg("No tienes permisos para crear órdenes.");
        setLoading(false);
        return;
      }

      // Productos activos
      const prodRes = await supabase
        .from("productos")
        .select("id, sku, name, description, image_path, category, is_active")
        .eq("is_active", true)
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (prodRes.error) throw prodRes.error;
      setProducts((prodRes.data ?? []) as Product[]);

      // Settings de canales
      const setRes = await supabase.from("sale_channel_settings").select("channel, default_days");
      if (setRes.error) throw setRes.error;
      setSettings((setRes.data ?? []) as ChannelSetting[]);
    } catch (e: any) {
      setErrorMsg(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const settingsMap = useMemo(() => {
    const m: Partial<Record<SaleChannel, number | null>> = {};
    for (const s of settings) m[s.channel] = s.default_days ?? null;
    return m;
  }, [settings]);

  const previewDueDate = useMemo(() => {
    // Si el usuario puso una fecha manual, esa manda
    if (dueDate) return dueDate;

    // Institucional: sin fecha manual no hay estimado (porque es personalizada)
    if (saleChannel === "institucional") return "";

    // Si no, mostramos un preview con el default del canal (solo aproximado)
    const days = (settingsMap[saleChannel] ?? 4) as number;
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }, [dueDate, saleChannel, settingsMap]);

  const productById = useMemo(() => {
    const m: Record<string, Product> = {};
    for (const p of products) m[p.id] = p;
    return m;
  }, [products]);

  const productsByCategory = useMemo(() => {
    const m: Record<string, Product[]> = {};
    for (const p of products) {
      const cat = (p.category ?? "Sin categoría").trim() || "Sin categoría";
      if (!m[cat]) m[cat] = [];
      m[cat].push(p);
    }
    return m;
  }, [products]);

  const addItem = (pid: string) => {
    setItems((prev) => {
      const idx = prev.findIndex((x) => x.product_id === pid);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
        return copy;
      }
      return [...prev, { product_id: pid, qty: 1 }];
    });
  };

  const removeItem = (pid: string) => {
    setItems((prev) => prev.filter((x) => x.product_id !== pid));
  };

  const changeQty = (pid: string, qty: number) => {
    setItems((prev) =>
      prev.map((x) => (x.product_id === pid ? { ...x, qty: Math.max(1, qty) } : x))
    );
  };

  const totalQty = useMemo(() => items.reduce((a, b) => a + (b.qty || 0), 0), [items]);

  const createOrder = async () => {
    setErrorMsg("");

    if (!clientName.trim()) {
      setErrorMsg("Debes ingresar el nombre del cliente.");
      return;
    }
    if (items.length === 0) {
      setErrorMsg("Debes agregar al menos 1 producto.");
      return;
    }

    // ✅ Institucional: due_date obligatorio
    if (saleChannel === "institucional" && !dueDate) {
      setErrorMsg("Para ventas institucionales debes seleccionar una fecha de entrega.");
      return;
    }

    setSaving(true);
    try {
      const orderPayload: any = {
        client_name: clientName.trim(),
        display_code_manual: manualCode.trim() || null,
        sale_channel: saleChannel,
        quantity: totalQty,
        created_by: userId,
        // Si dueDate está vacío => el trigger la calcula automáticamente (excepto institucional)
        due_date: dueDate ? dueDate : null,
      };

      const oRes = await supabase
        .from("ordenes_de_produccion")
        .insert(orderPayload)
        .select("id")
        .single();

      if (oRes.error) throw oRes.error;

      const orderId = oRes.data.id as string;

      // Insertar items
      const rows = items.map((it) => {
        const p = productById[it.product_id];
        return {
          order_id: orderId,
          product_id: it.product_id,
          qty: it.qty,
          product_name: p?.name ?? "",
          category: (p?.category ?? "Sin categoría") as any,
          product_image_path: p?.image_path ?? null,
        };
      });

      const iRes = await supabase.from("orden_items").insert(rows);
      if (iRes.error) throw iRes.error;

      window.location.href = `/orders/${orderId}`;
    } catch (e: any) {
      setErrorMsg(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6">Cargando...</div>;

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white border rounded-2xl p-4">
          <div className="text-2xl font-bold">Crear orden</div>
          <div className="text-sm text-gray-600 mt-1">
            Tipo de venta: <b>{CHANNEL_LABEL[saleChannel]}</b>
            {saleChannel !== "institucional" && (
              <>
                {" "}
                · Entrega estimada (si dejas vacío): <b>{previewDueDate}</b>
              </>
            )}
            {saleChannel === "institucional" && (
              <>
                {" "}
                · <b>Entrega personalizada (obligatoria)</b>
              </>
            )}
          </div>

          {errorMsg && (
            <div className="mt-3 border border-red-300 bg-red-50 text-red-700 rounded-xl p-3 text-sm">
              <b>Error:</b> {errorMsg}
            </div>
          )}

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-600">Cliente</label>
              <input
                className="w-full border rounded-xl px-3 py-2 bg-white"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Nombre del cliente"
              />
            </div>

            <div>
              <label className="text-sm text-gray-600">Consecutivo manual (opcional)</label>
              <input
                className="w-full border rounded-xl px-3 py-2 bg-white"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Ej: OV-00123"
              />
            </div>

            <div>
              <label className="text-sm text-gray-600">Tipo de venta</label>
              <select
                className="w-full border rounded-xl px-3 py-2 bg-white"
                value={saleChannel}
                onChange={(e) => {
                  const val = e.target.value as SaleChannel;
                  setSaleChannel(val);

                  // Si cambia a no-institucional, permitimos limpiar dueDate para que aplique automático
                  // Si cambia a institucional, dejamos lo que tenga pero será obligatorio antes de crear
                }}
              >
                <option value="web">{CHANNEL_LABEL.web}</option>
                <option value="apps">{CHANNEL_LABEL.apps}</option>
                <option value="personalizados">{CHANNEL_LABEL.personalizados}</option>
                <option value="tienda_fisica">{CHANNEL_LABEL.tienda_fisica}</option>
                <option value="institucional">{CHANNEL_LABEL.institucional}</option>
              </select>
            </div>

            <div>
              <label className="text-sm text-gray-600">
                Fecha de entrega{" "}
                {saleChannel === "institucional" ? "(obligatoria)" : "(opcional: vacío = automática)"}
              </label>
              <input
                type="date"
                className="w-full border rounded-xl px-3 py-2 bg-white"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
              <div className="text-xs text-gray-500 mt-1">
                {saleChannel === "institucional"
                  ? "En ventas institucionales debes escoger la fecha exacta."
                  : "Si está vacío, se calcula automáticamente según el tipo de venta."}
              </div>
              {saleChannel === "institucional" && !dueDate && (
                <div className="text-xs text-red-600 mt-1">
                  ⚠️ Debes seleccionar una fecha para poder crear la orden.
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-2 flex-wrap">
            <div className="text-sm text-gray-700">
              Items: <b>{items.length}</b> · Cantidad total: <b>{totalQty}</b>
            </div>

            <div className="flex gap-2">
              <button
                className="border px-3 py-2 rounded-xl bg-white"
                onClick={() => (window.location.href = "/")}
              >
                Cancelar
              </button>

              <button
                className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-50"
                disabled={saving}
                onClick={createOrder}
              >
                {saving ? "Creando..." : "Crear orden"}
              </button>
            </div>
          </div>
        </div>

        {/* Catálogo por categorías */}
        <div className="mt-4 bg-white border rounded-2xl p-4">
          <div className="text-xl font-bold">Catálogo</div>
          <div className="text-sm text-gray-600">
            Selecciona productos (puedes escoger varios de distintas categorías)
          </div>

          {Object.keys(productsByCategory).map((cat) => (
            <div key={cat} className="mt-4">
              <div className="font-semibold mb-2">{cat}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {productsByCategory[cat].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addItem(p.id)}
                    className="text-left border rounded-2xl p-3 bg-white hover:bg-gray-50"
                  >
                    <div className="flex gap-3">
                      {p.image_path ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.image_path}
                          alt="Producto"
                          className="w-16 h-16 rounded-xl object-cover border"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-xl border bg-gray-100" />
                      )}

                      <div className="min-w-0">
                        <div className="font-bold truncate">{p.name ?? "-"}</div>
                        <div className="text-xs text-gray-600 truncate">SKU: {p.sku ?? "-"}</div>
                        <div className="text-xs text-gray-500 line-clamp-2">{p.description ?? ""}</div>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-gray-600">➕ Agregar</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Items seleccionados */}
        <div className="mt-4 bg-white border rounded-2xl p-4">
          <div className="text-xl font-bold">Artículos seleccionados</div>

          {items.length === 0 ? (
            <div className="text-sm text-gray-500 mt-2">Aún no has agregado productos.</div>
          ) : (
            <div className="mt-3 grid gap-3">
              {items.map((it) => {
                const p = productById[it.product_id];
                return (
                  <div
                    key={it.product_id}
                    className="border rounded-2xl p-3 flex items-center justify-between gap-3 flex-wrap"
                  >
                    <div className="flex items-center gap-3">
                      {p?.image_path ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.image_path}
                          alt="Producto"
                          className="w-12 h-12 rounded-xl object-cover border"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl border bg-gray-100" />
                      )}
                      <div>
                        <div className="font-semibold">{p?.name ?? "-"}</div>
                        <div className="text-xs text-gray-600">SKU: {p?.sku ?? "-"}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        className="w-24 border rounded-xl px-3 py-2 bg-white"
                        value={it.qty}
                        onChange={(e) => changeQty(it.product_id, Number(e.target.value))}
                      />
                      <button
                        className="border px-3 py-2 rounded-xl bg-white"
                        onClick={() => removeItem(it.product_id)}
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}