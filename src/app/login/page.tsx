"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.replace("/");
    });
  }, []);

  const signIn = async () => {
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      alert("Error: " + error.message);
      return;
    }

    window.location.replace("/");
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white rounded-2xl shadow p-6 w-full max-w-md">
        <h1 className="text-2xl font-bold mb-2">Ingreso</h1>
        <p className="text-sm text-gray-600 mb-6">
          Ingresa con tu correo y contraseña
        </p>

        <input
          type="email"
          placeholder="Correo"
          className="border w-full p-3 rounded-xl mb-3"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Contraseña"
          className="border w-full p-3 rounded-xl mb-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <div className="text-right mb-4">
          <button
            type="button"
            className="text-sm underline text-gray-700"
            onClick={() => (window.location.href = "/reset-password")}
          >
            Olvidé mi contraseña
          </button>
        </div>

        <button
          onClick={signIn}
          disabled={loading || !email || !password}
          className="bg-black text-white w-full p-3 rounded-xl disabled:opacity-50"
        >
          {loading ? "Ingresando..." : "Entrar"}
        </button>
      </div>
    </main>
  );
}


