import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { motion } from "framer-motion";
import Sidebar, {
  ArchiveIcon,
  DashIcon,
  LogoutIcon,
  ProfileIcon,
  ReportIcon,
  TimeIcon,
} from "./Sidebar.jsx";

export default function Layout() {
  const { signOutUser, user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="relative flex min-h-screen flex-col lg:flex-row">
        {/* DESKTOP SIDEBAR */}
        <Sidebar onSignOut={signOutUser} />

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 overflow-y-auto px-4 pt-6 pb-28 lg:px-8 lg:py-6">
          <div className="mx-auto max-w-6xl space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">
                  Welcome Back{user?.email ? `, ${user.email}` : ""} 👋
                </p>
                <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  
                </div>
                <div className="h-9 w-9 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-semibold">
                  {user?.email?.[0]?.toUpperCase() || "U"}
                </div>
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm lg:p-6"
            >
              <Outlet />
            </motion.div>
          </div>
        </main>

        {/* MODERN MOBILE NAV - Glass Morphism Design */}
        <nav className="fixed bottom-6 left-1/2 z-50 flex h-16 w-[90%] -translate-x-1/2 items-center justify-around rounded-2xl border border-slate-200 bg-white/90 shadow-sm lg:hidden">
          
          <MobileLink
            to="/dashboard"
            icon={<DashIcon />}
            label="Home"
            accentClass="text-gradient bg-gradient-to-r from-indigo-600 to-sky-500"
            activeBg="bg-gradient-to-r from-indigo-500/10 to-sky-500/10"
          />
          <MobileLink
            to="/weekly-report"
            icon={<ReportIcon />}
            label="Reports"
            accentClass="text-gradient bg-gradient-to-r from-indigo-600 to-sky-500"
            activeBg="bg-gradient-to-r from-indigo-500/10 to-sky-500/10"
          />
          <MobileLink
            to="/archive"
            icon={<ArchiveIcon />}
            label="Archive"
            accentClass="text-gradient bg-gradient-to-r from-indigo-600 to-sky-500"
            activeBg="bg-gradient-to-r from-indigo-500/10 to-sky-500/10"
          />
          <MobileLink
            to="/time-controls"
            icon={<TimeIcon />}
            label="Time"
            accentClass="text-gradient bg-gradient-to-r from-indigo-600 to-sky-500"
            activeBg="bg-gradient-to-r from-indigo-500/10 to-sky-500/10"
          />
          <MobileLink
            to="/profile"
            icon={<ProfileIcon />}
            label="Profile"
            accentClass="text-gradient bg-gradient-to-r from-indigo-600 to-sky-500"
            activeBg="bg-gradient-to-r from-indigo-500/10 to-sky-500/10"
          />
          
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={signOutUser}
            className="relative flex flex-col items-center justify-center gap-1 group"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-rose-500 rounded-full opacity-0 group-hover:opacity-20 blur transition-opacity duration-300" />
              <LogoutIcon size="w-5 h-5" className="text-red-500 group-hover:text-red-600 transition-colors" />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-tighter text-red-500 group-hover:text-red-600 transition-colors">
              Exit
            </span>
          </motion.button>
        </nav>
      </div>
    </div>
  );
}

function MobileLink({ to, icon, label, accentClass, activeBg }) {
  return (
    <NavLink to={to} className={({ isActive }) => 
      `relative flex flex-col items-center justify-center gap-1 px-3 py-2 transition-all duration-300 ${
        isActive ? accentClass : "text-slate-500 hover:text-slate-700"
      }`
    }>
      {({ isActive }) => (
        <>
          {/* Animated background */}
          {isActive && (
            <motion.span 
              layoutId="mobileNavActive"
              className={`absolute inset-0 rounded-xl ${activeBg}`}
              initial={false}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
          )}
          
          {/* Icon */}
          <motion.span 
            className="relative"
            whileTap={{ scale: 0.9 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            {icon}
          </motion.span>
          
          {/* Label */}
          <span className={`relative text-[10px] font-bold uppercase tracking-tighter transition-all duration-300 ${
            isActive ? "scale-110" : "scale-100"
          }`}>
            {label}
          </span>
          
          {/* Animated indicator dot */}
          {isActive && (
            <motion.div 
              layoutId="mobileNavDot"
              className={`absolute -bottom-1 h-1 w-1 rounded-full ${accentClass} bg-current`}
              initial={false}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          )}
          
          {/* Hover effect */}
          {!isActive && (
            <motion.div 
              className="absolute inset-0 rounded-xl bg-slate-100/0 hover:bg-slate-100/50"
              initial={false}
              whileHover={{ scale: 1.1 }}
              transition={{ duration: 0.2 }}
            />
          )}
        </>
      )}
    </NavLink>
  );
}

// Add this to your global CSS or Tailwind config for gradient text
// .text-gradient {
//   background-clip: text;
//   -webkit-background-clip: text;
//   -webkit-text-fill-color: transparent;
// }