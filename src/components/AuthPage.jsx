import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const initialState = {
  email: "",
  password: "",
};

export default function AuthPage() {
  const { signIn, signUp, firebaseConfigured } = useAuth();
  const [form, setForm] = useState(initialState);
  const [mode, setMode] = useState("signin");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus("");
    setLoading(true);
    try {
      if (mode === "signup") {
        await signUp(form.email, form.password);
        setStatus("Account created. You are now signed in.");
      } else {
        await signIn(form.email, form.password);
        setStatus("Signed in successfully.");
      }
    } catch (error) {
      setStatus(error.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#06070b] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-24 h-72 w-72 rounded-full border border-violet-400/30 blur-[0.5px]" />
        <div className="absolute left-12 top-40 h-56 w-56 rounded-full border border-violet-400/20" />
        <div className="absolute left-28 top-52 h-40 w-40 rounded-full border border-violet-400/20" />
        <div className="absolute right-8 top-24 h-[360px] w-[360px] rounded-full border border-violet-400/30 blur-[0.5px]" />
        <div className="absolute right-24 top-52 h-44 w-44 rounded-full border border-violet-400/20" />
        <div className="absolute right-40 top-64 h-32 w-32 rounded-full border border-violet-400/20" />
      </div>

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 sm:px-6 sm:py-6">
        <div className="flex items-center gap-6">
        </div>
      </header>

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 pb-16 sm:pb-20">
        <div className="w-full max-w-md rounded-[24px] border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl transition-transform duration-300 ease-out sm:rounded-[28px] sm:p-8">
          <div
            key={mode}
            className="animate-auth-swap"
          >
            <div className="flex items-center justify-between">
              <Link
                to="/"
                className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white transition-all duration-300 hover:border-white/40 hover:bg-white/10"
              >
                Back
              </Link>
              <div className="text-center text-base font-semibold tracking-[0.15em] text-white sm:text-lg">
                {mode === "signup" ? "REGISTER" : "LOGIN"}
              </div>
              <div className="w-[60px]" />
            </div>

            {!firebaseConfigured && (
              <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                Firebase is not configured. Add your `VITE_FIREBASE_*` values to a
                `.env` file, restart the dev server, then reload this page.
              </div>
            )}

            <form className="mt-6 space-y-5 sm:mt-8" onSubmit={handleSubmit}>
              <div className="border-b border-white/20 pb-2">
                <label className="text-xs uppercase tracking-[0.2em] text-slate-200">
                  Email
                </label>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    required
                    className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
                    placeholder="you@example.com"
                  />
                  <span className="text-indigo-300">@</span>
                </div>
              </div>

              <div className="border-b border-white/20 pb-2">
                <label className="text-xs uppercase tracking-[0.2em] text-slate-200">
                  Password
                </label>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    name="password"
                    type="password"
                    value={form.password}
                    onChange={handleChange}
                    required
                    minLength={6}
                    className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
                    placeholder="••••••••"
                  />
                  <span className="text-indigo-300">✶</span>
                </div>
                <div className="mt-2 text-right text-xs text-slate-200/70">
                  Forgot Password?
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-200">
                <input
                  id="remember"
                  type="checkbox"
                  className="h-4 w-4 rounded border border-white/30 bg-transparent"
                />
                <label htmlFor="remember">Remember Me</label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-500 py-3 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Processing..." : mode === "signup" ? "Register" : "Login"}
              </button>
            </form>

            {status && (
              <div className={`mt-4 rounded-xl border ${status.includes("success") || status.includes("created") ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200" : "border-red-400/30 bg-red-500/10 text-red-200"} p-3 text-xs`}>
                {status}
              </div>
            )}

            <button
              type="button"
              onClick={() => setMode((prev) => (prev === "signin" ? "signup" : "signin"))}
              className="mt-5 flex w-full items-center justify-between text-xs text-slate-200 transition-all duration-300 hover:text-white active:scale-[0.98] sm:mt-6"
            >
              <span>
                {mode === "signin"
                  ? "Don't have an Account?"
                  : "Already have an Account?"}
              </span>
              <span className="font-semibold">
                {mode === "signin" ? "Register" : "Login"}
              </span>
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes authSwap {
          0% {
            opacity: 0;
            transform: translateY(8px) scale(0.98);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .animate-auth-swap {
          animation: authSwap 320ms ease-out;
        }
      `}</style>
    </div>
  );
}