"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

export default function AdminUsersPage() {
  const [role, setRole] = useState<string>("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data.user;

      if (!u) {
        window.location.href = "/login";
        return;
      }

      const { data: prof } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", u.id)
        .single();

      const r = prof?.role ?? "";
      setRole(r);

      if (r !== "admin") {
        window.location.href = "/";
      }
    })();
  }, []);

  const createUser = async () => {
    setCreating(true);

    const res = await fetch("/api/admin/create-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const json = await res.json();
    setCreating(false);

    if (!res.ok) {
      alert("Error: " + (json?.error ?? "Error"));
      return;
    }

    alert("Usuario creado correctamente ✅");
    setEmail("");
    setPassword("");
  };

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-xl mx-auto bg-white border rounded-2xl p-6">
        <h1 className="text-2xl font-bold">Admin - Crear usuarios</h1>
        <p className="text-sm text-gray-600 mt-1">
          Solo Admin puede crear usuarios. Tu rol: <b>{role || "-"}</b>
        </p>

        <div className="mt-6 space-y-3">
          <input
            className="border p-3 rounded-xl w-full"
            placeholder="Correo"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            className="border p-3 rounded-xl w-full"
            placeholder="Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            className="bg-black text-white px-4 py-3 rounded-xl w-full disabled:opacity-50"
            disabled={!email || !password || creating}
            onClick={createUser}
          >
            {creating ? "Creando..." : "Crear usuario"}
          </button>
        </div>
      </div>
    </main>
  );
}
