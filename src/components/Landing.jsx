import { Link } from "react-router-dom";
import { useState } from "react";

export default function Landing() {
  const [mode, setMode] = useState("dark");
  const [showInfo, setShowInfo] = useState(false);
  const isDark = mode === "dark";

  const pageBg = isDark
    ? "bg-[#06070b] text-white"
    : "bg-slate-50 text-slate-900";
  const navText = isDark ? "text-slate-300" : "text-slate-600";
  const subtleText = isDark ? "text-slate-400" : "text-slate-500";
  const borderSoft = isDark ? "border-white/15 bg-white/5" : "border-slate-200 bg-white";
  const chipBorder = isDark ? "border-white/20" : "border-slate-300";
  const ringBorder = isDark ? "border-violet-400/30" : "border-indigo-300/40";
  const ringBorderLight = isDark ? "border-violet-400/20" : "border-indigo-200/50";
  const panelBg = isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white";
  const panelMuted = isDark ? "text-slate-300" : "text-slate-600";

  return (
    <div className={`min-h-screen transition-colors duration-500 ease-in-out ${pageBg}`}>
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 transition-colors duration-500 ease-in-out">
          <div className={`absolute -left-20 top-24 h-72 w-72 rounded-full border blur-[0.5px] transition-colors duration-500 ease-in-out ${ringBorder}`} />
          <div className={`absolute left-12 top-40 h-56 w-56 rounded-full border transition-colors duration-500 ease-in-out ${ringBorderLight}`} />
          <div className={`absolute left-28 top-52 h-40 w-40 rounded-full border transition-colors duration-500 ease-in-out ${ringBorderLight}`} />
          <div className={`absolute right-8 top-24 h-[360px] w-[360px] rounded-full border blur-[0.5px] transition-colors duration-500 ease-in-out ${ringBorder}`} />
          <div className={`absolute right-24 top-52 h-44 w-44 rounded-full border transition-colors duration-500 ease-in-out ${ringBorderLight}`} />
          <div className={`absolute right-40 top-64 h-32 w-32 rounded-full border transition-colors duration-500 ease-in-out ${ringBorderLight}`} />
        </div>

        <div className="mx-auto flex w-full max-w-6xl flex-col px-4 pb-14 pt-6 sm:px-6 sm:pb-16 md:px-8">
          <header className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-7 w-7 rounded-full transition-colors duration-500 ease-in-out ${isDark ? "bg-white" : "bg-slate-900"}`} />
              <span className={`text-xs font-semibold tracking-[0.2em] transition-colors duration-500 ease-in-out ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                TIME TRACKER
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMode(isDark ? "light" : "dark")}
                className={`rounded-full border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] transition-all duration-500 ease-in-out ${chipBorder} ${isDark ? "text-slate-200" : "text-slate-700"}`}
                type="button"
              >
                {isDark ? "Light" : "Dark"}
              </button>
              <Link
                to="/auth"
                className="rounded-full bg-indigo-500 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white"
              >
                Sign In
              </Link>
            </div>
          </header>

          <div className="mt-10 flex flex-col gap-10 sm:mt-12 lg:mt-16 lg:grid lg:grid-cols-[1.1fr_0.9fr]">
            <div className="order-1 flex min-h-[60vh] flex-col text-center sm:min-h-0 sm:space-y-6 sm:text-left lg:order-none">
              <div className="mt-6 sm:mt-0">
                <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
                  Welcome.
                </h1>
              </div>

              

              <div className="mt-auto flex flex-col items-center gap-3 sm:mt-0 sm:items-start sm:gap-4">
                <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start sm:gap-4">
                  <button
                    type="button"
                    onClick={() => setShowInfo((prev) => !prev)}
                    className={`rounded-full border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] transition-all duration-500 ease-in-out sm:px-5 sm:text-xs ${chipBorder} ${isDark ? "text-slate-200 hover:bg-white/5" : "text-slate-700 hover:bg-slate-100"}`}
                  >
                    {showInfo ? "Hide Details" : "About The System"}
                  </button>
                  <Link
                    to="/auth"
                    className="rounded-full bg-indigo-500 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white transition-all duration-500 ease-in-out hover:bg-indigo-400 sm:px-5 sm:text-xs"
                  >
                    Get Started
                  </Link>
                </div>

                {showInfo && (
                  <div className={`mt-3 rounded-2xl border p-4 text-left transition-colors duration-500 ease-in-out sm:mt-6 sm:p-5 ${panelBg}`}>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-300">
                          What It Does
                        </h3>
                        <p className={`mt-2 text-xs leading-relaxed ${panelMuted}`}>
                          Time-Tracker logs your work sessions in real time, keeps
                          weekly totals, and helps you stay on target with clear
                          progress insights.
                        </p>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-300">
                          How It Works
                        </h3>
                        <p className={`mt-2 text-xs leading-relaxed ${panelMuted}`}>
                          Start a session, pause when needed, and export your
                          weekly report. Everything is stored in your dashboard
                          for quick review.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="order-3 relative space-y-4 text-center sm:text-left lg:order-none">
              <div className={`flex items-center justify-center gap-4 transition-colors duration-500 ease-in-out sm:justify-start ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                <div className={`h-10 w-10 rounded-full border transition-colors duration-500 ease-in-out ${isDark ? "border-indigo-400/60" : "border-indigo-400/40"}`} />
                <span className="text-lg font-medium">Landing page.</span>
              </div>
              <p className={`mx-auto max-w-md text-xs leading-relaxed transition-colors duration-500 ease-in-out sm:mx-0 ${subtleText}`}>
                Time-Tracker is a tool that helps you track your time and productivity.
              </p>
            </div>
          </div>

          <div className="mt-14 flex items-center justify-center">
            <div className={`h-7 w-4 rounded-full border transition-colors duration-500 ease-in-out ${chipBorder}`}>
              <div className={`mx-auto mt-1 h-2 w-1 rounded-full transition-colors duration-500 ease-in-out ${isDark ? "bg-indigo-400" : "bg-indigo-500"}`} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}