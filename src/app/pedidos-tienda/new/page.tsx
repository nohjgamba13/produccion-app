"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Role = "admin" | "supervisor" | "operator" | "ventas_tienda" | null;

type Product = {
  id: string;
  sku: string | null;
  name: string | null;
  description: string | null;
  image_path: string | null;
  category?: string | null;
  is_active?: boolean | null;
};

type Tienda = {
  id: string;
  nombre: string;
  ciudad: string | null;
  is_active: boolean;
};

export default function NewPedidoTiendaPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [role, setRole] = useState<Role>(null);
  const [userId, setUserId] = useState("");

  const [tiendaId, setTiendaId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<{ product_id: string; qty: number }[]>([]);

  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Tienda[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
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

      const r = (pres.data?.role ?? null) as Role;
      setRole(r);

      if (!(r === "admin" || r === "supervisor" || r === "ventas_tienda")) {
        setErrorMsg("No tienes permisos para crear pedidos tienda.");
        setLoading(false);
        return;
      }

      const prodRes = await supabase
        .from("productos")
        .select("id, sku, name, description, image_path, category, is_active")
        .eq("is_active", true)
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (prodRes.error) throw prodRes.error;
      setProducts((prodRes.data ?? []) as Product[]);

      const storesRes = await supabase
        .from("tiendas")
        .select("id, nombre, ciudad, is_active")
        .eq("is_active", true)
        .order("nombre", { ascending: true });

      if (storesRes.error) throw storesRes.error;
      setStores((storesRes.data ?? []) as Tienda[]);
    } catch (e: any) {
      setErrorMsg(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const productById = useMemo(() => {
    const map: Record<string, Product> = {};
    for (const p of products) map[p.id] = p;
    return map;
  }, [products]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      const cat = (p.category ?? "Sin categoría").trim() || "Sin categoría";
      set.add(cat);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return products.filter((p) => {
      const cat = (p.category ?? "Sin categoría").trim() || "Sin categoría";
      const okCategory = selectedCategory === "ALL" ? true : cat === selectedCategory;
      const name = (p.name ?? "").toLowerCase();
      const sku = (p.sku ?? "").toLowerCase();
      const desc = (p.description ?? "").toLowerCase();
      const okSearch = q.length === 0 ? true : name.includes(q) || sku.includes(q) || desc.includes(q);
      return okCategory && okSearch;
    });
  }, [products, selectedCategory, searchTerm]);

  const productsByCategory = useMemo(() => {
    const map: Record<string, Product[]> = {};
    for (const p of filteredProducts) {
      const cat = (p.category ?? "Sin categoría").trim() || "Sin categoría";
      if (!map[cat]) map[cat] = [];
      map[cat].push(p);
    }
    return map;
  }, [filteredProducts]);

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
      prev.map((x) => (x.product_id === pid ? { ...x, qty: Math.max(1, qty || 1) } : x))
    );
  };

  const totalQty = useMemo(() => items.reduce((acc, it) => acc + (it.qty || 0), 0), [items]);

  const createPedido = async () => {
    setErrorMsg("");

    if (!tiendaId) {
      setErrorMsg("Debes seleccionar una tienda.");
      return;
    }
    if (!dueDate) {
      setErrorMsg("Debes seleccionar una fecha de entrega.");
      return;
    }
    if (items.length === 0) {
      setErrorMsg("Debes agregar al menos 1 producto.");
      return;
    }

    setSaving(true);
    try {
      const pedidoRes = await supabase
        .from("pedidos_tienda")
        .insert({
          tienda_id: tiendaId,
          fecha_entrega: dueDate,
          notas: notes.trim() || null,
          status: "draft",
          current_stage: "crear_orden",
          created_by: userId,
        })
        .select("id")
        .single();

      if (pedidoRes.error) throw pedidoRes.error;

      const pedidoId = pedidoRes.data.id as string;

      const rows = items.map((it) => {
        const p = productById[it.product_id];
        return {
          pedido_id: pedidoId,
          product_id: it.product_id,
          qty: it.qty,
          product_name: p?.name ?? "",
          sku: p?.sku ?? null,
          category: p?.category ?? null,
          product_image_path: p?.image_path ?? null,
        };
      });

      const itemsRes = await supabase.from("pedido_tienda_items").insert(rows);
      if (itemsRes.error) throw itemsRes.error;

      window.location.href = `/pedidos-tienda/${pedidoId}`;
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
          <div className="text-2xl font-bold">Crear pedido tienda</div>
          <div className="text-sm text-gray-600 mt-1">
            Flujo: 1. Crear orden · 2. Editar y aprobar/rechazar · 3. Entregar orden
          </div>

          {errorMsg && (
            <div className="mt-3 border border-red-300 bg-red-50 text-red-700 rounded-xl p-3 text-sm">
              <b>Error:</b> {errorMsg}
            </div>
          )}

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-600">Tienda</label>
              <select
                className="w-full border rounded-xl px-3 py-2 bg-white"
                value={tiendaId}
                onChange={(e) => setTiendaId(e.target.value)}
              >
                <option value="">Selecciona una tienda</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}{s.ciudad ? ` · ${s.ciudad}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm text-gray-600">Fecha de entrega</label>
              <input
                type="date"
                className="w-full border rounded-xl px-3 py-2 bg-white"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm text-gray-600">Notas</label>
              <textarea
                className="w-full border rounded-xl px-3 py-2 bg-white min-h-[110px]"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observaciones del pedido, prioridades, indicaciones especiales..."
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-2 flex-wrap">
            <div className="text-sm text-gray-700">
              Items: <b>{items.length}</b> · Cantidad total: <b>{totalQty}</b>
            </div>

            <div className="flex gap-2">
              <button className="border px-3 py-2 rounded-xl bg-white" onClick={() => (window.location.href = "/pedidos-tienda")}>
                Cancelar
              </button>

              <button
                className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-50"
                disabled={saving}
                onClick={createPedido}
              >
                {saving ? "Creando..." : "Crear orden"}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 bg-white border rounded-2xl p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-xl font-bold">Catálogo</div>
              <div className="text-sm text-gray-600">
                Usa el mismo catálogo y selecciona los artículos del pedido.
              </div>
            </div>
            <a href="/catalog" className="border px-3 py-2 rounded-xl bg-white">
              Abrir catálogo completo
            </a>
          </div>

          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-sm text-gray-600">Buscar</label>
              <input
                className="w-full border rounded-xl px-3 py-2 bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nombre, SKU o descripción..."
              />
            </div>

            <div>
              <label className="text-sm text-gray-600">Categoría</label>
              <select
                className="w-full border rounded-xl px-3 py-2 bg-white"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="ALL">Todas</option>
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                className="w-full border px-3 py-2 rounded-xl bg-white hover:bg-gray-50"
                onClick={() => {
                  setSelectedCategory("ALL");
                  setSearchTerm("");
                }}
              >
                Limpiar filtros
              </button>
            </div>
          </div>

          <div className="mt-3 text-xs text-gray-500">
            Mostrando <b>{filteredProducts.length}</b> productos
          </div>

          {Object.keys(productsByCategory).length === 0 ? (
            <div className="text-sm text-gray-500 mt-3">
              No hay productos para los filtros seleccionados.
            </div>
          ) : (
            Object.keys(productsByCategory).map((cat) => (
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
            ))
          )}
        </div>

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
                      <button className="border px-3 py-2 rounded-xl bg-white" onClick={() => removeItem(it.product_id)}>
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
