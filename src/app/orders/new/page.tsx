"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Role = "admin" | "supervisor" | "operator" | null;

const ORDERS_TABLE = "ordenes_de_produccion";
const STAGES_TABLE = "etapas_de_produccion";
const PROFILES_TABLE = "profiles";
const PRODUCTS_TABLE = "productos";

const STAGES = ["venta", "diseno", "estampado", "confeccion", "revision_calidad", "despacho"] as const;

const getOrderType = (qty: number) => (qty >= 20 ? "produccion" : "venta");

// ✅ enum típico
const STAGE_STATUS = {
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  APPROVED: "approved",
} as const;

type Product = {
  id: string;
  sku: string | null;
  name: string;
  image_path: string | null;
  is_active: boolean;

  category: string | null;
  base_price: number | null;
  lead_time_days: number | null;
};

function pad(n: number, len = 4) {
  return String(n).padStart(len, "0");
}

function isValidHttpUrl(u?: string | null) {
  return !!u && /^https?:\/\//i.test(u);
}

function money(n?: number | null) {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
}

export default function NewOrderPage() {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<Role>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [products, setProducts] = useState<Product[]>([]);
  const [searchProduct, setSearchProduct] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string>("");

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) ?? null,
    [products, selectedProductId]
  );

  const filteredProducts = useMemo(() => {
    const s = searchProduct.trim().toLowerCase();
    const base = products.filter((p) => p.is_active);

    if (!s) return base.slice(0, 12);

    const r = base.filter((p) => {
      const hay = `${p.name} ${p.sku ?? ""} ${p.category ?? ""}`.toLowerCase();
      return hay.includes(s);
    });

    return r.slice(0, 12);
  }, [products, searchProduct]);

  const [clientName, setClientName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [dueDate, setDueDate] = useState("");
  const [customCode, setCustomCode] = useState("");

  const computedType = useMemo(() => getOrderType(Number(quantity || 0)), [quantity]);

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

      // Crear orden: admin y supervisor (como venías)
      if (r !== "admin" && r !== "supervisor") {
        window.location.href = "/";
        return;
      }

      const res = await supabase
        .from(PRODUCTS_TABLE)
        .select("id, sku, name, image_path, is_active, category, base_price, lead_time_days")
        .order("name", { ascending: true });

      if (res.error) throw res.error;

      setProducts((res.data ?? []) as Product[]);
    } catch (e: any) {
      setErrorMsg(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const generateAutoCode = async () => {
    const year = new Date().getFullYear();
    const prefix = `OP-${year}-`;

    const res = await supabase
      .from(ORDERS_TABLE)
      .select("display_code_manual, created_at")
      .ilike("display_code_manual", `${prefix}%`)
      .order("created_at", { ascending: false })
      .limit(1);

    if (res.error) return `${prefix}${Date.now()}`;

    const last = res.data?.[0]?.display_code_manual as string | undefined;
    if (!last || !last.startsWith(prefix)) return `${prefix}${pad(1)}`;

    const tail = last.slice(prefix.length);
    const num = parseInt(tail, 10);
    if (!isFinite(num)) return `${prefix}${pad(1)}`;

    return `${prefix}${pad(num + 1)}`;
  };

  const createOrder = async () => {
    setErrorMsg("");

    if (!user?.id) return alert("No hay usuario autenticado.");
    if (!clientName.trim()) return alert("Falta cliente.");
    if (!selectedProduct) return alert("Selecciona un producto del catálogo.");
    if (!selectedProduct.image_path) return alert("Este producto no tiene foto (es obligatoria).");

    if (!isValidHttpUrl(selectedProduct.image_path)) {
      return alert("La foto del producto debe ser una URL http(s).");
    }

    const qty = Number(quantity);
    if (!qty || qty <= 0) return alert("Cantidad inválida.");

    setSaving(true);

    try {
      const code = customCode.trim() ? customCode.trim() : await generateAutoCode();

      const productRef =
        selectedProduct.sku && selectedProduct.sku.trim() ? selectedProduct.sku.trim() : selectedProduct.name;

      const insOrder = await supabase
        .from(ORDERS_TABLE)
        .insert({
          created_by: user.id,

          display_code_manual: code,
          seq_code: code,
          product_ref: productRef,

          order_type: computedType,
          status: "active",
          current_stage: "venta",

          product_id: selectedProduct.id,
          product_name: selectedProduct.name,
          product_image_path: selectedProduct.image_path,

          quantity: qty,
          client_name: clientName.trim(),
          due_date: dueDate || null,
        })
        .select("id")
        .single();

      if (insOrder.error) throw insOrder.error;

      const orderId = insOrder.data.id as string;

      const now = new Date().toISOString();
      const stageRows = STAGES.map((s) => ({
        order_id: orderId,
        stage: s,
        status: s === "venta" ? STAGE_STATUS.IN_PROGRESS : STAGE_STATUS.PENDING,
        started_at: s === "venta" ? now : null,
        approved_at: null,
        evidence_url: null,
        notes: null,
      }));

      const insStages = await supabase.from(STAGES_TABLE).insert(stageRows);
      if (insStages.error) throw insStages.error;

      window.location.href = `/orders/${orderId}`;
    } catch (e: any) {
      setErrorMsg(e?.message ?? String(e));
      alert("Error creando: " + (e?.message ?? String(e)));
    } finally {
      setSaving(false);
    }
  };

  const clearSelected = () => {
    setSelectedProductId("");
    setSearchProduct("");
  };

  if (loading) return <div className="p-6">Cargando...</div>;

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Crear Orden</h1>
            <div className="text-sm text-gray-600">
              Tipo automático por cantidad: <b>{computedType.toUpperCase()}</b>
            </div>
          </div>

          <button className="border px-3 py-2 rounded-xl bg-white" onClick={() => (window.location.href = "/")}>
            ← Volver al tablero
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 border border-red-300 bg-red-50 text-red-700 rounded-xl p-3 text-sm">
            <b>Error:</b> {errorMsg}
          </div>
        )}

        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_360px] items-start">
          {/* Formulario */}
          <div className="bg-white border rounded-2xl p-4">
            <div className="grid gap-3">
              <input
                className="border p-3 rounded-xl w-full"
                placeholder="Cliente"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />

              <div className="grid md:grid-cols-2 gap-3">
                <input
                  type="number"
                  min={1}
                  className="border p-3 rounded-xl w-full"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                />

                <input
                  type="date"
                  className="border p-3 rounded-xl w-full"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>

              <input
                className="border p-3 rounded-xl w-full"
                placeholder="Consecutivo personalizado (opcional)"
                value={customCode}
                onChange={(e) => setCustomCode(e.target.value)}
              />

              <button
                className="bg-black text-white px-4 py-3 rounded-xl w-full disabled:opacity-50"
                disabled={saving}
                onClick={createOrder}
              >
                {saving ? "Creando..." : "Crear Orden"}
              </button>
            </div>
          </div>

          {/* Selector de producto */}
          <div className="bg-white border rounded-2xl p-4">
            <div className="text-lg font-semibold">Producto</div>

            {!selectedProduct ? (
              <>
                <input
                  className="border p-3 rounded-xl w-full mt-3"
                  placeholder="Buscar producto por nombre, SKU o categoría..."
                  value={searchProduct}
                  onChange={(e) => setSearchProduct(e.target.value)}
                />

                <div className="mt-3 grid gap-2">
                  {filteredProducts.map((p) => (
                    <button
                      key={p.id}
                      className="border rounded-xl p-2 text-left hover:bg-gray-50"
                      onClick={() => {
                        setSelectedProductId(p.id);
                        setSearchProduct("");
                      }}
                    >
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-xs text-gray-600">
                        SKU: {p.sku ?? "-"} · Cat: {p.category ?? "-"} · {money(p.base_price)} · {p.lead_time_days ?? "-"} días
                      </div>
                    </button>
                  ))}

                  {filteredProducts.length === 0 && (
                    <div className="text-sm text-gray-500">No hay productos con esa búsqueda.</div>
                  )}
                </div>
              </>
            ) : (
              <div className="mt-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedProduct.image_path ?? ""}
                  alt={selectedProduct.name}
                  className="w-full h-44 object-cover rounded-xl border"
                />

                <div className="mt-3">
                  <div className="text-lg font-bold">{selectedProduct.name}</div>
                  <div className="text-sm text-gray-700">
                    SKU: <b>{selectedProduct.sku ?? "-"}</b>
                  </div>
                  <div className="text-sm text-gray-700">
                    Categoría: <b>{selectedProduct.category ?? "-"}</b>
                  </div>
                  <div className="text-sm text-gray-700">
                    Precio base: <b>{money(selectedProduct.base_price)}</b>
                  </div>
                  <div className="text-sm text-gray-700">
                    Días estimados: <b>{selectedProduct.lead_time_days ?? "-"}</b>
                  </div>

                  <button className="mt-3 border px-3 py-2 rounded-xl bg-white w-full" onClick={clearSelected} disabled={saving}>
                    Cambiar producto
                  </button>
                </div>
              </div>
            )}

            <div className="text-xs text-gray-500 mt-3">
              * Solo se muestran productos <b>activos</b> y con foto obligatoria.
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}