"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Role = "admin" | "supervisor" | "operator" | null;

const PROFILES_TABLE = "profiles";
const PRODUCTS_TABLE = "productos";
const ORDERS_TABLE = "ordenes_de_produccion";
const ORDER_ITEMS_TABLE = "orden_items";
const STAGES_TABLE = "etapas_de_produccion";

const STAGES = ["venta", "diseno", "estampado", "confeccion", "revision_calidad", "despacho"] as const;

const STAGE_STATUS = {
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  APPROVED: "approved",
} as const;

type Product = {
  id: string;
  sku: string | null;
  name: string;
  category: string;
  image_path: string;
  is_active: boolean;
  lead_time_days: number;
};

type CartItem = {
  product_id: string;
  sku: string | null;
  name: string;
  category: string;
  image_path: string;
  lead_time_days: number;
  qty: number;
};

function normCat(c?: string | null) {
  const v = (c ?? "").trim();
  return v ? v : "Sin categoría";
}

function isValidHttpUrl(u?: string | null) {
  return !!u && /^https?:\/\//i.test(u);
}

function pad(n: number, len = 4) {
  return String(n).padStart(len, "0");
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export default function NewOrderPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<Role>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("__all__");

  const [clientName, setClientName] = useState("");
  const [customCode, setCustomCode] = useState("");
  const [dueDate, setDueDate] = useState(""); // opcional: si lo dejan vacío, se calcula por lead time
  const [cart, setCart] = useState<CartItem[]>([]);

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

      // Solo admin/supervisor crean órdenes
      if (r !== "admin" && r !== "supervisor") {
        window.location.href = "/";
        return;
      }

      const res = await supabase
        .from(PRODUCTS_TABLE)
        .select("id, sku, name, category, image_path, is_active, lead_time_days")
        .eq("is_active", true)
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (res.error) throw res.error;

      const data = (res.data ?? []) as any[];
      // Asegurar category y lead_time_days
      const normalized: Product[] = data.map((p) => ({
        id: p.id,
        sku: p.sku ?? null,
        name: p.name,
        category: normCat(p.category),
        image_path: p.image_path,
        is_active: !!p.is_active,
        lead_time_days: Number(p.lead_time_days ?? 0),
      }));
      setProducts(normalized);
    } catch (e: any) {
      setErrorMsg(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) set.add(p.category);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const filteredProducts = useMemo(() => {
    const s = search.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryFilter !== "__all__" && p.category !== categoryFilter) return false;
      if (!s) return true;
      const hay = `${p.name} ${p.sku ?? ""} ${p.category}`.toLowerCase();
      return hay.includes(s);
    });
  }, [products, search, categoryFilter]);

  const groupedProducts = useMemo(() => {
    const map: Record<string, Product[]> = {};
    for (const p of filteredProducts) {
      if (!map[p.category]) map[p.category] = [];
      map[p.category].push(p);
    }
    return map;
  }, [filteredProducts]);

  const addToCart = (p: Product) => {
    if (!p.image_path || !isValidHttpUrl(p.image_path)) {
      alert("Este producto no tiene foto válida (es obligatoria).");
      return;
    }
    if (!p.category || p.category.trim() === "") {
      alert("Este producto no tiene categoría. Corrígelo en Catálogo.");
      return;
    }
    if (!Number.isFinite(p.lead_time_days)) {
      alert("Este producto no tiene lead_time_days válido.");
      return;
    }

    setCart((prev) => {
      const idx = prev.findIndex((x) => x.product_id === p.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
        return copy;
      }
      return [
        ...prev,
        {
          product_id: p.id,
          sku: p.sku,
          name: p.name,
          category: p.category,
          image_path: p.image_path,
          lead_time_days: p.lead_time_days,
          qty: 1,
        },
      ];
    });
  };

  const removeFromCart = (product_id: string) => {
    setCart((prev) => prev.filter((x) => x.product_id !== product_id));
  };

  const setQty = (product_id: string, qty: number) => {
    if (!qty || qty < 1) qty = 1;
    setCart((prev) => prev.map((x) => (x.product_id === product_id ? { ...x, qty } : x)));
  };

  const totalQty = useMemo(() => cart.reduce((a, b) => a + b.qty, 0), [cart]);

  const orderType = useMemo(() => (totalQty >= 20 ? "produccion" : "venta"), [totalQty]);

  const computedDueDate = useMemo(() => {
    if (dueDate) return dueDate;
    const maxLead = cart.length ? Math.max(...cart.map((x) => x.lead_time_days || 0)) : 0;
    const d = addDays(new Date(), maxLead);
    return d.toISOString().slice(0, 10);
  }, [dueDate, cart]);

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
    if (cart.length === 0) return alert("Agrega al menos 1 artículo.");

    setSaving(true);
    try {
      const code = customCode.trim() ? customCode.trim() : await generateAutoCode();

      // Crear orden (cabecera)
      const insOrder = await supabase
        .from(ORDERS_TABLE)
        .insert({
          created_by: user.id,
          display_code_manual: code,
          seq_code: code,
          product_ref: "MULTI", // ya no es 1 producto
          order_type: orderType,
          status: "active",
          current_stage: "venta",
          quantity: totalQty,
          client_name: clientName.trim(),
          due_date: computedDueDate || null,
        })
        .select("id")
        .single();

      if (insOrder.error) throw insOrder.error;

      const orderId = insOrder.data.id as string;

      // Insertar items
      const itemsPayload = cart.map((x) => ({
        order_id: orderId,
        product_id: x.product_id,
        product_name: x.name,
        product_image_path: x.image_path,
        category: x.category,
        sku: x.sku,
        qty: x.qty,
        lead_time_days: x.lead_time_days ?? 0,
      }));

      const insItems = await supabase.from(ORDER_ITEMS_TABLE).insert(itemsPayload);
      if (insItems.error) throw insItems.error;

      // Crear etapas
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
      alert("Error creando orden: " + (e?.message ?? String(e)));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6">Cargando...</div>;

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Crear Orden</h1>
            <div className="text-sm text-gray-600">
              Tipo: <b>{orderType.toUpperCase()}</b> · Cantidad total: <b>{totalQty}</b> · Entrega sugerida:{" "}
              <b>{computedDueDate || "-"}</b>
            </div>
          </div>

          <button className="border px-3 py-2 rounded-xl bg-white" onClick={() => (window.location.href = "/")}>
            ← Volver
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 border border-red-300 bg-red-50 text-red-700 rounded-xl p-3 text-sm">
            <b>Error:</b> {errorMsg}
          </div>
        )}

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_420px] items-start">
          {/* Datos orden */}
          <div className="bg-white border rounded-2xl p-4">
            <div className="grid gap-3">
              <input className="border p-3 rounded-xl w-full" placeholder="Cliente" value={clientName} onChange={(e) => setClientName(e.target.value)} />
              <input className="border p-3 rounded-xl w-full" placeholder="Consecutivo personalizado (opcional)" value={customCode} onChange={(e) => setCustomCode(e.target.value)} />

              <div className="grid md:grid-cols-2 gap-3">
                <input
                  type="date"
                  className="border p-3 rounded-xl w-full"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
                <div className="text-xs text-gray-500 flex items-center">
                  Si lo dejas vacío, se calcula con el mayor lead_time_days del carrito.
                </div>
              </div>

              <button className="bg-black text-white px-4 py-3 rounded-xl w-full disabled:opacity-50" disabled={saving} onClick={createOrder}>
                {saving ? "Creando..." : "Crear Orden"}
              </button>
            </div>
          </div>

          {/* Selector productos por categorías */}
          <div className="bg-white border rounded-2xl p-4">
            <div className="text-lg font-semibold">Agregar artículos</div>

            <div className="mt-3 grid gap-2">
              <input className="border p-3 rounded-xl w-full" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <select className="border p-3 rounded-xl w-full" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="__all__">Todas las categorías</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="mt-3 max-h-[420px] overflow-auto pr-1 space-y-5">
              {Object.keys(groupedProducts).sort((a, b) => a.localeCompare(b)).map((cat) => (
                <div key={cat}>
                  <div className="font-bold">{cat}</div>
                  <div className="mt-2 grid gap-2">
                    {groupedProducts[cat].map((p) => (
                      <button key={p.id} className="border rounded-xl p-2 text-left hover:bg-gray-50" onClick={() => addToCart(p)}>
                        <div className="font-semibold">{p.name}</div>
                        <div className="text-xs text-gray-600">SKU: {p.sku ?? "-"} · Lead time: {p.lead_time_days} días</div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {filteredProducts.length === 0 && <div className="text-sm text-gray-500">No hay productos con ese filtro.</div>}
            </div>

            {/* Carrito */}
            <div className="mt-4 border-t pt-3">
              <div className="font-semibold">Carrito ({totalQty})</div>
              {cart.length === 0 ? (
                <div className="text-sm text-gray-500 mt-2">Aún no has agregado artículos.</div>
              ) : (
                <div className="mt-2 space-y-2">
                  {cart.map((x) => (
                    <div key={x.product_id} className="border rounded-xl p-2 bg-white">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{x.name}</div>
                          <div className="text-xs text-gray-600">Categoría: {x.category} · Lead: {x.lead_time_days} días</div>
                        </div>
                        <button className="text-sm underline" onClick={() => removeFromCart(x.product_id)}>Quitar</button>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-gray-600">Cant:</span>
                        <input
                          type="number"
                          min={1}
                          className="border rounded-lg px-2 py-1 w-24"
                          value={x.qty}
                          onChange={(e) => setQty(x.product_id, Number(e.target.value))}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </main>
  );
}