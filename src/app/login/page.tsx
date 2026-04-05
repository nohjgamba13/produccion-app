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

      setMsg(
        "✅ Cuenta creada. Si tu proyecto pide confirmación por correo, revisa tu email. Si no, ya puedes iniciar sesión."
      );

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
    <main className="min-h-screen bg-gradient-to-br from-gray-100 via-white to-gray-200 p-4 flex items-center justify-center">
      <div className="w-full max-w-md bg-white/95 backdrop-blur border border-gray-200 rounded-3xl p-6 shadow-2xl">
        <div className="flex flex-col items-center text-center mb-6">
          <img
            src="/logo.png"
            alt="Logo empresa"
            className="w-36 h-36 object-contain mb-4 drop-shadow-md"
          />
          <h1 className="text-2xl font-bold text-gray-900">Sistema de Producción</h1>
          <p className="text-sm text-gray-600 mt-1">
            Inicia sesión o crea una cuenta para usar el sistema.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            className={`px-3 py-2.5 rounded-xl border transition ${
              mode === "login"
                ? "bg-black text-white border-black shadow-sm"
                : "bg-white hover:bg-gray-50"
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
            className={`px-3 py-2.5 rounded-xl border transition ${
              mode === "register"
                ? "bg-black text-white border-black shadow-sm"
                : "bg-white hover:bg-gray-50"
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

        <div className="mt-5 space-y-3">
          <input
            className="border border-gray-300 p-3 rounded-xl w-full bg-white focus:outline-none focus:ring-2 focus:ring-black/20"
            placeholder="Correo"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            autoComplete="email"
          />
          <input
            className="border border-gray-300 p-3 rounded-xl w-full bg-white focus:outline-none focus:ring-2 focus:ring-black/20"
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
                className="w-full bg-black text-white px-4 py-3 rounded-xl disabled:opacity-50 hover:opacity-90 transition shadow-sm"
                onClick={handleLogin}
                disabled={loading}
              >
                {loading ? "Ingresando..." : "Ingresar"}
              </button>

              <button
                className="w-full border px-4 py-3 rounded-xl bg-white disabled:opacity-50 hover:bg-gray-50 transition"
                onClick={handleResetPassword}
                disabled={loading}
              >
                {loading ? "Enviando..." : "Olvidé mi contraseña"}
              </button>
            </>
          ) : (
            <button
              className="w-full bg-black text-white px-4 py-3 rounded-xl disabled:opacity-50 hover:opacity-90 transition shadow-sm"
              onClick={handleRegister}
              disabled={loading}
            >
              {loading ? "Creando..." : "Crear cuenta"}
            </button>
          )}

          {msg && (
            <div className="text-sm border border-gray-200 rounded-xl p-3 bg-gray-50">
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
