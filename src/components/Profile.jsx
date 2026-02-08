import { useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useSessions } from "../hooks/useSessions.js";
import {
  TARGET_HOURS,
  BASELINE_COMPLETED_MINUTES,
  diffMinutes,
  formatDate,
  formatHours,
  minutesToHours,
} from "../utils/time.js";

export default function Profile() {
  const { user } = useAuth();
  const { sessions, loading } = useSessions(user?.uid);
  const [hoveredCard, setHoveredCard] = useState(null);

  const summary = useMemo(() => {
    const completed = sessions.filter((session) => session.timeOut);
    const totalMinutes = completed.reduce(
      (sum, session) =>
        sum + diffMinutes(new Date(session.timeInRounded), new Date(session.timeOutRounded)),
      0
    );
    const totalHours = minutesToHours(
      totalMinutes + BASELINE_COMPLETED_MINUTES
    );
    const remainingHours = Math.max(TARGET_HOURS - totalHours, 0);
    const progressPercentage = Math.min((totalHours / TARGET_HOURS) * 100, 100);

    const earliest = sessions.reduce((min, session) => {
      if (!session.timeIn) return min;
      return min === null || session.timeIn < min ? session.timeIn : min;
    }, null);

    return { totalHours, remainingHours, earliest, progressPercentage };
  }, [sessions]);

  const CardHoverEffect = ({ children, id, className = "" }) => (
    <div
      className={`relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${className}`}
      onMouseEnter={() => setHoveredCard(id)}
      onMouseLeave={() => setHoveredCard(null)}
      style={{
        transform: hoveredCard === id ? "translateY(-4px)" : "translateY(0)",
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-transparent opacity-0 transition-opacity duration-300 hover:opacity-100" />
      <div className="relative z-10">{children}</div>
    </div>
  );

  const StatBadge = ({ label, value, unit, color = "orange" }) => {
    const colorMap = {
      orange: "from-indigo-500 to-sky-400",
      green: "from-indigo-500 to-sky-400",
      emerald: "from-indigo-500 to-sky-400",
      amber: "from-indigo-500 to-sky-400",
    };

    return (
      <div className="group relative">
        <div className="absolute -inset-0.5 rounded-2xl bg-indigo-200/40 opacity-0 blur transition duration-300 group-hover:opacity-30" />
        <div className="relative rounded-2xl border border-slate-200 bg-white p-5">
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.3em] text-slate-400">
            {label}
          </p>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-bold bg-gradient-to-r ${colorMap[color]} bg-clip-text text-transparent`}>
              {value}
            </span>
            {unit && <span className="text-sm font-medium text-slate-500">{unit}</span>}
          </div>
        </div>
      </div>
    );
  };

  const ProgressRing = ({ percentage, size = 120 }) => {
    const strokeWidth = 8;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;

    return (
      <div className="relative inline-flex items-center justify-center">
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="url(#gradient)"
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F97316" />
              <stop offset="100%" stopColor="#22C55E" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute text-center">
          <span className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-sky-500 bg-clip-text text-transparent">
            {Math.round(percentage)}%
          </span>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900">
            Dashboard Overview
          </h1>
          <p className="mt-2 text-slate-500">Welcome back, {user?.email?.split("@")[0] || "User"}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <CardHoverEffect id="profile">
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">
                    Profile Details
                  </h2>
                  <p className="mt-1 text-slate-500">Your account information</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-lg font-bold text-white">
                  {user?.email?.[0]?.toUpperCase() || "U"}
                </div>
              </div>

              <div className="space-y-4">
                <div className="group relative rounded-xl border border-slate-200 bg-slate-50 p-4 transition-all duration-300 hover:border-indigo-300">
                  <div className="flex items-center">
                    <div className="mr-3 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 transition-transform group-hover:scale-105">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Account UID</p>
                      <p className="max-w-[200px] truncate font-mono text-sm text-slate-900">{user?.uid}</p>
                    </div>
                  </div>
                </div>

                <div className="group relative rounded-xl border border-slate-200 bg-slate-50 p-4 transition-all duration-300 hover:border-indigo-300">
                  <div className="flex items-center">
                    <div className="mr-3 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 transition-transform group-hover:scale-105">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89-4.26a2 2 0 011.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Email Address</p>
                      <p className="max-w-[200px] truncate font-medium text-slate-900">{user?.email}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardHoverEffect>

          <CardHoverEffect id="progress">
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">
                    Progress Tracking
                  </h2>
                  <p className="mt-1 text-slate-500">Your learning journey</p>
                </div>
                <ProgressRing percentage={summary.progressPercentage} />
              </div>

              <div className="space-y-4">
                <StatBadge
                  label="Total Hours Logged"
                  value={formatHours(summary.totalHours)}
                  unit="hours"
                  color="orange"
                />
                
                <StatBadge
                  label={`Remaining to ${TARGET_HOURS}h`}
                  value={formatHours(summary.remainingHours)}
                  unit="hours"
                  color={summary.remainingHours > 0 ? "amber" : "emerald"}
                />

                <div className="relative rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center">
                    <div className="mr-3 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">First Session</p>
                      <p className="font-medium text-slate-900">
                        {loading
                          ? <span className="animate-pulse text-slate-400">Loading...</span>
                          : summary.earliest
                          ? formatDate(new Date(summary.earliest))
                          : "No sessions yet"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 border-t border-slate-200 pt-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Progress to goal</span>
                  <span className="text-sm font-medium text-slate-700">
                    {Math.round(summary.progressPercentage)}%
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-sky-500 transition-all duration-1000 ease-out"
                    style={{ width: `${summary.progressPercentage}%` }}
                  />
                </div>
              </div>
            </div>
          </CardHoverEffect>
        </div>

        <div className="mt-8">
          <CardHoverEffect id="insights">
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">
                    Session Insights
                  </h2>
                  <p className="mt-1 text-slate-500">Total sessions: {sessions.filter(s => s.timeOut).length}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
              </div>
              
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-2xl font-bold text-indigo-600">
                    {formatHours(minutesToHours(BASELINE_COMPLETED_MINUTES))}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">Baseline Hours</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-2xl font-bold text-slate-900">
                    {formatHours(summary.totalHours)}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">Current Total</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-2xl font-bold text-sky-600">
                    {TARGET_HOURS}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">Target Hours</div>
                </div>
              </div>
            </div>
          </CardHoverEffect>
        </div>
      </div>
    </div>
  );
}