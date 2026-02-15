"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Role = "admin" | "supervisor" | "operator" | null;

type Product = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  image_path: string | null;
  is_active: boolean;
};

export default function ProductsPage() {
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);

  const [products, setProducts] = useState<Product[]>([]);
  const [imgUrls, setImgUrls] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");

  // Form crear producto
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const init = async () => {
    setLoading(true);
    setMsg("");

    const { data: userData } = await supabase.auth.getUser();
    const u = userData.user;
    if (!u) {
      window.location.href = "/";
      return;
    }

    const { data: prof } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", u.id)
      .single();

    const r = (prof?.role ?? null) as Role;
    setRole(r);

    await loadProducts();
    setLoading(false);
  };

  const loadProducts = async () => {
    const { data, error } = await supabase
      .from("products")
      .select("id, sku, name, description, image_path, is_active")
      .order("name", { ascending: true });

    if (error) {
      setMsg("❌ Error cargando productos: " + error.message);
      return;
    }

    const list = (data ?? []) as Product[];
    setProducts(list);

    // Generar signed urls para imágenes (bucket privado)
    const urlMap: Record<string, string> = {};
    for (const p of list) {
      if (p.image_path) {
        const { data: signed } = await supabase.storage
          .from("production")
          .createSignedUrl(p.image_path, 60 * 60); // 1 hora

        if (signed?.signedUrl) urlMap[p.id] = signed.signedUrl;
      }
    }
    setImgUrls(urlMap);
  };

  const createProduct = async () => {
    setMsg("");
    if (!sku.trim() || !name.trim()) {
      setMsg("❌ SKU y Nombre son obligatorios.");
      return;
    }

    const { error } = await supabase.from("products").insert({
      sku: sku.trim(),
      name: name.trim(),
      description: desc.trim() ? desc.trim() : null,
      is_active: true,
    });

    if (error) {
      setMsg("❌ Error creando producto: " + error.message);
      return;
    }

    setSku("");
    setName("");
    setDesc("");
    setMsg("✅ Producto creado. Ahora sube la foto (obligatoria).");
    await loadProducts();
  };

  const uploadProductImage = async (product: Product, file: File) => {
    setMsg("");
    if (!file) return;

    const safeName = file.name.replace(/\s+/g, "_");
    const path = `products/${product.id}/${Date.now()}-${safeName}`;

    // Subir al bucket
    const { error: upErr } = await supabase.storage
      .from("production")
      .upload(path, file, { upsert: true });

    if (upErr) {
      setMsg("❌ Error subiendo imagen: " + upErr.message);
      return;
    }

    // Guardar path en DB
    const { error: dbErr } = await supabase
      .from("products")
      .update({ image_path: path })
      .eq("id", product.id);

    if (dbErr) {
      setMsg("❌ Error guardando imagen en producto: " + dbErr.message);
      return;
    }

    setMsg("✅ Imagen guardada.");
    await loadProducts();
  };

  const toggleActive = async (product: Product) => {
    setMsg("");
    const { error } = await supabase
      .from("products")
      .update({ is_active: !product.is_active })
      .eq("id", product.id);

    if (error) {
      setMsg("❌ Error actualizando: " + error.message);
      return;
    }
    await loadProducts();
  };

  if (loading) return <div className="p-6">Cargando…</div>;

  if (!(role === "admin" || role === "supervisor")) {
    return (
      <main className="p-6">
        <button className="border px-3 py-2 rounded-xl" onClick={() => (window.location.href = "/")}>
          ← Volver
        </button>
        <div className="mt-4">No tienes permisos para administrar el catálogo.</div>
      </main>
    );
  }

  return (
    <main className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Catálogo de productos</h1>
          <p className="text-sm text-gray-600">Aquí la foto es obligatoria para crear órdenes.</p>
        </div>
        <button className="border px-3 py-2 rounded-xl" onClick={() => (window.location.href = "/")}>
          ← Volver
        </button>
      </div>

      {msg && <div className="mt-4 text-sm">{msg}</div>}

      <div className="mt-6 border rounded-2xl p-4">
        <h2 className="font-semibold">Crear producto</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div>
            <div className="text-sm text-gray-600 mb-1">SKU</div>
            <input className="w-full border rounded-xl p-3" value={sku} onChange={(e) => setSku(e.target.value)} />
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Nombre</div>
            <input className="w-full border rounded-xl p-3" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="md:col-span-3">
            <div className="text-sm text-gray-600 mb-1">Descripción (opcional)</div>
            <input className="w-full border rounded-xl p-3" value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
        </div>

        <button className="mt-4 bg-black text-white px-4 py-2 rounded-xl" onClick={createProduct}>
          Crear
        </button>
      </div>

      <div className="mt-6 space-y-3">
        {products.map((p) => (
          <div key={p.id} className="border rounded-2xl p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-4">
                <div className="w-20 h-20 border rounded-xl overflow-hidden flex items-center justify-center text-xs text-gray-500">
                  {imgUrls[p.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imgUrls[p.id]} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    "Sin foto"
                  )}
                </div>

                <div>
                  <div className="font-semibold">
                    {p.name} <span className="text-xs text-gray-500">({p.sku})</span>
                  </div>
                  <div className="text-sm text-gray-600">{p.description ?? ""}</div>
                  <div className="text-xs mt-1">
                    Foto:{" "}
                    <b className={p.image_path ? "text-green-700" : "text-red-700"}>
                      {p.image_path ? "OK" : "FALTA (obligatoria)"}
                    </b>
                  </div>
                  <div className="text-xs mt-1">
                    Estado: <b>{p.is_active ? "Activo" : "Inactivo"}</b>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="border px-3 py-2 rounded-xl cursor-pointer text-sm text-center">
                  Subir/Actualizar foto
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadProductImage(p, f);
                    }}
                  />
                </label>

                <button className="border px-3 py-2 rounded-xl text-sm" onClick={() => toggleActive(p)}>
                  {p.is_active ? "Desactivar" : "Activar"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
