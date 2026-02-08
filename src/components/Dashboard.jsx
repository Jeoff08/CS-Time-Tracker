import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useSessions } from "../hooks/useSessions.js";
import {
  TARGET_HOURS,
  BASELINE_COMPLETED_MINUTES,
  diffMinutes,
  formatDate,
  formatHours,
  formatTime,
  minutesToHours,
  roundDownToHour,
  roundUpToHour,
} from "../utils/time.js";

const toDate = (ms) => (ms ? new Date(ms) : null);

const startOfWeekMonday = (date) => {
  const start = new Date(date);
  const day = start.getDay();
  const diff = (day + 6) % 7;
  start.setDate(start.getDate() - diff);
  start.setHours(0, 0, 0, 0);
  return start;
};

const endOfWeekFriday = (weekStart) => {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 4);
  end.setHours(23, 59, 59, 999);
  return end;
};

export default function Dashboard() {
  const { user } = useAuth();
  const { sessions, loading, error } = useSessions(user?.uid);
  const [now, setNow] = useState(() => new Date());
  const [statusMessage, setStatusMessage] = useState("");
  const [deletingSessionId, setDeletingSessionId] = useState(null);
  const [deleteModalSession, setDeleteModalSession] = useState(null);
  const [selectedSessionIds, setSelectedSessionIds] = useState([]);
  const [archivingSessionIds, setArchivingSessionIds] = useState([]);
  const [isBulkArchiving, setIsBulkArchiving] = useState(false);
  const [archiveModalSession, setArchiveModalSession] = useState(null);
  const [archiveSelectedModalOpen, setArchiveSelectedModalOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [hoveredCard, setHoveredCard] = useState(null);
  const [pulseAnimation, setPulseAnimation] = useState(false);
  const [analyticsModalOpen, setAnalyticsModalOpen] = useState(false);
  const [selectedWeekStart, setSelectedWeekStart] = useState(null);
  const [recentModalOpen, setRecentModalOpen] = useState(false);
  const [detailSession, setDetailSession] = useState(null);

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

  const currentWeekStart = useMemo(() => startOfWeekMonday(now), [now]);
  const currentWeekEnd = useMemo(
    () => endOfWeekFriday(currentWeekStart),
    [currentWeekStart]
  );

  const weeklyBuckets = useMemo(() => {
    const buckets = new Map();
    normalizedSessions.forEach((session) => {
      if (!session.timeInDate) return;
      const weekStart = startOfWeekMonday(session.timeInDate);
      const weekEnd = endOfWeekFriday(weekStart);
      const key = weekStart.toISOString().slice(0, 10);
      if (!buckets.has(key)) {
        buckets.set(key, {
          key,
          start: weekStart,
          end: weekEnd,
          sessions: [],
        });
      }
      buckets.get(key).sessions.push(session);
    });
    if (!buckets.has(currentWeekStart.toISOString().slice(0, 10))) {
      buckets.set(currentWeekStart.toISOString().slice(0, 10), {
        key: currentWeekStart.toISOString().slice(0, 10),
        start: currentWeekStart,
        end: currentWeekEnd,
        sessions: [],
      });
    }
    return Array.from(buckets.values()).sort((a, b) => b.start - a.start);
  }, [normalizedSessions, currentWeekStart, currentWeekEnd]);

  useEffect(() => {
    if (!selectedWeekStart) {
      setSelectedWeekStart(currentWeekStart.toISOString().slice(0, 10));
      return;
    }
    const currentKey = currentWeekStart.toISOString().slice(0, 10);
    if (selectedWeekStart !== currentKey) {
      setSelectedWeekStart(currentKey);
    }
  }, [currentWeekStart, selectedWeekStart]);

  const selectedWeek = useMemo(() => {
    if (!selectedWeekStart) return null;
    return weeklyBuckets.find((week) => week.key === selectedWeekStart) || null;
  }, [weeklyBuckets, selectedWeekStart]);

  const weekSessions = useMemo(() => {
    if (!selectedWeek) return [];
    return selectedWeek.sessions;
  }, [selectedWeek]);

  const unarchivedSessions = useMemo(
    () => normalizedSessions.filter((session) => !session.archivedAt),
    [normalizedSessions]
  );
  const recentSessions = useMemo(
    () => unarchivedSessions.slice(0, 6),
    [unarchivedSessions]
  );

  const activeSession = useMemo(
    () => normalizedSessions.find((session) => !session.timeOut),
    [normalizedSessions]
  );

  const totals = useMemo(() => {
    const completed = normalizedSessions.filter((session) => session.timeOut);
    const completedMinutes = completed.reduce(
      (sum, session) =>
        sum +
        diffMinutes(session.timeInRoundedDate, session.timeOutRoundedDate),
      0
    );

    const activeMinutes = activeSession
      ? diffMinutes(
          activeSession.timeInRoundedDate,
          roundDownToHour(now)
        )
      : 0;

    const totalMinutes =
      completedMinutes + activeMinutes + BASELINE_COMPLETED_MINUTES;
    const totalHours = minutesToHours(totalMinutes);
    const remainingHours = Math.max(TARGET_HOURS - totalHours, 0);
    const progressPercentage = Math.min((totalHours / TARGET_HOURS) * 100, 100);
    
    return { totalMinutes, totalHours, remainingHours, progressPercentage };
  }, [activeSession, normalizedSessions, now]);

  const dayTotals = useMemo(() => {
    const totalsByDay = Array.from({ length: 7 }, () => 0);
    const from = currentWeekStart;
    const to = currentWeekEnd;
    normalizedSessions.forEach((session) => {
      if (!session.timeInRoundedDate || !session.timeOutRoundedDate) return;
      if (!session.timeInDate) return;
      if (session.timeInDate < from || session.timeInDate > to) return;
      const dayIndex = session.timeInRoundedDate.getDay();
      totalsByDay[dayIndex] += diffMinutes(
        session.timeInRoundedDate,
        session.timeOutRoundedDate
      );
    });
    return totalsByDay;
  }, [normalizedSessions, currentWeekStart, currentWeekEnd]);

  const selectedWeekDayTotals = useMemo(() => {
    const totalsByDay = Array.from({ length: 7 }, () => 0);
    weekSessions.forEach((session) => {
      if (!session.timeInRoundedDate || !session.timeOutRoundedDate) return;
      const dayIndex = session.timeInRoundedDate.getDay();
      totalsByDay[dayIndex] += diffMinutes(
        session.timeInRoundedDate,
        session.timeOutRoundedDate
      );
    });
    return totalsByDay;
  }, [weekSessions]);

  const goalCompleted = totals.totalHours >= TARGET_HOURS;
  const effectiveStatusMessage = goalCompleted
    ? statusMessage
      ? `${statusMessage} Goal completed! Target of ${TARGET_HOURS} hrs reached.`
      : `Goal completed! Target of ${TARGET_HOURS} hrs reached.`
    : statusMessage || "Ready to track your time in real time.";

  const handleTimeIn = async () => {
    if (!user) return;
    if (activeSession) {
      setStatusMessage("You already have an active time-in.");
      setPulseAnimation(true);
      setTimeout(() => setPulseAnimation(false), 1000);
      return;
    }
    const timeIn = new Date();
    const timeInRounded = roundUpToHour(timeIn);
    const sessionsRef = collection(db, "users", user.uid, "sessions");
    await addDoc(sessionsRef, {
      timeIn: timeIn.getTime(),
      timeInRounded: timeInRounded.getTime(),
      timeOut: null,
      timeOutRounded: null,
      isCompleted: false,
      createdAt: Date.now(),
      archivedAt: null,
    });
    setStatusMessage("Time in recorded.");
    setPulseAnimation(true);
    setTimeout(() => setPulseAnimation(false), 800);
  };

  const handleTimeOut = async () => {
    if (!user) return;
    if (!activeSession) {
      setStatusMessage("No active time-in found.");
      setPulseAnimation(true);
      setTimeout(() => setPulseAnimation(false), 1000);
      return;
    }
    const timeOut = new Date();
    const timeOutRounded = roundDownToHour(timeOut);
    const sessionRef = doc(db, "users", user.uid, "sessions", activeSession.id);
    await updateDoc(sessionRef, {
      timeOut: timeOut.getTime(),
      timeOutRounded: timeOutRounded.getTime(),
      isCompleted: true,
    });
    setStatusMessage("Time out recorded.");
    setPulseAnimation(true);
    setTimeout(() => setPulseAnimation(false), 800);
  };

  const showToast = (message, variant = "success") => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3000);
  };

  useEffect(() => {
    setSelectedSessionIds((prev) =>
      prev.filter((id) => unarchivedSessions.some((session) => session.id === id))
    );
  }, [unarchivedSessions]);

  const isSessionSelected = (sessionId) =>
    selectedSessionIds.includes(sessionId);

  const toggleSelectSession = (sessionId) => {
    setSelectedSessionIds((prev) =>
      prev.includes(sessionId)
        ? prev.filter((id) => id !== sessionId)
        : [...prev, sessionId]
    );
  };

  const toggleSelectAll = () => {
    if (unarchivedSessions.length === 0) {
      setSelectedSessionIds([]);
      return;
    }
    if (selectedSessionIds.length === unarchivedSessions.length) {
      setSelectedSessionIds([]);
      return;
    }
    setSelectedSessionIds(unarchivedSessions.map((session) => session.id));
  };

  const toggleSelectRecentAll = () => {
    if (recentSessions.length === 0) {
      return;
    }
    const recentIds = recentSessions.map((session) => session.id);
    const allSelected = recentIds.every((id) => selectedSessionIds.includes(id));
    setSelectedSessionIds((prev) => {
      if (allSelected) {
        return prev.filter((id) => !recentIds.includes(id));
      }
      const merged = new Set(prev);
      recentIds.forEach((id) => merged.add(id));
      return Array.from(merged);
    });
  };

  const handleRequestDelete = (session) => {
    if (!session) return;
    setDeleteModalSession(session);
  };

  const handleConfirmDelete = async () => {
    if (!user || !deleteModalSession?.id) return;
    const sessionId = deleteModalSession.id;
    setDeletingSessionId(sessionId);
    const sessionRef = doc(db, "users", user.uid, "sessions", sessionId);
    try {
      await deleteDoc(sessionRef);
      setStatusMessage("Session deleted.");
      showToast("Session deleted.", "success");
    } catch (deleteError) {
      setStatusMessage("Failed to delete session. Please try again.");
      showToast("Failed to delete session. Please try again.", "error");
    } finally {
      setDeletingSessionId(null);
      setDeleteModalSession(null);
    }
  };

  const handleCloseDeleteModal = () => {
    if (deletingSessionId) return;
    setDeleteModalSession(null);
  };

  const handleRequestArchive = (session) => {
    if (!session) return;
    setArchiveModalSession(session);
  };

  const handleCloseArchiveModal = () => {
    if (archivingSessionIds.length > 0) return;
    setArchiveModalSession(null);
  };

  const handleRequestArchiveSelected = () => {
    if (selectedSessionIds.length === 0) return;
    setArchiveSelectedModalOpen(true);
  };

  const handleCloseArchiveSelectedModal = () => {
    if (isBulkArchiving) return;
    setArchiveSelectedModalOpen(false);
  };

  const handleArchiveSession = async (sessionId) => {
    if (!user || !sessionId) return;
    if (archivingSessionIds.includes(sessionId)) return;
    setArchivingSessionIds((prev) => [...prev, sessionId]);
    const sessionRef = doc(db, "users", user.uid, "sessions", sessionId);
    try {
      await updateDoc(sessionRef, {
        archivedAt: Date.now(),
      });
      setStatusMessage("Session archived.");
      showToast("Session archived.", "success");
      setSelectedSessionIds((prev) => prev.filter((id) => id !== sessionId));
    } catch (archiveError) {
      setStatusMessage("Failed to archive session. Please try again.");
      showToast("Failed to archive session. Please try again.", "error");
    } finally {
      setArchivingSessionIds((prev) => prev.filter((id) => id !== sessionId));
      setArchiveModalSession(null);
    }
  };

  const handleArchiveSelected = async () => {
    if (!user || selectedSessionIds.length === 0) return;
    setIsBulkArchiving(true);
    try {
      await Promise.all(
        selectedSessionIds.map((sessionId) =>
          updateDoc(doc(db, "users", user.uid, "sessions", sessionId), {
            archivedAt: Date.now(),
          })
        )
      );
      setStatusMessage("Selected sessions archived.");
      showToast("Selected sessions archived.", "success");
      setSelectedSessionIds([]);
    } catch (archiveError) {
      setStatusMessage("Failed to archive selected sessions. Please try again.");
      showToast("Failed to archive selected sessions. Please try again.", "error");
    } finally {
      setIsBulkArchiving(false);
      setArchiveSelectedModalOpen(false);
    }
  };

  const getProgressColor = (percentage) => {
    if (percentage >= 90) return "from-green-500 to-emerald-400";
    if (percentage >= 70) return "from-orange-500 to-amber-400";
    if (percentage >= 50) return "from-green-500 to-lime-400";
    return "from-orange-400 to-yellow-300";
  };

  return (
    <div className="space-y-8">
      {/* Mobile View */}
      <div className="space-y-6 lg:hidden">
        {/* Header with animated background */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-orange-100/80 blur-2xl" />
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                  Dashboard
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-900">Time Tracker</p>
                <p className="mt-2 text-xs text-slate-500">{effectiveStatusMessage}</p>
              </div>
              <div className="relative">
                <div className={`h-12 w-12 rounded-full bg-gradient-to-r ${getProgressColor(totals.progressPercentage)}`} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-bold text-slate-900">
                    {Math.round(totals.progressPercentage)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div 
            className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
            onMouseEnter={() => setHoveredCard('total')}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <div className={`absolute inset-0 bg-gradient-to-r from-orange-500/0 via-orange-500/10 to-orange-500/0 transition-all duration-500 ${hoveredCard === 'total' ? 'translate-x-full' : '-translate-x-full'}`} />
            <div className="relative">
              <p className="text-3xl font-bold text-slate-900">{formatHours(totals.totalHours)}</p>
              <p className="text-sm text-slate-500">Total Hours</p>
              <div className="mt-4 h-2 rounded-full bg-slate-200">
                <div
                  className={`h-2 rounded-full bg-gradient-to-r ${getProgressColor(totals.progressPercentage)} transition-all duration-700`}
                  style={{ width: `${totals.progressPercentage}%` }}
                />
              </div>
            </div>
          </div>
          
          <div 
            className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
            onMouseEnter={() => setHoveredCard('remaining')}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <div className={`absolute inset-0 bg-gradient-to-r from-green-500/0 via-green-500/10 to-green-500/0 transition-all duration-500 ${hoveredCard === 'remaining' ? 'translate-x-full' : '-translate-x-full'}`} />
            <div className="relative">
              <p className="text-3xl font-bold text-slate-900">{formatHours(totals.remainingHours)}</p>
              <p className="text-sm text-slate-500">Remaining</p>
              <div className="mt-4 flex items-center space-x-2">
                <div className="h-2 flex-1 rounded-full bg-slate-200">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-700"
                    style={{ width: `${100 - totals.progressPercentage}%` }}
                  />
                </div>
                <span className="text-xs text-slate-500">{TARGET_HOURS}h</span>
              </div>
            </div>
          </div>

          <div 
            className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
            onMouseEnter={() => setHoveredCard('sessions')}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <div className={`absolute inset-0 bg-gradient-to-r from-violet-500/0 via-violet-500/10 to-violet-500/0 transition-all duration-500 ${hoveredCard === 'sessions' ? 'translate-x-full' : '-translate-x-full'}`} />
            <div className="relative">
              <p className="text-3xl font-bold text-slate-900">{normalizedSessions.length}</p>
              <p className="text-sm text-slate-500">Sessions</p>
              <div className="mt-4 h-2 rounded-full bg-slate-200">
                <div className="h-2 w-2/3 rounded-full bg-gradient-to-r from-violet-400 to-purple-400" />
              </div>
            </div>
          </div>

          <div 
            className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
            onMouseEnter={() => setHoveredCard('time')}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <div className={`absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/10 to-emerald-500/0 transition-all duration-500 ${hoveredCard === 'time' ? 'translate-x-full' : '-translate-x-full'}`} />
            <div className="relative">
              <p className="text-3xl font-bold text-slate-900">{formatTime(now)}</p>
              <p className="text-sm text-slate-500">Live Time</p>
              <p className="mt-2 text-xs text-slate-500">{formatDate(now)}</p>
            </div>
          </div>
        </div>

        {/* Daily Analytics */}
        <button
          type="button"
          onClick={() => setAnalyticsModalOpen(true)}
          className="w-full rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                Analytics
              </p>
              <p className="mt-1 text-lg font-bold text-slate-900">Daily Hours</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              This Week
            </span>
          </div>
          <div className="mt-5 space-y-2 text-sm text-slate-600">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, idx) => {
              const hours = minutesToHours(dayTotals[idx]);
              const width = Math.min((dayTotals[idx] / (8 * 60)) * 100, 100);
              return (
                <div key={day} className="flex items-center gap-3">
                  <span className="w-8 text-xs text-slate-500">{day}</span>
                  <div className="h-2 flex-1 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-sky-400"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <span className="w-12 text-right text-xs font-semibold text-slate-700">
                    {hours.toFixed(1)}h
                  </span>
                </div>
              );
            })}
          </div>
        </button>

        {/* Recent Sessions */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-bold text-slate-900">Recent Sessions</p>
              <p className="text-sm text-slate-500">Track your time history</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600">
                {unarchivedSessions.length} active
              </span>
              <button
                type="button"
                onClick={() => setRecentModalOpen(true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                aria-label="View recent sessions"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="9" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
                </svg>
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={
                  recentSessions.length > 0 &&
                  recentSessions.every((session) => selectedSessionIds.includes(session.id))
                }
                onChange={toggleSelectRecentAll}
                className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-400"
              />
              Select recent
            </label>
            <span className="text-xs text-slate-500">
              {selectedSessionIds.length} selected
            </span>
            <button
              type="button"
              onClick={handleRequestArchiveSelected}
              disabled={selectedSessionIds.length === 0 || isBulkArchiving}
              className="ml-auto inline-flex items-center gap-2 rounded-full bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isBulkArchiving ? "Archiving..." : "Archive selected"}
            </button>
          </div>
          
          <div className="mt-6 space-y-3">
            {!loading && unarchivedSessions.length === 0 && (
              <div className="rounded-xl bg-slate-50 p-6 text-center">
                <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="mt-3 text-slate-500">No sessions yet</p>
                <p className="text-sm text-slate-400">Start tracking to see your history</p>
              </div>
            )}
            
            <div className="grid grid-cols-3 gap-4 sm:grid-cols-4">
              {recentSessions.map((session, index) => {
                const dayNumber = session.timeInDate?.getDate();
                const monthLabel = session.timeInDate?.toLocaleString("en-US", { month: "short" });

                return (
                  <div
                    key={session.id}
                    className="flex flex-col items-center gap-2"
                    style={{ animationDelay: `${index * 80}ms` }}
                  >
                    <button
                      type="button"
                      onClick={() => setDetailSession(session)}
                      className="group inline-flex h-16 w-16 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
                      aria-label={`View session on ${formatDate(session.timeInDate)}`}
                    >
                      <div className="text-center leading-tight">
                        <div className="text-sm font-semibold">{dayNumber || "--"}</div>
                        <div className="text-[10px] uppercase tracking-wide text-slate-400">{monthLabel || ""}</div>
                      </div>
                    </button>
                    <label className="inline-flex items-center gap-2 text-xs text-slate-500">
                      <input
                        type="checkbox"
                        checked={isSessionSelected(session.id)}
                        onChange={() => toggleSelectSession(session.id)}
                        className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-400"
                      />
                      Select
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Desktop View */}
      <div className="hidden space-y-8 lg:block">
        {/* Top Stats Bar */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-orange-100/80 blur-xl" />
            <div className="relative">
              <p className="text-sm font-medium text-slate-500">Live Time</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{formatTime(now)}</p>
              <p className="text-sm text-slate-500">{formatDate(now)}</p>
              <div className="mt-4 flex items-center space-x-2">
                <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-green-400"></span>
                <span className="text-xs text-slate-500">Live updating</span>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-emerald-100/70 blur-xl" />
            <div className="relative">
              <p className="text-sm font-medium text-slate-500">Total Hours</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{formatHours(totals.totalHours)}</p>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm text-slate-500">{TARGET_HOURS}h target</span>
                <span className="text-sm font-bold text-emerald-600">{Math.round(totals.progressPercentage)}%</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-200">
                <div
                  className={`h-2 rounded-full bg-gradient-to-r ${getProgressColor(totals.progressPercentage)} transition-all duration-1000`}
                  style={{ width: `${totals.progressPercentage}%` }}
                />
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-sky-100/70 blur-xl" />
            <div className="relative">
              <p className="text-sm font-medium text-slate-500">Remaining</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{formatHours(totals.remainingHours)}</p>
              <div className="mt-4 flex items-center space-x-3">
                <div className="h-2 flex-1 rounded-full bg-slate-200">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-1000"
                    style={{ width: `${100 - totals.progressPercentage}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-violet-100/70 blur-xl" />
            <div className="relative">
              <p className="text-sm font-medium text-slate-500">Sessions</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{normalizedSessions.length}</p>
              <div className="mt-4 flex items-center space-x-3">
                <div className="h-2 flex-1 rounded-full bg-slate-200">
                  <div className="h-2 w-3/4 rounded-full bg-gradient-to-r from-violet-400 to-purple-400" />
                </div>
                <span className="text-xs text-slate-500">Active: {activeSession ? "Yes" : "No"}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                  Analytics
                </p>
                <p className="mt-1 text-xl font-bold text-slate-900">Daily Hours</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                This Week
              </span>
            </div>
            <div className="mt-6 space-y-3 text-sm text-slate-600">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, idx) => {
                const hours = minutesToHours(dayTotals[idx]);
                const width = Math.min((dayTotals[idx] / (8 * 60)) * 100, 100);
                return (
                  <div key={day} className="flex items-center gap-4">
                    <span className="w-10 text-xs text-slate-500">{day}</span>
                    <div className="h-2 flex-1 rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-sky-400"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <span className="w-12 text-right text-xs font-semibold text-slate-700">
                      {hours.toFixed(1)}h
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                  Summary
                </p>
                <p className="mt-1 text-xl font-bold text-slate-900">Target</p>
              </div>
            </div>
            <div className="mt-6">
              <div className="text-3xl font-bold text-slate-900">
                {formatHours(totals.totalHours)}
              </div>
              <div className="mt-1 text-sm text-slate-500">
                of {TARGET_HOURS} hours goal
              </div>
              <div className="mt-4 h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-sky-400 transition-all duration-700"
                  style={{ width: `${totals.progressPercentage}%` }}
                />
              </div>
              <div className="mt-2 text-xs text-slate-500">
                {totals.progressPercentage.toFixed(1)}% complete
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Sessions List */}
          <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 shadow-sm lg:col-span-3">
            <div className="absolute -right-12 top-1/2 h-48 w-48 -translate-y-1/2 rounded-full bg-orange-100/70 blur-2xl" />
            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Time Sessions</h3>
                  <p className="mt-1 text-sm text-slate-500">Your complete tracking history</p>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="rounded-full bg-slate-100 px-4 py-2">
                    <span className="text-sm font-bold text-slate-900">{unarchivedSessions.length}</span>
                    <span className="ml-2 text-sm text-slate-500">active</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={
                      unarchivedSessions.length > 0 &&
                      selectedSessionIds.length === unarchivedSessions.length
                    }
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-400"
                  />
                  Select all
                </label>
                <span className="text-xs text-slate-500">
                  {selectedSessionIds.length} selected
                </span>
                <button
                  type="button"
                  onClick={handleRequestArchiveSelected}
                  disabled={selectedSessionIds.length === 0 || isBulkArchiving}
                  className="ml-auto inline-flex items-center gap-2 rounded-full bg-orange-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isBulkArchiving ? "Archiving..." : "Archive selected"}
                </button>
              </div>

              {loading && (
                <div className="mt-6 space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100"></div>
                  ))}
                </div>
              )}

              {error && (
                <div className="mt-6 rounded-xl bg-red-50 p-6 text-center text-red-600">
                  <svg className="mx-auto h-12 w-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="mt-3">{error}</p>
                </div>
              )}

              <div className="mt-6 space-y-4">
                {!loading && unarchivedSessions.length === 0 && (
                  <div className="rounded-xl bg-slate-50 p-8 text-center">
                    <svg className="mx-auto h-16 w-16 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="mt-4 text-lg font-medium text-slate-800">No active sessions</p>
                    <p className="mt-2 text-sm text-slate-500">Archive moves sessions off the list</p>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                  {unarchivedSessions.map((session, index) => {
                    const dayNumber = session.timeInDate?.getDate();
                    const monthLabel = session.timeInDate?.toLocaleString("en-US", { month: "short" });

                    return (
                      <div
                        key={session.id}
                        className="flex flex-col items-center gap-2"
                        style={{ animationDelay: `${index * 30}ms` }}
                      >
                        <button
                          type="button"
                          onClick={() => setDetailSession(session)}
                          className="group relative inline-flex h-16 w-16 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
                          aria-label={`View session on ${formatDate(session.timeInDate)}`}
                        >
                          <span className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-50 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
                          <div className="text-center leading-tight">
                            <div className="text-sm font-semibold">{dayNumber || "--"}</div>
                            <div className="text-[10px] uppercase tracking-wide text-slate-400">{monthLabel || ""}</div>
                          </div>
                        </button>
                        <label className="inline-flex items-center gap-2 text-xs text-slate-500">
                          <input
                            type="checkbox"
                            checked={isSessionSelected(session.id)}
                            onChange={() => toggleSelectSession(session.id)}
                            className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-400"
                          />
                          Select
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {toasts.length > 0 && (
        <div className="fixed right-4 top-4 z-50 space-y-3">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`flex items-start gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold shadow-sm transition-all ${
                toast.variant === "error"
                  ? "bg-red-50 text-red-700"
                  : "bg-white text-slate-900"
              }`}
            >
              <span>{toast.message}</span>
            </div>
          ))}
        </div>
      )}

      {deleteModalSession && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4"
          onClick={handleCloseDeleteModal}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Delete session?</h3>
                <p className="mt-2 text-sm text-slate-600">
                  This will permanently remove the session on{" "}
                  <span className="font-semibold text-slate-700">
                    {formatDate(deleteModalSession.timeInDate)}
                  </span>
                  .
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseDeleteModal}
                disabled={!!deletingSessionId}
                className="rounded-full p-1 text-slate-400 transition hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleCloseDeleteModal}
                disabled={!!deletingSessionId}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={!!deletingSessionId}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingSessionId ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {archiveModalSession && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4"
          onClick={handleCloseArchiveModal}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Archive session?</h3>
                <p className="mt-2 text-sm text-slate-600">
                  This will move the session on{" "}
                  <span className="font-semibold text-slate-700">
                    {formatDate(archiveModalSession.timeInDate)}
                  </span>{" "}
                  to the Archive.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseArchiveModal}
                disabled={archivingSessionIds.length > 0}
                className="rounded-full p-1 text-slate-400 transition hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleCloseArchiveModal}
                disabled={archivingSessionIds.length > 0}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleArchiveSession(archiveModalSession.id)}
                disabled={archivingSessionIds.length > 0}
                className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {archivingSessionIds.length > 0 ? "Archiving..." : "Archive"}
              </button>
            </div>
          </div>
        </div>
      )}

      {archiveSelectedModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4"
          onClick={handleCloseArchiveSelectedModal}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Archive selected?</h3>
                <p className="mt-2 text-sm text-slate-600">
                  You are about to archive{" "}
                  <span className="font-semibold text-slate-700">
                    {selectedSessionIds.length}
                  </span>{" "}
                  session{selectedSessionIds.length === 1 ? "" : "s"}.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseArchiveSelectedModal}
                disabled={isBulkArchiving}
                className="rounded-full p-1 text-slate-400 transition hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleCloseArchiveSelectedModal}
                disabled={isBulkArchiving}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleArchiveSelected}
                disabled={isBulkArchiving}
                className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isBulkArchiving ? "Archiving..." : "Archive selected"}
              </button>
            </div>
          </div>
        </div>
      )}

      {analyticsModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setAnalyticsModalOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-slate-200 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Weekly Analytics
                  </h3>
                  <p className="mt-2 text-sm text-slate-500">
                    Select a week to review your daily hours and totals.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAnalyticsModalOpen(false)}
                  className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Week
                </label>
                <select
                  value={selectedWeekStart || ""}
                  onChange={(event) => setSelectedWeekStart(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                >
                  {weeklyBuckets.map((week) => (
                    <option key={week.key} value={week.key}>
                      {formatDate(week.start)} – {formatDate(week.end)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">Total Hours</p>
                  <p className="mt-2 text-xl font-bold text-slate-900">
                    {formatHours(
                      minutesToHours(
                        selectedWeekDayTotals.reduce((sum, minutes) => sum + minutes, 0)
                      )
                    )}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">Sessions</p>
                  <p className="mt-2 text-xl font-bold text-slate-900">
                    {weekSessions.length}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">Remaining</p>
                  <p className="mt-2 text-xl font-bold text-slate-900">
                    {formatHours(totals.remainingHours)}
                  </p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                    Daily Hours
                  </p>
                  <span className="text-xs text-slate-500">
                    {selectedWeek
                      ? `${formatDate(selectedWeek.start)} – ${formatDate(selectedWeek.end)}`
                      : "Current Week"}
                  </span>
                </div>
                <div className="mt-4 space-y-2 text-sm text-slate-600">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, idx) => {
                    const hours = minutesToHours(selectedWeekDayTotals[idx]);
                    const width = Math.min((selectedWeekDayTotals[idx] / (8 * 60)) * 100, 100);
                    return (
                      <div key={day} className="flex items-center gap-3">
                        <span className="w-8 text-xs text-slate-500">{day}</span>
                        <div className="h-2 flex-1 rounded-full bg-slate-100">
                          <div
                            className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-sky-400"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                        <span className="w-12 text-right text-xs font-semibold text-slate-700">
                          {hours.toFixed(1)}h
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {recentModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setRecentModalOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Active Sessions</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Showing {recentSessions.length} of {unarchivedSessions.length}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRecentModalOpen(false)}
                className="rounded-full p-1 text-slate-400 transition hover:text-slate-900"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 max-h-[50vh] space-y-3 overflow-y-auto">
              {recentSessions.length === 0 ? (
                <div className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">
                  No active sessions.
                </div>
              ) : (
                recentSessions.map((session) => {
                  const durationMinutes = session.timeOutRoundedDate && session.timeInRoundedDate
                    ? diffMinutes(session.timeInRoundedDate, session.timeOutRoundedDate)
                    : 0;
                  const durationLabel = session.timeOutRoundedDate && session.timeInRoundedDate
                    ? formatHours(minutesToHours(durationMinutes))
                    : "In progress";

                  return (
                    <div key={session.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            {formatDate(session.timeInDate)}
                          </div>
                          <div className="text-xs text-slate-500">
                            {formatTime(session.timeInRoundedDate)}
                            {session.timeOutRoundedDate && ` - ${formatTime(session.timeOutRoundedDate)}`}
                          </div>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {durationLabel}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleRequestArchive(session)}
                          disabled={archivingSessionIds.includes(session.id)}
                          className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 transition hover:border-orange-300 hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {archivingSessionIds.includes(session.id) ? "Archiving..." : "Archive"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRequestDelete(session)}
                          className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-100"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {detailSession && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setDetailSession(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative border-b border-slate-200 bg-gradient-to-r from-indigo-50 via-white to-sky-50 p-6">
              <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-indigo-100/60 blur-2xl" />
              <div className="relative flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Session Details</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {formatDate(detailSession.timeInDate)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailSession(null)}
                  className="rounded-full p-1 text-slate-400 transition hover:text-slate-900"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="grid gap-4 text-sm text-slate-600">
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Actual Time</div>
                  <div className="mt-2 text-base font-semibold text-slate-900">
                    {formatTime(detailSession.timeInDate)}
                    {detailSession.timeOutDate && ` - ${formatTime(detailSession.timeOutDate)}`}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Rounded Time</div>
                  <div className="mt-2 text-base font-semibold text-slate-900">
                    {formatTime(detailSession.timeInRoundedDate)}
                    {detailSession.timeOutRoundedDate && ` - ${formatTime(detailSession.timeOutRoundedDate)}`}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Duration</div>
                  <div className="mt-2 text-base font-semibold text-slate-900">
                    {detailSession.timeOutRoundedDate && detailSession.timeInRoundedDate
                      ? formatHours(
                          minutesToHours(
                            diffMinutes(detailSession.timeInRoundedDate, detailSession.timeOutRoundedDate)
                          )
                        )
                      : "In progress"}
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setDetailSession(null);
                    handleRequestDelete(detailSession);
                  }}
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleArchiveSession(detailSession.id);
                    setDetailSession(null);
                  }}
                  disabled={archivingSessionIds.includes(detailSession.id)}
                  className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {archivingSessionIds.includes(detailSession.id) ? "Archiving..." : "Archive"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
