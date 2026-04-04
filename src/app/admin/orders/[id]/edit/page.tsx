"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../../../lib/supabaseClient";

type Role = "admin" | "supervisor" | "operator" | "operador" | null;

type Product = {
  id: string;
  name: string;
  category: string | null;
  image_path: string | null;
};

type OrderRow = {
  id: string;
  client_name: string | null;
  display_code_manual: string | null;
  sale_channel: string | null;
  current_stage: string | null;
  status: string | null;
  due_date: string | null;
};

type OrderItemRow = {
  id: number;
  order_id: string;
  product_id: string | null;
  qty: number;
};

type SelectedItem = {
  product_id: string;
  qty: number;
};

const PROFILES_TABLE = "profiles";
const ORDERS_TABLE = "ordenes_de_produccion";
const ITEMS_TABLE = "orden_items";
const PRODUCTS_TABLE = "productos";
const MUTATION_KEY = "orders:lastMutation";

function emitOrdersMutation(type: "delete" | "update" | "create", orderId: string) {
  const payload = { type, orderId, at: Date.now() };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(MUTATION_KEY, JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent("orders-mutated", { detail: payload }));
  }
}

export default function AdminEditOrderPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const orderId = String(params?.id ?? "");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [products, setProducts] = useState<Product[]>([]);
  const [clientName, setClientName] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [saleChannel, setSaleChannel] = useState("");
  const [currentStage, setCurrentStage] = useState("");
  const [status, setStatus] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [items, setItems] = useState<SelectedItem[]>([]);

  const loadData = useCallback(async () => {
    setErrorMsg("");

    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) {
      window.location.href = "/login";
      return;
    }

    const profileRes = await supabase.from(PROFILES_TABLE).select("role").eq("user_id", user.id).single();
    const role = (profileRes.data?.role ?? null) as Role;
    if (role !== "admin") {
      window.location.href = "/";
      return;
    }

    const [orderRes, itemsRes, productsRes] = await Promise.all([
      supabase
        .from(ORDERS_TABLE)
        .select("id, client_name, display_code_manual, sale_channel, current_stage, status, due_date")
        .eq("id", orderId)
        .single(),
      supabase.from(ITEMS_TABLE).select("id, order_id, product_id, qty").eq("order_id", orderId),
      supabase.from(PRODUCTS_TABLE).select("id, name, category, image_path").eq("is_active", true).order("name"),
    ]);

    if (orderRes.error) throw new Error("No pude cargar la orden: " + orderRes.error.message);
    if (itemsRes.error) throw new Error("No pude cargar los items: " + itemsRes.error.message);
    if (productsRes.error) throw new Error("No pude cargar los productos: " + productsRes.error.message);

    const order = orderRes.data as OrderRow;
    const orderItems = (itemsRes.data ?? []) as OrderItemRow[];

    setProducts((productsRes.data ?? []) as Product[]);
    setClientName(order.client_name ?? "");
    setManualCode(order.display_code_manual ?? "");
    setSaleChannel(order.sale_channel ?? "");
    setCurrentStage(order.current_stage ?? "");
    setStatus(order.status ?? "");
    setDueDate(order.due_date ? String(order.due_date).slice(0, 10) : "");
    setItems(
      orderItems
        .filter((item) => item.product_id)
        .map((item) => ({ product_id: item.product_id as string, qty: item.qty || 1 })),
    );
  }, [orderId]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        await loadData();
      } catch (e: any) {
        if (mounted) setErrorMsg(e?.message ?? String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [loadData]);

  const productById = useMemo(() => {
    const map: Record<string, Product> = {};
    for (const p of products) map[p.id] = p;
    return map;
  }, [products]);

  const totalQty = useMemo(() => items.reduce((acc, item) => acc + (item.qty || 0), 0), [items]);

  const addProduct = (productId: string) => {
    setItems((prev) => {
      const idx = prev.findIndex((item) => item.product_id === productId);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
        return copy;
      }
      return [...prev, { product_id: productId, qty: 1 }];
    });
  };

  const changeQty = (productId: string, qty: number) => {
    setItems((prev) => prev.map((item) => (item.product_id === productId ? { ...item, qty: Math.max(1, qty) } : item)));
  };

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((item) => item.product_id !== productId));
  };

  const saveOrder = async () => {
    setErrorMsg("");

    if (!clientName.trim()) {
      setErrorMsg("Debes ingresar el nombre del cliente.");
      return;
    }
    if (!saleChannel.trim()) {
      setErrorMsg("Debes indicar el canal de venta.");
      return;
    }
    if (!currentStage.trim()) {
      setErrorMsg("Debes indicar la etapa actual.");
      return;
    }
    if (!status.trim()) {
      setErrorMsg("Debes indicar el estado.");
      return;
    }
    if (items.length === 0) {
      setErrorMsg("Debes dejar al menos un producto en la orden.");
      return;
    }

    setSaving(true);
    try {
      const orderUpdate = await supabase
        .from(ORDERS_TABLE)
        .update({
          client_name: clientName.trim(),
          display_code_manual: manualCode.trim() || null,
          sale_channel: saleChannel.trim(),
          current_stage: currentStage.trim(),
          status: status.trim(),
          due_date: dueDate || null,
          quantity: totalQty,
        })
        .eq("id", orderId)
        .select("id");

      if (orderUpdate.error) throw new Error("No pude actualizar la orden: " + orderUpdate.error.message);
      if (!orderUpdate.data || orderUpdate.data.length === 0) {
        throw new Error(
          "Supabase no actualizó la orden. Normalmente esto pasa por una política RLS de update que no permite al usuario ADMIN modificar registros.",
        );
      }

      const deleteItems = await supabase.from(ITEMS_TABLE).delete().eq("order_id", orderId);
      if (deleteItems.error) throw new Error("No pude limpiar los items anteriores: " + deleteItems.error.message);

      const rows = items.map((item) => {
        const product = productById[item.product_id];
        return {
          order_id: orderId,
          product_id: item.product_id,
          qty: item.qty,
          product_name: product?.name ?? "",
          category: product?.category ?? "Sin categoría",
          product_image_path: product?.image_path ?? null,
        };
      });

      const insertItems = await supabase.from(ITEMS_TABLE).insert(rows);
      if (insertItems.error) throw new Error("No pude guardar los items nuevos: " + insertItems.error.message);

      emitOrdersMutation("update", orderId);
      router.push("/admin/orders");
      router.refresh();
    } catch (e: any) {
      setErrorMsg(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6">Cargando orden...</div>;

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="bg-white border rounded-2xl p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold">Editar orden</h1>
              <p className="text-sm text-gray-600">Actualiza la cabecera de la orden y sus productos.</p>
            </div>
            <Link href="/admin/orders" className="border px-3 py-2 rounded-xl bg-white">
              Volver
            </Link>
          </div>

          {errorMsg ? (
            <div className="mt-4 border border-red-300 bg-red-50 text-red-700 rounded-xl p-3 text-sm">{errorMsg}</div>
          ) : null}
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white border rounded-2xl p-4 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <label className="block">
                <div className="text-sm font-medium mb-1">Cliente</div>
                <input value={clientName} onChange={(e) => setClientName(e.target.value)} className="w-full border rounded-xl px-3 py-2" />
              </label>

              <label className="block">
                <div className="text-sm font-medium mb-1">Consecutivo</div>
                <input value={manualCode} onChange={(e) => setManualCode(e.target.value)} className="w-full border rounded-xl px-3 py-2" />
              </label>

              <label className="block">
                <div className="text-sm font-medium mb-1">Canal de venta</div>
                <input value={saleChannel} onChange={(e) => setSaleChannel(e.target.value)} className="w-full border rounded-xl px-3 py-2" />
              </label>

              <label className="block">
                <div className="text-sm font-medium mb-1">Etapa actual</div>
                <input value={currentStage} onChange={(e) => setCurrentStage(e.target.value)} className="w-full border rounded-xl px-3 py-2" />
              </label>

              <label className="block">
                <div className="text-sm font-medium mb-1">Estado</div>
                <input value={status} onChange={(e) => setStatus(e.target.value)} className="w-full border rounded-xl px-3 py-2" />
              </label>

              <label className="block">
                <div className="text-sm font-medium mb-1">Fecha de entrega</div>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full border rounded-xl px-3 py-2" />
              </label>
            </div>

            <div>
              <div className="text-sm font-semibold mb-2">Productos en la orden</div>
              <div className="space-y-2">
                {items.map((item) => {
                  const product = productById[item.product_id];
                  return (
                    <div key={item.product_id} className="border rounded-xl p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{product?.name ?? "Producto"}</div>
                        <div className="text-xs text-gray-500">{product?.category ?? "Sin categoría"}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          value={item.qty}
                          onChange={(e) => changeQty(item.product_id, Number(e.target.value || 1))}
                          className="w-20 border rounded-lg px-2 py-1"
                        />
                        <button onClick={() => removeItem(item.product_id)} className="px-3 py-1.5 rounded-lg border bg-white">
                          Quitar
                        </button>
                      </div>
                    </div>
                  );
                })}

                {items.length === 0 ? <div className="text-sm text-gray-500">No hay productos en esta orden.</div> : null}
              </div>
            </div>
          </div>

          <div className="bg-white border rounded-2xl p-4 space-y-4">
            <div>
              <div className="text-sm font-semibold">Agregar productos</div>
              <div className="text-xs text-gray-500 mt-1">Haz clic en un producto para sumarlo a la orden.</div>
            </div>

            <div className="max-h-[460px] overflow-auto space-y-2">
              {products.map((product) => (
                <button
                  key={product.id}
                  onClick={() => addProduct(product.id)}
                  className="w-full text-left border rounded-xl p-3 hover:bg-gray-50"
                >
                  <div className="font-medium">{product.name}</div>
                  <div className="text-xs text-gray-500">{product.category ?? "Sin categoría"}</div>
                </button>
              ))}
            </div>

            <div className="border-t pt-4">
              <div className="text-sm text-gray-600">
                Cantidad total: <b>{totalQty}</b>
              </div>
              <button onClick={saveOrder} disabled={saving} className="mt-3 w-full px-4 py-2 rounded-xl bg-black text-white disabled:opacity-60">
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
