"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Role = "admin" | "supervisor" | "operator" | null;

const PROFILES_TABLE = "profiles";
const PRODUCTS_TABLE = "productos";

// Bucket para imágenes del catálogo (debe existir en Storage)
const PRODUCT_IMAGES_BUCKET = "product-images";

type Product = {
  id: string;
  sku: string | null;
  name: string;
  image_path: string; // URL pública
  is_active: boolean;
  created_at?: string;

  category: string | null;
  base_price: number | null;
  lead_time_days: number | null;
  tech_pdf_url: string | null;
};

function isValidHttpUrl(u?: string | null) {
  return !!u && /^https?:\/\//i.test(u);
}

function money(n?: number | null) {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
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

  // Form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [basePrice, setBasePrice] = useState<string>(""); // string para input
  const [leadTimeDays, setLeadTimeDays] = useState<string>(""); // string para input
  const [techPdfUrl, setTechPdfUrl] = useState("");

  const [isActive, setIsActive] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState(""); // URL guardada en DB

  const canEdit = role === "admin"; // catálogo lo controla admin

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
      .select("id, sku, name, image_path, is_active, created_at, category, base_price, lead_time_days, tech_pdf_url")
      .order("created_at", { ascending: false });

    if (res.error) {
      setErrorMsg("No pude cargar el catálogo (productos). Error: " + res.error.message);
      setProducts([]);
      return;
    }

    setProducts((res.data ?? []) as Product[]);
  };

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return products.filter((p) => {
      if (onlyActive && !p.is_active) return false;
      if (!s) return true;
      const hay = `${p.name} ${p.sku ?? ""} ${p.category ?? ""}`.toLowerCase();
      return hay.includes(s);
    });
  }, [products, search, onlyActive]);

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
    setBasePrice(p.base_price !== null && p.base_price !== undefined ? String(p.base_price) : "");
    setLeadTimeDays(p.lead_time_days !== null && p.lead_time_days !== undefined ? String(p.lead_time_days) : "");
    setTechPdfUrl(p.tech_pdf_url ?? "");
    setIsActive(!!p.is_active);
    setImageUrl(p.image_path ?? "");
    setImageFile(null);
  };

  const uploadProductImage = async (file: File) => {
    const ext = file.name.split(".").pop() || "jpg";
    const safe = `${Date.now()}-${Math.random().toString(16).slice(2)}`.replace(/[^a-z0-9\-]/gi, "");
    const path = `products/${safe}.${ext}`;

    const up = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).upload(path, file, { upsert: true });
    if (up.error) throw up.error;

    const pub = supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path);
    const url = pub.data.publicUrl;
    if (!url) throw new Error("No se pudo obtener URL pública de la imagen.");
    return url;
  };

  const saveProduct = async () => {
    setErrorMsg("");

    if (!canEdit) return alert("Solo el ADMIN puede editar el catálogo.");
    if (!name.trim()) return alert("Falta el nombre del producto.");

    // Foto obligatoria
    const isNew = !editingId;
    if (isNew && !imageFile) return alert("La foto del producto es obligatoria (selecciona una imagen).");
    if (!isNew && !imageFile && !isValidHttpUrl(imageUrl)) {
      return alert("La foto del producto es obligatoria (sube una imagen o conserva una URL válida).");
    }

    // Validaciones numéricas suaves
    const bp = basePrice.trim() === "" ? null : Number(basePrice);
    if (bp !== null && (!isFinite(bp) || bp < 0)) return alert("Precio base inválido.");

    const ltd = leadTimeDays.trim() === "" ? null : Number(leadTimeDays);
    if (ltd !== null && (!Number.isInteger(ltd) || ltd < 0)) return alert("Días estimados inválido.");

    if (techPdfUrl.trim() && !isValidHttpUrl(techPdfUrl.trim())) {
      return alert("La URL del PDF debe iniciar con http(s).");
    }

    setSaving(true);

    try {
      let finalImageUrl = imageUrl;

      if (imageFile) {
        finalImageUrl = await uploadProductImage(imageFile);
      }

      if (!isValidHttpUrl(finalImageUrl)) {
        throw new Error("La imagen no quedó como URL http(s). Revisa el bucket y que sea público.");
      }

      const payload: any = {
        sku: sku.trim() ? sku.trim() : null,
        name: name.trim(),
        category: category.trim() ? category.trim() : null,
        base_price: bp,
        lead_time_days: ltd,
        tech_pdf_url: techPdfUrl.trim() ? techPdfUrl.trim() : null,
        image_path: finalImageUrl,
        is_active: !!isActive,
      };

      if (editingId) {
        const upd = await supabase.from(PRODUCTS_TABLE).update(payload).eq("id", editingId);
        if (upd.error) throw upd.error;
      } else {
        const ins = await supabase.from(PRODUCTS_TABLE).insert(payload);
        if (ins.error) throw ins.error;
      }

      await loadProducts();
      resetForm();
    } catch (e: any) {
      setErrorMsg(e?.message ?? String(e));
      alert("Error guardando producto: " + (e?.message ?? String(e)));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (p: Product) => {
    if (!canEdit) return alert("Solo ADMIN puede activar/desactivar.");
    setSaving(true);
    try {
      const upd = await supabase.from(PRODUCTS_TABLE).update({ is_active: !p.is_active }).eq("id", p.id);
      if (upd.error) throw upd.error;
      await loadProducts();
    } catch (e: any) {
      alert("Error: " + (e?.message ?? String(e)));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6">Cargando catálogo...</div>;

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Catálogo de Productos</h1>
            <div className="text-sm text-gray-600">
              Usuario: <b>{user?.email ?? "-"}</b> — Rol: <b>{role ?? "sin rol"}</b>
            </div>
            {!canEdit && (
              <div className="text-xs text-gray-500 mt-1">
                * Solo el <b>ADMIN</b> puede crear/editar. Los demás solo ven.
              </div>
            )}
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

        <div className="mt-4 grid gap-4 md:grid-cols-[380px_1fr] items-start">
          {/* Form */}
          <div className="bg-white border rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">{editingId ? "Editar producto" : "Nuevo producto"}</div>
              {editingId && (
                <button className="text-sm underline" onClick={resetForm} disabled={saving}>
                  Cancelar
                </button>
              )}
            </div>

            <div className="mt-3 space-y-3">
              <input
                className="border p-3 rounded-xl w-full"
                placeholder="Nombre del producto"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!canEdit || saving}
              />

              <input
                className="border p-3 rounded-xl w-full"
                placeholder="SKU (opcional)"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                disabled={!canEdit || saving}
              />

              <input
                className="border p-3 rounded-xl w-full"
                placeholder="Categoría (ej: Morrales, Camisetas...)"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={!canEdit || saving}
              />

              <div className="grid grid-cols-2 gap-2">
                <input
                  className="border p-3 rounded-xl w-full"
                  placeholder="Precio base (COP)"
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                  disabled={!canEdit || saving}
                  inputMode="numeric"
                />
                <input
                  className="border p-3 rounded-xl w-full"
                  placeholder="Días estimados"
                  value={leadTimeDays}
                  onChange={(e) => setLeadTimeDays(e.target.value)}
                  disabled={!canEdit || saving}
                  inputMode="numeric"
                />
              </div>

              <input
                className="border p-3 rounded-xl w-full"
                placeholder="URL ficha técnica PDF (opcional)"
                value={techPdfUrl}
                onChange={(e) => setTechPdfUrl(e.target.value)}
                disabled={!canEdit || saving}
              />

              <label className="text-sm font-medium">Foto del producto (obligatoria)</label>
              <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} disabled={!canEdit || saving} />

              {(imageFile || isValidHttpUrl(imageUrl)) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageFile ? URL.createObjectURL(imageFile) : imageUrl}
                  alt="Preview"
                  className="w-full h-44 object-cover rounded-xl border"
                />
              )}

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} disabled={!canEdit || saving} />
                Activo
              </label>

              <button className="w-full bg-black text-white px-4 py-3 rounded-xl disabled:opacity-50" onClick={saveProduct} disabled={!canEdit || saving}>
                {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Crear producto"}
              </button>
            </div>
          </div>

          {/* List */}
          <div className="bg-white border rounded-2xl p-4">
            <div className="flex flex-wrap gap-2 items-center justify-between">
              <div className="text-lg font-semibold">Productos</div>

              <div className="flex gap-2 flex-wrap">
                <input className="border p-2 rounded-xl" placeholder="Buscar por nombre, SKU o categoría" value={search} onChange={(e) => setSearch(e.target.value)} />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} />
                  Solo activos
                </label>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((p) => (
                <div key={p.id} className="border rounded-2xl overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.image_path} alt={p.name} className="w-full h-36 object-cover border-b" />

                  <div className="p-3">
                    <div className="font-bold">{p.name}</div>
                    <div className="text-xs text-gray-600">SKU: {p.sku ?? "-"}</div>
                    <div className="text-xs text-gray-600">Categoría: {p.category ?? "-"}</div>
                    <div className="text-xs text-gray-600">Precio base: {money(p.base_price)}</div>
                    <div className="text-xs text-gray-600">Días estimados: {p.lead_time_days ?? "-"}</div>

                    {p.tech_pdf_url ? (
                      <div className="mt-2">
                        <a className="text-sm underline" href={p.tech_pdf_url} target="_blank" rel="noreferrer">
                          Ver ficha técnica (PDF)
                        </a>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400 mt-2">Sin ficha técnica</div>
                    )}

                    <div className="mt-2 flex items-center justify-between">
                      <span className={`text-xs px-2 py-1 rounded-full ${p.is_active ? "bg-green-100" : "bg-gray-200"}`}>
                        {p.is_active ? "Activo" : "Inactivo"}
                      </span>

                      <div className="flex gap-2">
                        <button className="text-sm border px-3 py-1 rounded-xl disabled:opacity-50" onClick={() => startEdit(p)} disabled={!canEdit || saving}>
                          Editar
                        </button>
                        <button className="text-sm border px-3 py-1 rounded-xl disabled:opacity-50" onClick={() => toggleActive(p)} disabled={!canEdit || saving}>
                          {p.is_active ? "Desactivar" : "Activar"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {filtered.length === 0 && <div className="text-sm text-gray-500">No hay productos con ese filtro.</div>}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
