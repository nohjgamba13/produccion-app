"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    // Si ya está logueado, manda al home
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) window.location.href = "/";
    })();
  }, []);

  const handleLogin = async () => {
    setMsg("");
    if (!email.trim() || !password) return setMsg("Ingresa email y contraseña.");

    setLoading(true);
    try {
      const res = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (res.error) throw res.error;

      window.location.href = "/";
    } catch (e: any) {
      setMsg(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setMsg("");
    if (!email.trim() || !password) return setMsg("Ingresa email y contraseña.");
    if (password.length < 6) return setMsg("La contraseña debe tener mínimo 6 caracteres.");

    setLoading(true);
    try {
      const res = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (res.error) throw res.error;

      // En Supabase, dependiendo de tu config, puede pedir confirmación por email.
      // Si no pides confirmación, quedará logueado directo.
      setMsg(
        "✅ Cuenta creada. Si tu proyecto pide confirmación por correo, revisa tu email. Si no, ya puedes iniciar sesión."
      );

      // Intentar iniciar sesión directo (por si no requiere confirmación)
      const login = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (!login.error) window.location.href = "/";
    } catch (e: any) {
      setMsg(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setMsg("");
    if (!email.trim()) return setMsg("Escribe tu email para enviar recuperación.");

    setLoading(true);
    try {
      const res = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/login`,
      });
      if (res.error) throw res.error;
      setMsg("✅ Te envié un correo para restablecer la contraseña.");
    } catch (e: any) {
      setMsg(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-100 p-4 flex items-center justify-center">
      <div className="w-full max-w-md bg-white border rounded-2xl p-5">
        <h1 className="text-2xl font-bold">Acceso</h1>
        <p className="text-sm text-gray-600 mt-1">
          Inicia sesión o crea una cuenta para usar el sistema.
        </p>

        {/* Tabs */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            className={`px-3 py-2 rounded-xl border ${
              mode === "login" ? "bg-black text-white" : "bg-white"
            }`}
            onClick={() => {
              setMode("login");
              setMsg("");
            }}
            disabled={loading}
          >
            Iniciar sesión
          </button>
          <button
            className={`px-3 py-2 rounded-xl border ${
              mode === "register" ? "bg-black text-white" : "bg-white"
            }`}
            onClick={() => {
              setMode("register");
              setMsg("");
            }}
            disabled={loading}
          >
            Registro
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <input
            className="border p-3 rounded-xl w-full"
            placeholder="Correo"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            autoComplete="email"
          />
          <input
            className="border p-3 rounded-xl w-full"
            placeholder="Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />

          {mode === "login" ? (
            <>
              <button
                className="w-full bg-black text-white px-4 py-3 rounded-xl disabled:opacity-50"
                onClick={handleLogin}
                disabled={loading}
              >
                {loading ? "Ingresando..." : "Ingresar"}
              </button>

              <button
                className="w-full border px-4 py-3 rounded-xl bg-white disabled:opacity-50"
                onClick={handleResetPassword}
                disabled={loading}
              >
                {loading ? "Enviando..." : "Olvidé mi contraseña"}
              </button>
            </>
          ) : (
            <button
              className="w-full bg-black text-white px-4 py-3 rounded-xl disabled:opacity-50"
              onClick={handleRegister}
              disabled={loading}
            >
              {loading ? "Creando..." : "Crear cuenta"}
            </button>
          )}

          {msg && (
            <div className="text-sm border rounded-xl p-3 bg-gray-50">
              {msg}
            </div>
          )}

          <div className="text-xs text-gray-500">
            * Si activaste “confirmación por email” en Supabase, el usuario debe confirmar el correo antes de entrar.
          </div>
        </div>
      </div>
    </main>
  );
}

