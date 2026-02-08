import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useSessions } from "../hooks/useSessions.js";
import {
  BASELINE_COMPLETED_MINUTES,
  TARGET_HOURS,
  diffMinutes,
  formatDate,
  formatTime,
  minutesToHours,
  roundDownToHour,
  roundUpToHour,
  formatHours,
} from "../utils/time.js";

const toDate = (ms) => (ms ? new Date(ms) : null);

export default function TimeControls() {
  const { user } = useAuth();
  const { sessions } = useSessions(user?.uid);
  const [now, setNow] = useState(() => new Date());
  const [statusMessage, setStatusMessage] = useState("");
  const [isTimeInProcessing, setIsTimeInProcessing] = useState(false);
  const [isTimeOutProcessing, setIsTimeOutProcessing] = useState(false);
  const [isClockHovered, setIsClockHovered] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const normalizedSessions = useMemo(
    () =>
      sessions.map((session) => ({
        ...session,
        timeInDate: toDate(session.timeIn),
        timeOutDate: toDate(session.timeOut),
        timeInRoundedDate: toDate(session.timeInRounded),
        timeOutRoundedDate: toDate(session.timeOutRounded),
      })),
    [sessions]
  );

  const activeSession = useMemo(
    () => normalizedSessions.find((session) => !session.timeOut),
    [normalizedSessions]
  );

  const activeMinutes = activeSession
    ? diffMinutes(
        activeSession.timeInRoundedDate,
        roundDownToHour(now)
      )
    : 0;

  const completedMinutes = normalizedSessions.reduce((sum, session) => {
    if (!session.timeOutRoundedDate || !session.timeInRoundedDate) {
      return sum;
    }
    return (
      sum + diffMinutes(session.timeInRoundedDate, session.timeOutRoundedDate)
    );
  }, 0);
  const totalMinutes =
    completedMinutes + activeMinutes + BASELINE_COMPLETED_MINUTES;
  const totalHours = minutesToHours(totalMinutes);
  const goalCompleted = totalHours >= TARGET_HOURS;
  const progressPercentage = Math.min((totalHours / TARGET_HOURS) * 100, 100);

  const effectiveStatusMessage = goalCompleted
    ? statusMessage
      ? `${statusMessage} Goal completed! Target of ${TARGET_HOURS} hrs reached.`
      : `Goal completed! Target of ${TARGET_HOURS} hrs reached.`
    : statusMessage || "Ready to track your time in real time.";

  const handleTimeIn = async () => {
    if (!user) return;
    if (activeSession) {
      setStatusMessage("You already have an active time-in.");
      return;
    }
    
    setIsTimeInProcessing(true);
    const timeIn = new Date();
    const timeInRounded = roundUpToHour(timeIn);
    const sessionsRef = collection(db, "users", user.uid, "sessions");
    
    try {
      await addDoc(sessionsRef, {
        timeIn: timeIn.getTime(),
        timeInRounded: timeInRounded.getTime(),
        timeOut: null,
        timeOutRounded: null,
        isCompleted: false,
        createdAt: Date.now(),
        archivedAt: null,
      });
      setStatusMessage(`Time in recorded at ${formatTime(timeInRounded)}`);
    } catch (error) {
      setStatusMessage("Error recording time in. Please try again.");
    } finally {
      setTimeout(() => setIsTimeInProcessing(false), 500);
    }
  };

  const handleTimeOut = async () => {
    if (!user) return;
    if (!activeSession) {
      setStatusMessage("No active time-in found.");
      return;
    }
    
    setIsTimeOutProcessing(true);
    const timeOut = new Date();
    const timeOutRounded = roundDownToHour(timeOut);
    const sessionRef = doc(db, "users", user.uid, "sessions", activeSession.id);
    
    try {
      await updateDoc(sessionRef, {
        timeOut: timeOut.getTime(),
        timeOutRounded: timeOutRounded.getTime(),
        isCompleted: true,
      });
      setStatusMessage(`Time out recorded at ${formatTime(timeOutRounded)}`);
    } catch (error) {
      setStatusMessage("Error recording time out. Please try again.");
    } finally {
      setTimeout(() => setIsTimeOutProcessing(false), 500);
    }
  };

  const ClockWithParticles = () => {
    const [particles, setParticles] = useState([]);

    useEffect(() => {
      if (isClockHovered) {
        const newParticles = Array.from({ length: 8 }, (_, i) => ({
          id: i,
          x: Math.random() * 100,
          y: Math.random() * 100,
          delay: i * 0.1,
        }));
        setParticles(newParticles);
      } else {
        setParticles([]);
      }
    }, [isClockHovered]);

    return (
      <div
        className="relative"
        onMouseEnter={() => setIsClockHovered(true)}
        onMouseLeave={() => setIsClockHovered(false)}
      >
        {particles.map((particle) => (
          <div
            key={particle.id}
            className="absolute w-1 h-1 bg-gradient-to-r from-indigo-400 to-sky-400 rounded-full"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              animation: `float 2s ease-in-out ${particle.delay}s infinite`,
            }}
          />
        ))}
        <div className="relative z-10">
          <p className="text-4xl font-bold text-slate-900">
            {formatTime(now)}
          </p>
        </div>
      </div>
    );
  };

  const ActionButton = ({ 
    children, 
    onClick, 
    icon, 
    variant = "primary", 
    loading = false,
    disabled = false 
  }) => {
    const variants = {
      primary: "bg-slate-900 text-white hover:bg-slate-800",
      secondary: "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50",
      outline: "bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100",
    };

    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || loading}
        className={`relative overflow-hidden rounded-2xl px-6 py-4 font-semibold uppercase tracking-[0.15em] transition-all duration-300 hover:-translate-y-0.5 ${variants[variant]} ${
          disabled ? "opacity-50 cursor-not-allowed" : ""
        } ${loading ? "cursor-wait" : ""}`}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-inherit">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        <div className={`flex items-center justify-center gap-3 ${loading ? "opacity-0" : ""}`}>
          {icon}
          <span>{children}</span>
        </div>
      </button>
    );
  };

  const ProgressBar = () => (
    <div className="relative">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-600">Goal Progress</span>
        <span className="text-sm font-bold bg-gradient-to-r from-indigo-500 to-sky-500 bg-clip-text text-transparent">
          {formatHours(totalHours)} / {TARGET_HOURS}h
        </span>
      </div>
      <div className="h-3 rounded-full bg-slate-200 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-sky-500 to-sky-400 transition-all duration-1000 ease-out"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>
      {goalCompleted && (
        <div className="absolute -top-8 right-0">
          <div className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-indigo-500 to-sky-400 rounded-full text-xs font-semibold text-white animate-pulse">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            GOAL ACHIEVED!
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Time Tracker</h1>
          <p className="text-sm text-slate-500">Track your productive hours</p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Clock Card */}
          <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="absolute right-0 top-0 h-32 w-32 -translate-y-16 translate-x-16 rounded-full bg-indigo-100/80" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">
                    Current Time
                  </p>
                  <ClockWithParticles />
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-sm font-medium text-slate-500">{formatDate(now)}</p>
            </div>
          </div>

          {/* Control Card */}
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm lg:col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Session Control</h2>
                <p className="text-sm text-slate-500">Start and stop tracking your work sessions</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6">
              <ActionButton
                onClick={handleTimeIn}
                loading={isTimeInProcessing}
                disabled={!!activeSession}
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                }
              >
                Time In
              </ActionButton>
              
              <ActionButton
                onClick={handleTimeOut}
                loading={isTimeOutProcessing}
                disabled={!activeSession}
                variant="secondary"
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M15 12H9" />
                  </svg>
                }
              >
                Time Out
              </ActionButton>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm text-slate-600">
                  {effectiveStatusMessage}
                </p>
              </div>
            </div>
          </div>

          {/* Active Session & Progress */}
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm lg:col-span-3">
            <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-green-600">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">Active Session</h3>
                    <p className="text-sm text-slate-500">Current tracking status</p>
                  </div>
                </div>
                
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
                  {activeSession ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-slate-500">Started at</p>
                          <p className="text-lg font-bold text-slate-900">
                            {formatTime(activeSession.timeInRoundedDate)}
                          </p>
                        </div>
                        <div className="rounded-full bg-indigo-50 px-3 py-1">
                          <span className="text-sm font-semibold text-indigo-600">
                            {formatHours(minutesToHours(activeMinutes))}
                          </span>
                        </div>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                        <div 
                          className="h-full rounded-full bg-sky-400"
                          style={{ width: `${Math.min((activeMinutes % 60) / 60 * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="text-slate-500">No active session</p>
                      <p className="mt-1 text-sm text-slate-400">Click "Time In" to start tracking</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <ProgressBar />
              </div>
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500">
            Time in rounds up to the next hour, time out rounds down to the previous hour
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); opacity: 1; }
          50% { transform: translateY(-20px) rotate(180deg); opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}