import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import AuthPage from "./components/AuthPage.jsx";
import Archive from "./components/Archive.jsx";
import Dashboard from "./components/Dashboard.jsx";
import Landing from "./components/Landing.jsx";
import Layout from "./components/Layout.jsx";
import Profile from "./components/Profile.jsx";
import TimeControls from "./components/TimeControls.jsx";
import WeeklyReport from "./components/WeeklyReport.jsx";

export default function App() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        Loading...
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <div key={location.pathname} className="page-fade">
          <Routes location={location}>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
        <style>{`
          @keyframes pageFade {
            0% {
              opacity: 0;
              transform: translateY(10px);
            }
            100% {
              opacity: 1;
              transform: translateY(0);
            }
          }
          .page-fade {
            animation: pageFade 360ms ease-out;
          }
        `}</style>
      </>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/time-controls" element={<TimeControls />} />
        <Route path="/archive" element={<Archive />} />
        <Route path="/weekly-report" element={<WeeklyReport />} />
        <Route path="/profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

