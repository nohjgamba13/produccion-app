"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Role = "admin" | "supervisor" | "operator" | "ventas_tienda" | null;

type Tienda = {
  id: string;
  nombre: string;
  codigo: string | null;
  ciudad: string | null;
  direccion: string | null;
  is_active: boolean;
  created_at: string;
};

export default function AdminTiendasPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [role, setRole] = useState<Role>(null);

  const [stores, setStores] = useState<Tienda[]>([]);

  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [direccion, setDireccion] = useState("");
  const [isActive, setIsActive] = useState(true);

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

      const pres = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      const r = (pres.data?.role ?? null) as Role;
      setRole(r);

      if (r !== "admin") {
        setErrorMsg("Solo el administrador puede gestionar tiendas.");
        setLoading(false);
        return;
      }

      const res = await supabase
        .from("tiendas")
        .select("id, nombre, codigo, ciudad, direccion, is_active, created_at")
        .order("nombre", { ascending: true });

      if (res.error) throw res.error;
      setStores((res.data ?? []) as Tienda[]);
    } catch (e: any) {
      setErrorMsg(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const createStore = async () => {
    setErrorMsg("");

    if (!nombre.trim()) {
      setErrorMsg("El nombre de la tienda es obligatorio.");
      return;
    }

    setSaving(true);
    try {
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      const res = await supabase.from("tiendas").insert({
        nombre: nombre.trim(),
        codigo: codigo.trim() || null,
        ciudad: ciudad.trim() || null,
        direccion: direccion.trim() || null,
        is_active: isActive,
        created_by: user?.id ?? null,
      });

      if (res.error) throw res.error;

      setNombre("");
      setCodigo("");
      setCiudad("");
      setDireccion("");
      setIsActive(true);
      await init();
    } catch (e: any) {
      setErrorMsg(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  const toggleStore = async (store: Tienda) => {
    setSaving(true);
    setErrorMsg("");
    try {
      const res = await supabase
        .from("tiendas")
        .update({ is_active: !store.is_active })
        .eq("id", store.id);

      if (res.error) throw res.error;
      await init();
    } catch (e: any) {
      setErrorMsg(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6">Cargando tiendas...</div>;

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Administración de tiendas</h1>
            <div className="text-sm text-gray-600">
              Crea tiendas para que luego puedan seleccionarse en pedidos tienda.
            </div>
          </div>

          <button className="border px-3 py-2 rounded-xl bg-white" onClick={() => (window.location.href = "/pedidos-tienda")}>
            Ir a pedidos tienda
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 border border-red-300 bg-red-50 text-red-700 rounded-xl p-3 text-sm">
            <b>Error:</b> {errorMsg}
          </div>
        )}

        {role === "admin" && (
          <div className="mt-4 grid gap-4 md:grid-cols-[380px_1fr] items-start">
            <div className="bg-white border rounded-2xl p-4">
              <div className="text-lg font-semibold">Nueva tienda</div>

              <div className="mt-3 space-y-3">
                <input
                  className="border p-3 rounded-xl w-full"
                  placeholder="Nombre de la tienda"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                />

                <input
                  className="border p-3 rounded-xl w-full"
                  placeholder="Código (opcional)"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                />

                <input
                  className="border p-3 rounded-xl w-full"
                  placeholder="Ciudad (opcional)"
                  value={ciudad}
                  onChange={(e) => setCiudad(e.target.value)}
                />

                <textarea
                  className="border p-3 rounded-xl w-full min-h-[100px]"
                  placeholder="Dirección (opcional)"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                />

                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                  Activa
                </label>

                <button
                  className="w-full bg-black text-white px-4 py-3 rounded-xl disabled:opacity-50"
                  onClick={createStore}
                  disabled={saving}
                >
                  {saving ? "Guardando..." : "Crear tienda"}
                </button>
              </div>
            </div>

            <div className="bg-white border rounded-2xl p-4">
              <div className="text-lg font-semibold">Tiendas registradas</div>

              {stores.length === 0 ? (
                <div className="text-sm text-gray-500 mt-3">No hay tiendas creadas todavía.</div>
              ) : (
                <div className="mt-3 grid gap-3">
                  {stores.map((store) => (
                    <div
                      key={store.id}
                      className="border rounded-2xl p-3 flex items-center justify-between gap-3 flex-wrap"
                    >
                      <div>
                        <div className="font-semibold">{store.nombre}</div>
                        <div className="text-xs text-gray-600">
                          Código: {store.codigo || "-"} · Ciudad: {store.ciudad || "-"}
                        </div>
                        <div className="text-xs text-gray-500">{store.direccion || "Sin dirección"}</div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            store.is_active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-700"
                          }`}
                        >
                          {store.is_active ? "Activa" : "Inactiva"}
                        </span>

                        <button
                          className="border px-3 py-2 rounded-xl bg-white disabled:opacity-50"
                          onClick={() => toggleStore(store)}
                          disabled={saving}
                        >
                          {store.is_active ? "Desactivar" : "Activar"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
