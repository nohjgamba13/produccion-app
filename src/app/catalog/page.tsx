"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Role = "admin" | "supervisor" | "operator" | null;

const PROFILES_TABLE = "profiles";
const PRODUCTS_TABLE = "productos";
const PRODUCT_IMAGES_BUCKET = "product-images";

type Product = {
  id: string;
  sku: string | null;
  name: string;
  image_path: string;
  is_active: boolean;
  created_at?: string;

  category: string | null;
  base_price: number | null;
  lead_time_days: number | null;
  tech_pdf_url: string | null;
};

type SortType =
  | "created_desc"
  | "created_asc"
  | "sku_asc"
  | "sku_desc"
  | "name_asc"
  | "name_desc";

function isValidHttpUrl(u?: string | null) {
  return !!u && /^https?:\/\//i.test(u);
}

function money(n?: number | null) {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";

  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function CatalogPage() {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<Role>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [products, setProducts] = useState<Product[]>([]);

  const [search, setSearch] = useState("");
  const [onlyActive, setOnlyActive] = useState(true);

  const [categoryFilter, setCategoryFilter] =
    useState<string>("__all__");

  const [groupByCategory, setGroupByCategory] =
    useState(true);

  const [sortBy, setSortBy] =
    useState<SortType>("created_desc");

  // FORM
  const [editingId, setEditingId] =
    useState<string | null>(null);

  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");

  const [basePrice, setBasePrice] =
    useState<string>("");

  const [leadTimeDays, setLeadTimeDays] =
    useState<string>("");

  const [techPdfUrl, setTechPdfUrl] =
    useState("");

  const [isActive, setIsActive] =
    useState(true);

  const [imageFile, setImageFile] =
    useState<File | null>(null);

  const [imageUrl, setImageUrl] =
    useState("");

  const canEdit = role === "admin";

  useEffect(() => {
    init();
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

      const pres = await supabase
        .from(PROFILES_TABLE)
        .select("role")
        .eq("user_id", u.id)
        .single();

      setRole((pres.data?.role ?? null) as Role);

      await loadProducts();
    } catch (e: any) {
      setErrorMsg(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    setErrorMsg("");

    const res = await supabase
      .from(PRODUCTS_TABLE)
      .select(
        "id, sku, name, image_path, is_active, created_at, category, base_price, lead_time_days, tech_pdf_url"
      );

    if (res.error) {
      setErrorMsg(
        "No pude cargar productos: " +
          res.error.message
      );

      setProducts([]);
      return;
    }

    setProducts((res.data ?? []) as Product[]);
  };

  const categories = useMemo(() => {
    const set = new Set<string>();

    for (const p of products) {
      const c = (p.category ?? "").trim();

      if (c) set.add(c);
    }

    return Array.from(set).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [products]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();

    let arr = products.filter((p) => {
      if (onlyActive && !p.is_active)
        return false;

      if (categoryFilter !== "__all__") {
        const c = (p.category ?? "").trim();

        if (c !== categoryFilter)
          return false;
      }

      if (!s) return true;

      const hay =
        `${p.name} ${p.sku ?? ""} ${p.category ?? ""}`.toLowerCase();

      return hay.includes(s);
    });

    arr = [...arr];

    arr.sort((a, b) => {
      switch (sortBy) {
        case "created_desc":
          return (
            new Date(
              b.created_at ?? ""
            ).getTime() -
            new Date(
              a.created_at ?? ""
            ).getTime()
          );

        case "created_asc":
          return (
            new Date(
              a.created_at ?? ""
            ).getTime() -
            new Date(
              b.created_at ?? ""
            ).getTime()
          );

        case "sku_asc":
          return (a.sku ?? "").localeCompare(
            b.sku ?? ""
          );

        case "sku_desc":
          return (b.sku ?? "").localeCompare(
            a.sku ?? ""
          );

        case "name_asc":
          return a.name.localeCompare(
            b.name
          );

        case "name_desc":
          return b.name.localeCompare(
            a.name
          );

        default:
          return 0;
      }
    });

    return arr;
  }, [
    products,
    search,
    onlyActive,
    categoryFilter,
    sortBy,
  ]);

  const grouped = useMemo(() => {
    const map: Record<string, Product[]> =
      {};

    for (const p of filtered) {
      const c =
        (p.category ?? "").trim() ||
        "(Sin categoría)";

      if (!map[c]) map[c] = [];

      map[c].push(p);
    }

    return map;
  }, [filtered]);

  const resetForm = () => {
    setEditingId(null);
    setSku("");
    setName("");
    setCategory("");
    setBasePrice("");
    setLeadTimeDays("");
    setTechPdfUrl("");
    setIsActive(true);
    setImageFile(null);
    setImageUrl("");
  };

  const startEdit = (p: Product) => {
    setEditingId(p.id);

    setSku(p.sku ?? "");
    setName(p.name ?? "");
    setCategory(p.category ?? "");

    setBasePrice(
      p.base_price !== null
        ? String(p.base_price)
        : ""
    );

    setLeadTimeDays(
      p.lead_time_days !== null
        ? String(p.lead_time_days)
        : ""
    );

    setTechPdfUrl(
      p.tech_pdf_url ?? ""
    );

    setIsActive(!!p.is_active);

    setImageUrl(p.image_path ?? "");

    setImageFile(null);
  };

  const uploadProductImage = async (
    file: File
  ) => {
    const ext =
      file.name.split(".").pop() ||
      "jpg";

    const safe =
      `${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`.replace(
        /[^a-z0-9\-]/gi,
        ""
      );

    const path = `products/${safe}.${ext}`;

    const up = await supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .upload(path, file, {
        upsert: true,
      });

    if (up.error) throw up.error;

    const pub = supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .getPublicUrl(path);

    return pub.data.publicUrl;
  };

  const saveProduct = async () => {
    setErrorMsg("");

    if (!canEdit) {
      alert(
        "Solo ADMIN puede editar."
      );

      return;
    }

    if (!name.trim()) {
      alert("Falta nombre.");
      return;
    }

    if (!category.trim()) {
      alert("Falta categoría.");
      return;
    }

    setSaving(true);

    try {
      let finalImageUrl =
        imageUrl;

      if (imageFile) {
        finalImageUrl =
          await uploadProductImage(
            imageFile
          );
      }

      const payload = {
        sku: sku.trim() || null,
        name: name.trim(),
        category: category.trim(),
        base_price:
          basePrice.trim() === ""
            ? null
            : Number(basePrice),
        lead_time_days:
          leadTimeDays.trim() === ""
            ? null
            : Number(leadTimeDays),
        tech_pdf_url:
          techPdfUrl.trim() || null,
        image_path:
          finalImageUrl || null,
        is_active: isActive,
      };

      if (editingId) {
        const upd = await supabase
          .from(PRODUCTS_TABLE)
          .update(payload)
          .eq("id", editingId);

        if (upd.error)
          throw upd.error;
      } else {
        const ins = await supabase
          .from(PRODUCTS_TABLE)
          .insert(payload);

        if (ins.error)
          throw ins.error;
      }

      await loadProducts();

      resetForm();

      alert(
        "✅ Producto guardado."
      );
    } catch (e: any) {
      alert(
        "Error: " +
          (e?.message ??
            String(e))
      );
    } finally {
      setSaving(false);
    }
  };

  const ProductCard = ({
    p,
  }: {
    p: Product;
  }) => (
    <div className="border rounded-2xl overflow-hidden bg-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={p.image_path}
        alt={p.name}
        className="w-full h-48 object-cover"
      />

      <div className="p-3">
        <div className="font-bold">
          {p.name}
        </div>

        <div className="text-xs text-gray-600">
          SKU: {p.sku ?? "-"}
        </div>

        <div className="text-xs text-gray-600">
          Categoría:{" "}
          {p.category ?? "-"}
        </div>

        <div className="text-xs text-gray-600">
          Creado:{" "}
          {p.created_at
            ? new Date(
                p.created_at
              ).toLocaleDateString()
            : "-"}
        </div>

        <div className="text-xs text-gray-600">
          Precio:{" "}
          {money(p.base_price)}
        </div>

        <div className="mt-3 flex gap-2">
          {canEdit && (
            <button
              className="border px-3 py-1 rounded-xl text-sm"
              onClick={() =>
                startEdit(p)
              }
            >
              Editar
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="p-6">
        Cargando catálogo...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">
              Catálogo
            </h1>

            <div className="text-sm text-gray-600">
              Usuario:{" "}
              <b>
                {user?.email ?? "-"}
              </b>
            </div>
          </div>

          <button
            className="border px-3 py-2 rounded-xl bg-white"
            onClick={() =>
              (window.location.href =
                "/")
            }
          >
            ← Volver
          </button>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-[380px_1fr]">
          {/* FORM */}
          <div className="bg-white border rounded-2xl p-4">
            <div className="text-lg font-semibold">
              {editingId
                ? "Editar producto"
                : "Nuevo producto"}
            </div>

            <div className="mt-3 space-y-3">
              <input
                className="border p-3 rounded-xl w-full"
                placeholder="Nombre"
                value={name}
                onChange={(e) =>
                  setName(
                    e.target.value
                  )
                }
              />

              <input
                className="border p-3 rounded-xl w-full"
                placeholder="SKU"
                value={sku}
                onChange={(e) =>
                  setSku(
                    e.target.value
                  )
                }
              />

              <input
                className="border p-3 rounded-xl w-full"
                placeholder="Categoría"
                value={category}
                onChange={(e) =>
                  setCategory(
                    e.target.value
                  )
                }
              />

              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  setImageFile(
                    e.target
                      .files?.[0] ??
                      null
                  )
                }
              />

              <button
                className="w-full bg-black text-white px-4 py-3 rounded-xl"
                onClick={saveProduct}
                disabled={saving}
              >
                {saving
                  ? "Guardando..."
                  : editingId
                  ? "Guardar cambios"
                  : "Crear producto"}
              </button>
            </div>
          </div>

          {/* LISTA */}
          <div className="bg-white border rounded-2xl p-4">
            <div className="flex flex-wrap gap-2 items-center">
              <input
                className="border p-2 rounded-xl"
                placeholder="Buscar..."
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
              />

              <select
                className="border p-2 rounded-xl"
                value={categoryFilter}
                onChange={(e) =>
                  setCategoryFilter(
                    e.target.value
                  )
                }
              >
                <option value="__all__">
                  Todas categorías
                </option>

                {categories.map((c) => (
                  <option
                    key={c}
                    value={c}
                  >
                    {c}
                  </option>
                ))}
              </select>

              <select
                className="border p-2 rounded-xl"
                value={sortBy}
                onChange={(e) =>
                  setSortBy(
                    e.target
                      .value as SortType
                  )
                }
              >
                <option value="created_desc">
                  Más recientes
                </option>

                <option value="created_asc">
                  Más antiguos
                </option>

                <option value="sku_asc">
                  SKU ascendente
                </option>

                <option value="sku_desc">
                  SKU descendente
                </option>

                <option value="name_asc">
                  Nombre A-Z
                </option>

                <option value="name_desc">
                  Nombre Z-A
                </option>
              </select>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={onlyActive}
                  onChange={(e) =>
                    setOnlyActive(
                      e.target.checked
                    )
                  }
                />
                Solo activos
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={
                    groupByCategory
                  }
                  onChange={(e) =>
                    setGroupByCategory(
                      e.target.checked
                    )
                  }
                />
                Agrupar
              </label>
            </div>

            <div className="mt-5">
              {!groupByCategory ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((p) => (
                    <ProductCard
                      key={p.id}
                      p={p}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.keys(grouped)
                    .sort((a, b) =>
                      a.localeCompare(b)
                    )
                    .map((cat) => (
                      <div key={cat}>
                        <h2 className="font-bold text-lg mb-3">
                          {cat}
                        </h2>

                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {grouped[
                            cat
                          ].map((p) => (
                            <ProductCard
                              key={p.id}
                              p={p}
                            />
                          ))}
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
