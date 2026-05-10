"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

import {
  Role,
  normalizeRole,
  canCreateOrders,
} from "../../../lib/permissions";

type SaleChannel =
  | "web"
  | "apps"
  | "personalizados"
  | "tienda_fisica"
  | "institucional";

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

  // FORMULARIO
  const [clientName, setClientName] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [saleChannel, setSaleChannel] =
    useState<SaleChannel>("web");

  const [dueDate, setDueDate] =
    useState<string>("");

  const [notes, setNotes] =
    useState<string>("");

  const [items, setItems] = useState<
    { product_id: string; qty: number }[]
  >([]);

  // DATOS
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<
    ChannelSetting[]
  >([]);

  // FILTROS
  const [selectedCategory, setSelectedCategory] =
    useState<string>("ALL");

  const [searchTerm, setSearchTerm] =
    useState<string>("");

  useEffect(() => {
    init();
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

      const pres = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", u.id)
        .single();

      const r = (pres.data?.role ?? null) as Role;

      setRole(r);

      if (!canCreateOrders(normalizeRole(r))) {
        setErrorMsg(
          "No tienes permisos para crear órdenes."
        );

        setLoading(false);
        return;
      }

      // PRODUCTOS
      const prodRes = await supabase
        .from("productos")
        .select(
          "id, sku, name, description, image_path, category, is_active"
        )
        .eq("is_active", true)
        .order("category", {
          ascending: true,
        })
        .order("name", {
          ascending: true,
        });

      if (prodRes.error) {
        throw prodRes.error;
      }

      setProducts(
        (prodRes.data ?? []) as Product[]
      );

      // CONFIGURACIÓN
      const setRes = await supabase
        .from("sale_channel_settings")
        .select("channel, default_days");

      if (setRes.error) {
        throw setRes.error;
      }

      setSettings(
        (setRes.data ?? []) as ChannelSetting[]
      );
    } catch (e: any) {
      setErrorMsg(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const settingsMap = useMemo(() => {
    const m: Partial<
      Record<SaleChannel, number | null>
    > = {};

    for (const s of settings) {
      m[s.channel] = s.default_days ?? null;
    }

    return m;
  }, [settings]);

  const previewDueDate = useMemo(() => {
    if (dueDate) return dueDate;

    if (saleChannel === "institucional") {
      return "";
    }

    const days = (settingsMap[saleChannel] ??
      4) as number;

    const d = new Date();

    d.setDate(d.getDate() + days);

    return d.toISOString().slice(0, 10);
  }, [dueDate, saleChannel, settingsMap]);

  const productById = useMemo(() => {
    const m: Record<string, Product> = {};

    for (const p of products) {
      m[p.id] = p;
    }

    return m;
  }, [products]);

  // CATEGORÍAS
  const categoryOptions = useMemo(() => {
    const set = new Set<string>();

    for (const p of products) {
      const cat =
        (p.category ?? "Sin categoría").trim() ||
        "Sin categoría";

      set.add(cat);
    }

    return Array.from(set).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [products]);

  // FILTROS
  const filteredProducts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    return products.filter((p) => {
      const cat =
        (p.category ?? "Sin categoría").trim() ||
        "Sin categoría";

      const okCategory =
        selectedCategory === "ALL"
          ? true
          : cat === selectedCategory;

      const name = (
        p.name ?? ""
      ).toLowerCase();

      const sku = (
        p.sku ?? ""
      ).toLowerCase();

      const desc = (
        p.description ?? ""
      ).toLowerCase();

      const okSearch =
        q.length === 0
          ? true
          : name.includes(q) ||
            sku.includes(q) ||
            desc.includes(q);

      return okCategory && okSearch;
    });
  }, [
    products,
    selectedCategory,
    searchTerm,
  ]);

  // AGRUPAR
  const productsByCategory = useMemo(() => {
    const m: Record<string, Product[]> = {};

    for (const p of filteredProducts) {
      const cat =
        (p.category ?? "Sin categoría").trim() ||
        "Sin categoría";

      if (!m[cat]) {
        m[cat] = [];
      }

      m[cat].push(p);
    }

    return m;
  }, [filteredProducts]);

  // AGREGAR ITEM
  const addItem = (pid: string) => {
    setItems((prev) => {
      const existing = prev.find(
        (x) => x.product_id === pid
      );

      if (existing) {
        return prev.map((x) =>
          x.product_id === pid
            ? {
                ...x,
                qty: x.qty + 1,
              }
            : x
        );
      }

      return [
        ...prev,
        {
          product_id: pid,
          qty: 1,
        },
      ];
    });
  };

  const removeItem = (pid: string) => {
    setItems((prev) =>
      prev.filter((x) => x.product_id !== pid)
    );
  };

  const changeQty = (
    pid: string,
    qty: number
  ) => {
    setItems((prev) =>
      prev.map((x) =>
        x.product_id === pid
          ? {
              ...x,
              qty: Math.max(1, qty),
            }
          : x
      )
    );
  };

  const totalQty = useMemo(() => {
    return items.reduce(
      (a, b) => a + (b.qty || 0),
      0
    );
  }, [items]);

  const createOrder = async () => {
    setErrorMsg("");

    if (!clientName.trim()) {
      setErrorMsg(
        "Debes ingresar el nombre del cliente."
      );
      return;
    }

    if (items.length === 0) {
      setErrorMsg(
        "Debes agregar al menos 1 producto."
      );
      return;
    }

    setSaving(true);

    try {
      const orderPayload: any = {
        client_name: clientName.trim(),
        display_code_manual:
          manualCode.trim() || null,
        sale_channel: saleChannel,
        quantity: totalQty,
        created_by: userId,
        due_date: dueDate || null,
        notes: notes.trim() || null,
      };

      const oRes = await supabase
        .from("ordenes_de_produccion")
        .insert(orderPayload)
        .select("id")
        .single();

      if (oRes.error) {
        throw oRes.error;
      }

      const orderId = oRes.data.id as string;

      const rows = items.map((it) => {
        const p =
          productById[it.product_id];

        return {
          order_id: orderId,
          product_id: it.product_id,
          qty: it.qty,
          product_name: p?.name ?? "",
          category:
            p?.category ?? "Sin categoría",
          product_image_path:
            p?.image_path ?? null,
        };
      });

      const iRes = await supabase
        .from("orden_items")
        .insert(rows);

      if (iRes.error) {
        throw iRes.error;
      }

      window.location.href = `/orders/${orderId}`;
    } catch (e: any) {
      setErrorMsg(
        e?.message ?? String(e)
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        Cargando...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-6xl mx-auto">

        {/* FORMULARIO */}
        <div className="bg-white border rounded-2xl p-4">
          <div className="text-2xl font-bold">
            Crear orden
          </div>

          {errorMsg && (
            <div className="mt-3 border border-red-300 bg-red-50 text-red-700 rounded-xl p-3 text-sm">
              <b>Error:</b> {errorMsg}
            </div>
          )}

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">

            <div>
              <label className="text-sm text-gray-600">
                Cliente
              </label>

              <input
                className="w-full border rounded-xl px-3 py-2"
                value={clientName}
                onChange={(e) =>
                  setClientName(e.target.value)
                }
              />
            </div>

            <div>
              <label className="text-sm text-gray-600">
                Consecutivo manual
              </label>

              <input
                className="w-full border rounded-xl px-3 py-2"
                value={manualCode}
                onChange={(e) =>
                  setManualCode(e.target.value)
                }
              />
            </div>

            <div>
              <label className="text-sm text-gray-600">
                Tipo venta
              </label>

              <select
                className="w-full border rounded-xl px-3 py-2"
                value={saleChannel}
                onChange={(e) =>
                  setSaleChannel(
                    e.target.value as SaleChannel
                  )
                }
              >
                {Object.entries(CHANNEL_LABEL).map(
                  ([k, v]) => (
                    <option
                      key={k}
                      value={k}
                    >
                      {v}
                    </option>
                  )
                )}
              </select>
            </div>

            <div>
              <label className="text-sm text-gray-600">
                Fecha entrega
              </label>

              <input
                type="date"
                className="w-full border rounded-xl px-3 py-2"
                value={dueDate}
                onChange={(e) =>
                  setDueDate(e.target.value)
                }
              />
            </div>

          </div>

          <div className="mt-3">
            <label className="text-sm text-gray-600">
              Notas
            </label>

            <textarea
              className="w-full border rounded-xl px-3 py-2 min-h-[120px]"
              value={notes}
              onChange={(e) =>
                setNotes(e.target.value)
              }
              placeholder="Observaciones, indicaciones especiales, colores, tallas, etc..."
            />
          </div>

          {/* ITEMS */}
          <div className="mt-6">
            <div className="text-lg font-semibold">
              Productos seleccionados
            </div>

            {items.length === 0 ? (
              <div className="text-sm text-gray-500 mt-2">
                No hay productos agregados.
              </div>
            ) : (
              <div className="mt-3 grid gap-3">
                {items.map((it) => {
                  const p =
                    productById[it.product_id];

                  return (
                    <div
                      key={it.product_id}
                      className="border rounded-2xl p-3 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">

                        {p?.image_path ? (
                          <img
                            src={p.image_path}
                            alt={p.name ?? ""}
                            className="w-16 h-16 object-cover rounded-xl border"
                          />
                        ) : (
                          <div className="w-16 h-16 bg-gray-100 rounded-xl border" />
                        )}

                        <div>
                          <div className="font-semibold">
                            {p?.name ?? "-"}
                          </div>

                          <div className="text-xs text-gray-600">
                            SKU: {p?.sku ?? "-"}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          className="w-20 border rounded-xl px-3 py-2"
                          value={it.qty}
                          onChange={(e) =>
                            changeQty(
                              it.product_id,
                              Number(e.target.value)
                            )
                          }
                        />

                        <button
                          className="border px-3 py-2 rounded-xl"
                          onClick={() =>
                            removeItem(
                              it.product_id
                            )
                          }
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

          {/* BOTONES */}
          <div className="mt-6 flex gap-2">
            <button
              className="border px-4 py-2 rounded-xl"
              onClick={() =>
                (window.location.href = "/")
              }
            >
              Cancelar
            </button>

            <button
              className="px-4 py-2 rounded-xl bg-black text-white"
              disabled={saving}
              onClick={createOrder}
            >
              {saving
                ? "Creando..."
                : "Crear orden"}
            </button>
          </div>
        </div>

        {/* CATÁLOGO */}
        <div className="mt-4 bg-white border rounded-2xl p-4">

          <div className="text-xl font-bold">
            Catálogo
          </div>

          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">

            <input
              className="border rounded-xl px-3 py-2"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) =>
                setSearchTerm(e.target.value)
              }
            />

            <select
              className="border rounded-xl px-3 py-2"
              value={selectedCategory}
              onChange={(e) =>
                setSelectedCategory(
                  e.target.value
                )
              }
            >
              <option value="ALL">
                Todas
              </option>

              {categoryOptions.map((c) => (
                <option
                  key={c}
                  value={c}
                >
                  {c}
                </option>
              ))}
            </select>

            <button
              className="border rounded-xl px-3 py-2"
              onClick={() => {
                setSearchTerm("");
                setSelectedCategory("ALL");
              }}
            >
              Limpiar filtros
            </button>
          </div>

          <div className="mt-6 space-y-6">

            {Object.keys(
              productsByCategory
            ).map((cat) => (
              <div key={cat}>

                <div className="font-semibold mb-2">
                  {cat}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">

                  {productsByCategory[cat].map(
                    (p) => (
                      <div
                        key={p.id}
                        className="border rounded-2xl p-3"
                      >
                        <div className="flex gap-3">

                          <div className="shrink-0">
                            {p.image_path ? (
                              <img
                                src={p.image_path}
                                alt={p.name ?? ""}
                                className="w-24 h-24 object-cover rounded-xl border"
                              />
                            ) : (
                              <div className="w-24 h-24 bg-gray-100 rounded-xl border flex items-center justify-center text-xs text-gray-400">
                                Sin foto
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">

                            <div className="font-bold truncate">
                              {p.name ?? "-"}
                            </div>

                            <div className="text-xs text-gray-600">
                              SKU: {p.sku ?? "-"}
                            </div>

                            <div className="text-xs text-gray-500 mt-1 line-clamp-3">
                              {p.description ?? ""}
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                addItem(p.id)
                              }
                              className="mt-3 px-3 py-2 rounded-xl bg-black text-white text-sm"
                            >
                              ➕ Agregar
                            </button>

                          </div>
                        </div>
                      </div>
                    )
                  )}

                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}