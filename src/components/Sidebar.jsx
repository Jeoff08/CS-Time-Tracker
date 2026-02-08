import { NavLink } from "react-router-dom";
import { motion } from "framer-motion"; 

const getNavClass = ({ isActive }) =>
  `group relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ease-out ${
    isActive
      ? "bg-white/10 text-white shadow-[0_4px_12px_rgba(99,102,241,0.2)]"
      : "text-slate-400 hover:text-white hover:bg-white/5"
  }`;

export default function Sidebar({ onSignOut }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-72 flex-col border-r border-white/5 bg-[#0f172a] lg:flex">
      {/* Subtle Background Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-24 h-48 w-48 rounded-full bg-indigo-500/10 blur-[80px]" />
      </div>

      <div className="relative flex h-full flex-col p-6">
        {/* Logo Section */}
        <div className="mb-10 px-2">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20">
              <div className="h-3 w-3 rounded-full bg-white animate-pulse" />
            </div>
            <div>
              <div className="text-xl font-bold tracking-tight text-white">
                Focus<span className="text-indigo-400">.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-2">
          <SidebarLink to="/dashboard" label="Dashboard" icon={<DashIcon />} />
          <SidebarLink to="/time-controls" label="Time Tracker" icon={<TimeIcon />} />
          <SidebarLink to="/weekly-report" label="Reports" icon={<ReportIcon />} />
          <SidebarLink to="/archive" label="History" icon={<ArchiveIcon />} />
          
          <div className="my-6 border-t border-white/5 pt-6">
             <p className="px-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Account</p>
          </div>
          
          <SidebarLink to="/profile" label="Profile" icon={<ProfileIcon />} />
        </nav>

        {/* Sign Out Button */}
        <div className="mt-auto pt-6">
          <button
            type="button"
            onClick={onSignOut}
            className="group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-400 transition-all duration-300 hover:bg-red-500/10 hover:text-red-400"
          >
            <div className="transition-transform duration-300 group-hover:-translate-x-1">
              <LogoutIcon />
            </div>
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

function SidebarLink({ to, label, icon }) {
  return (
    <NavLink to={to} className={getNavClass}>
      {({ isActive }) => (
        <>
          {/* Active Indicator Bar */}
          {isActive && (
            <div className="absolute left-0 h-6 w-1 rounded-r-full bg-indigo-500" />
          )}
          
          <div className={`transition-transform duration-300 ${isActive ? 'scale-110 text-indigo-400' : 'group-hover:scale-110 group-hover:text-indigo-300'}`}>
            {icon}
          </div>
          
          <span className={`flex-1 transition-transform duration-300 ${!isActive && 'group-hover:translate-x-1'}`}>
            {label}
          </span>
          
          {isActive && (
            <div className="h-1.5 w-1.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]" />
          )}
        </>
      )}
    </NavLink>
  );
}

/* --- Refined Icons --- */
const buildIconClass = (size, className) => {
  const base = size || "h-5 w-5";
  return className ? `${base} ${className}` : base;
};

const DashIcon = ({ size, className }) => (
  <svg
    className={buildIconClass(size, className)}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const ReportIcon = ({ size, className }) => (
  <svg
    className={buildIconClass(size, className)}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
  </svg>
);

const ArchiveIcon = ({ size, className }) => (
  <svg
    className={buildIconClass(size, className)}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-7 4h4" />
  </svg>
);

const ProfileIcon = ({ size, className }) => (
  <svg
    className={buildIconClass(size, className)}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const TimeIcon = ({ size, className }) => (
  <svg
    className={buildIconClass(size, className)}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const LogoutIcon = ({ size, className }) => (
  <svg
    className={buildIconClass(size, className)}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7" />
  </svg>
);

export { ArchiveIcon, DashIcon, LogoutIcon, ProfileIcon, ReportIcon, TimeIcon };