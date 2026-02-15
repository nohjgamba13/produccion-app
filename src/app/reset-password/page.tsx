"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function ResetPasswordRequestPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const sendReset = async () => {
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);

    if (error) {
      alert("Error: " + error.message);
      return;
    }

    alert("Listo. Revisa tu correo para cambiar la contraseña.");
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white rounded-2xl shadow p-6 w-full max-w-md">
        <h1 className="text-2xl font-bold mb-2">Recuperar contraseña</h1>
        <p className="text-sm text-gray-600 mb-6">
          Te enviaremos un correo para crear una nueva contraseña.
        </p>

        <input
          type="email"
          placeholder="Correo"
          className="border w-full p-3 rounded-xl mb-4"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <button
          onClick={sendReset}
          disabled={loading || !email}
          className="bg-black text-white w-full p-3 rounded-xl disabled:opacity-50"
        >
          {loading ? "Enviando..." : "Enviar correo"}
        </button>
      </div>
    </main>
  );
}