import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useSessions } from "../hooks/useSessions.js";
import {
  diffMinutes,
  formatDate,
  formatHours,
  formatTime,
  minutesToHours,
} from "../utils/time.js";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase.js";

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

export default function Archive() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { sessions, loading, error } = useSessions(user?.uid);
  const [activeWeek, setActiveWeek] = useState(null);
  const [unarchiveModalSession, setUnarchiveModalSession] = useState(null);
  const [unarchivingSessionId, setUnarchivingSessionId] = useState(null);
  const [selectedArchivedIds, setSelectedArchivedIds] = useState([]);
  const [isBulkUnarchiving, setIsBulkUnarchiving] = useState(false);
  const [bulkUnarchiveModalOpen, setBulkUnarchiveModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [isWeekViewExpanded, setIsWeekViewExpanded] = useState({});

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

  const archivedWeeks = useMemo(() => {
    const weeksMap = new Map();

    normalizedSessions.forEach((session) => {
      if (!session.timeInDate || !session.archivedAt) return;
      const weekStart = startOfWeekMonday(session.timeInDate);
      const weekEnd = endOfWeekFriday(weekStart);
      const key = weekStart.toISOString().slice(0, 10);

      if (!weeksMap.has(key)) {
        weeksMap.set(key, {
          id: key,
          start: weekStart,
          end: weekEnd,
          sessions: [],
        });
      }
      weeksMap.get(key).sessions.push(session);
    });

    return Array.from(weeksMap.values())
      .map((week) => {
        const completedSessions = week.sessions.filter(
          (session) =>
            session.timeInRoundedDate && session.timeOutRoundedDate
        );
        const totalMinutes = completedSessions.reduce(
          (sum, session) =>
            sum +
            diffMinutes(session.timeInRoundedDate, session.timeOutRoundedDate),
          0
        );
        
        // Calculate average hours per day
        const averageHours = totalMinutes / (5 * 60); // 5 working days
        
        // Find busiest day
        const dayTotals = {};
        week.sessions.forEach(session => {
          const day = session.timeInDate?.getDay() || 0;
          const duration = session.timeInRoundedDate && session.timeOutRoundedDate 
            ? diffMinutes(session.timeInRoundedDate, session.timeOutRoundedDate)
            : 0;
          dayTotals[day] = (dayTotals[day] || 0) + duration;
        });
        
        const busiestDay = Object.entries(dayTotals)
          .sort(([,a], [,b]) => b - a)[0]?.[0];
          
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        return {
          ...week,
          completedSessions,
          totalMinutes,
          totalHours: minutesToHours(totalMinutes),
          averageHours: averageHours.toFixed(1),
          busiestDay: dayNames[busiestDay] || 'N/A',
          dayTotals,
        };
      })
      .sort((a, b) => b.start - a.start);
  }, [normalizedSessions]);

  const filteredArchivedWeeks = useMemo(() => {
    let filtered = archivedWeeks;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(week => 
        formatDate(week.start).toLowerCase().includes(term) ||
        formatDate(week.end).toLowerCase().includes(term) ||
        week.totalHours.toString().includes(term)
      );
    }
    
    switch(sortBy) {
      case 'hours-asc':
        return [...filtered].sort((a, b) => a.totalMinutes - b.totalMinutes);
      case 'hours-desc':
        return [...filtered].sort((a, b) => b.totalMinutes - a.totalMinutes);
      case 'date-asc':
        return [...filtered].sort((a, b) => a.start - b.start);
      case 'sessions':
        return [...filtered].sort((a, b) => b.sessions.length - a.sessions.length);
      default:
        return filtered;
    }
  }, [archivedWeeks, searchTerm, sortBy]);

  const handleCloseModal = () => setActiveWeek(null);

  const handleExportWeekToReport = () => {
    if (!activeWeek?.start || !activeWeek?.end) return;
    navigate("/weekly-report", {
      state: {
        source: "archive",
        weekStart: activeWeek.start.getTime(),
        weekEnd: activeWeek.end.getTime(),
      },
    });
  };

  const handleRequestExport = () => {
    if (!activeWeek?.start || !activeWeek?.end) return;
    setExportModalOpen(true);
  };

  const handleCloseExportModal = () => {
    setExportModalOpen(false);
  };

  const showToast = (message, variant = "success") => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3000);
  };

  const handleRequestUnarchive = (session) => {
    if (!session) return;
    setUnarchiveModalSession(session);
  };

  const handleCloseUnarchiveModal = () => {
    if (unarchivingSessionId) return;
    setUnarchiveModalSession(null);
  };

  const handleRequestBulkUnarchive = () => {
    if (selectedArchivedIds.length === 0) return;
    setBulkUnarchiveModalOpen(true);
  };

  const handleRequestUnarchiveAll = () => {
    if (activeWeekSessions.length === 0) return;
    setSelectedArchivedIds(activeWeekSessions.map((session) => session.id));
    setBulkUnarchiveModalOpen(true);
  };

  const handleCloseBulkUnarchiveModal = () => {
    if (isBulkUnarchiving) return;
    setBulkUnarchiveModalOpen(false);
  };

  const handleConfirmUnarchive = async () => {
    if (!user || !unarchiveModalSession?.id) return;
    const sessionId = unarchiveModalSession.id;
    setUnarchivingSessionId(sessionId);
    try {
      await updateDoc(doc(db, "users", user.uid, "sessions", sessionId), {
        archivedAt: null,
      });
      showToast("Session unarchived successfully!", "success");
      setUnarchiveModalSession(null);
    } catch (unarchiveError) {
      showToast("Failed to unarchive session. Please try again.", "error");
    } finally {
      setUnarchivingSessionId(null);
    }
  };

  const handleConfirmBulkUnarchive = async () => {
    if (!user || selectedArchivedIds.length === 0) return;
    setIsBulkUnarchiving(true);
    try {
      await Promise.all(
        selectedArchivedIds.map((sessionId) =>
          updateDoc(doc(db, "users", user.uid, "sessions", sessionId), {
            archivedAt: null,
          })
        )
      );
      showToast(`${selectedArchivedIds.length} sessions unarchived!`, "success");
      setSelectedArchivedIds([]);
    } catch (bulkError) {
      showToast("Failed to unarchive selected sessions.", "error");
    } finally {
      setIsBulkUnarchiving(false);
      setBulkUnarchiveModalOpen(false);
    }
  };

  const activeWeekSessions = useMemo(() => {
    if (!activeWeek) return [];
    return [...activeWeek.sessions].sort(
      (a, b) => a.timeInDate - b.timeInDate
    );
  }, [activeWeek]);

  useEffect(() => {
    if (!activeWeek) {
      setSelectedArchivedIds([]);
      return;
    }
    setSelectedArchivedIds((prev) =>
      prev.filter((id) => activeWeekSessions.some((session) => session.id === id))
    );
  }, [activeWeek, activeWeekSessions]);

  const isArchivedSelected = (sessionId) =>
    selectedArchivedIds.includes(sessionId);

  const toggleSelectArchived = (sessionId) => {
    setSelectedArchivedIds((prev) =>
      prev.includes(sessionId)
        ? prev.filter((id) => id !== sessionId)
        : [...prev, sessionId]
    );
  };

  const toggleSelectAllArchived = () => {
    if (activeWeekSessions.length === 0) {
      setSelectedArchivedIds([]);
      return;
    }
    if (selectedArchivedIds.length === activeWeekSessions.length) {
      setSelectedArchivedIds([]);
      return;
    }
    setSelectedArchivedIds(activeWeekSessions.map((session) => session.id));
  };

  const toggleWeekView = (weekId) => {
    setIsWeekViewExpanded(prev => ({
      ...prev,
      [weekId]: !prev[weekId]
    }));
  };

  const getDayColor = (day) => {
    const colors = {
      0: 'from-green-500/20 to-green-600/20',
      1: 'from-emerald-500/20 to-emerald-600/20',
      2: 'from-purple-500/20 to-purple-600/20',
      3: 'from-amber-500/20 to-amber-600/20',
      4: 'from-rose-500/20 to-rose-600/20',
      5: 'from-green-500/20 to-emerald-600/20',
      6: 'from-slate-500/20 to-slate-600/20'
    };
    return colors[day] || colors[0];
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6 text-slate-900">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.12),transparent_55%)]"></div>
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-indigo-700">
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 3v18h18V3H3zm16 16H5V7h14v12zM9 10h6v6H9v-6z"/>
                </svg>
                Archive
              </div>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
                Time Archives
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">
                Review and manage your archived time sessions. Sessions are grouped by work weeks with detailed insights.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-2 md:mt-0">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50">
                <span className="text-lg font-bold text-indigo-700">
                  {archivedWeeks.length}
                </span>
              </span>
              <div className="text-sm">
                <div className="font-semibold text-slate-700">Weeks Archived</div>
                <div className="text-slate-500">Total Records</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center">
        <div className="flex-1">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search weeks by date or hours..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 placeholder-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          >
            <option value="date-desc">Newest First</option>
            <option value="date-asc">Oldest First</option>
            <option value="hours-desc">Most Hours</option>
            <option value="hours-asc">Least Hours</option>
            <option value="sessions">Most Sessions</option>
          </select>
        </div>
      </div>

      {/* Loading & Error States */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="h-4 w-1/3 rounded bg-slate-200"></div>
              <div className="mt-4 h-8 w-1/2 rounded bg-slate-200"></div>
              <div className="mt-4 flex gap-4">
                <div className="h-20 flex-1 rounded-xl bg-slate-200"></div>
                <div className="h-20 flex-1 rounded-xl bg-slate-200"></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 flex-shrink-0 text-red-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="font-semibold text-red-700">Error Loading Archives</h3>
              <p className="mt-1 text-sm text-red-600">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && archivedWeeks.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
            <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900">No Archives Yet</h3>
          <p className="mt-2 text-sm text-slate-500">
            Archive sessions from your Time Sessions list to view them here.
          </p>
        </div>
      )}

      {/* Weeks List */}
      {filteredArchivedWeeks.length > 0 && (
        <div className="flex flex-col gap-4">
          {filteredArchivedWeeks.map((week) => {
            const monthLetter = week.start.toLocaleString("en-US", {
              month: "short",
            })[0];
            const weekOfMonth = Math.ceil(week.start.getDate() / 7);
            return (
              <div key={week.id}>
                {/* Mobile compact item */}
                <button
                  type="button"
                  onClick={() => setActiveWeek(week)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:shadow-md md:hidden"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-lg font-semibold text-white">
                    {monthLetter}
                  </div>
                  <div className="flex-1">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Week {weekOfMonth}
                    </div>
                    <div className="text-sm font-semibold text-slate-900">
                      {formatDate(week.start)} – {formatDate(week.end)}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {formatHours(week.totalHours)} hrs • {week.sessions.length} sessions
                    </div>
                  </div>
                  <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {/* Desktop card */}
                <div className="group relative hidden overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md md:block">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(99,102,241,0.12),transparent_55%)]" />
                  <div className="relative z-10 space-y-5">
                    <div className="flex items-center justify-between">
                      <div className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600">
                        Week {formatDate(week.start)}
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveWeek(week)}
                        className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
                      >
                        View Details
                      </button>
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-slate-900">
                        {formatDate(week.start)} – {formatDate(week.end)}
                      </h3>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-sm text-slate-500">Total Hours</div>
                        <div className="mt-2 text-2xl font-bold text-slate-900">
                          {formatHours(week.totalHours)} hrs
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-sm text-slate-500">Sessions</div>
                        <div className="mt-2 text-2xl font-bold text-indigo-600">
                          {week.sessions.length}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                      <span className="text-slate-500">Click to view all sessions</span>
                      <button
                        type="button"
                        onClick={() => setActiveWeek(week)}
                        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-indigo-500 active:scale-95"
                      >
                        View Details
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Week Modal - Rest of the modal code remains the same but with updated styling */}
      {activeWeek && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4"
          onClick={handleCloseModal}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-4xl rounded-2xl bg-white p-0 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="border-b border-slate-200 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">
                    Week of {formatDate(activeWeek.start)}
                  </h3>
                  <div className="mt-2 flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-indigo-500"></span>
                      <span className="text-sm text-slate-600">
                        {activeWeek.sessions.length} sessions
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-sky-500"></span>
                      <span className="text-sm text-slate-600">
                        Total: {formatHours(activeWeek.totalHours)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-purple-500"></span>
                      <span className="text-sm text-slate-600">
                        Avg: {activeWeek.averageHours}h/day
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRequestExport}
                    className="rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
                  >
                    Export to Weekly Report
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="rounded-full p-2 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700 active:scale-95"
                    aria-label="Close"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Bulk Actions Bar */}
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 p-4 backdrop-blur-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={
                        activeWeekSessions.length > 0 &&
                        selectedArchivedIds.length === activeWeekSessions.length
                      }
                      onChange={toggleSelectAllArchived}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
                    />
                    <span className="text-sm text-slate-600">Select all</span>
                  </label>
                  <div className="text-sm text-slate-500">
                    <span className="font-semibold text-indigo-600">{selectedArchivedIds.length}</span> selected
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRequestUnarchiveAll}
                    disabled={activeWeekSessions.length === 0 || isBulkUnarchiving}
                    className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition-all hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Unarchive all ({activeWeekSessions.length})
                  </button>
                  <button
                    type="button"
                    onClick={handleRequestBulkUnarchive}
                    disabled={selectedArchivedIds.length === 0 || isBulkUnarchiving}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isBulkUnarchiving ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Unarchive Selected
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Sessions List */}
            <div className="max-h-[60vh] overflow-y-auto p-4">
              {activeWeekSessions.length === 0 ? (
                <div className="rounded-xl bg-slate-50 p-8 text-center">
                  <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h4 className="mt-4 text-lg font-semibold text-slate-800">No Sessions</h4>
                  <p className="mt-2 text-sm text-slate-500">No time sessions recorded for this week.</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {activeWeekSessions.map((session) => {
                    const durationMinutes =
                      session.timeInRoundedDate && session.timeOutRoundedDate
                        ? diffMinutes(
                            session.timeInRoundedDate,
                            session.timeOutRoundedDate
                          )
                        : 0;
                    const day = session.timeInDate?.getDay() || 0;
                    
                    return (
                      <div
                        key={session.id}
                        className={`group rounded-xl border ${
                          isArchivedSelected(session.id)
                            ? 'border-indigo-300 bg-indigo-50'
                            : 'border-slate-200 bg-white'
                        } p-4 transition-all hover:border-indigo-300 hover:bg-indigo-50/40`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={isArchivedSelected(session.id)}
                              onChange={() => toggleSelectArchived(session.id)}
                              className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-slate-900">
                                  {formatDate(session.timeInDate)}
                                </span>
                                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                  day >= 1 && day <= 5 
                                    ? 'bg-indigo-100 text-indigo-700'
                                    : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][day]}
                                </span>
                              </div>
                              <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <div className="text-xs text-slate-500">Actual Time</div>
                                  <div className="text-slate-700">
                                    {formatTime(session.timeInDate)}
                                    {session.timeOutDate &&
                                      ` – ${formatTime(session.timeOutDate)}`}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs text-slate-500">Rounded Time</div>
                                  <div className="text-slate-700">
                                    {session.timeInRoundedDate
                                      ? formatTime(session.timeInRoundedDate)
                                      : "--"}
                                    {session.timeOutRoundedDate &&
                                      ` – ${formatTime(session.timeOutRoundedDate)}`}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-slate-500">Duration</div>
                            <div className="text-lg font-bold text-slate-900">
                              {formatHours(minutesToHours(durationMinutes))}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRequestUnarchive(session)}
                              className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition-all hover:bg-indigo-100"
                            >
                              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              Restore
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {exportModalOpen && activeWeek && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={handleCloseExportModal}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-slate-200 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Export Week to Report?</h3>
                  <p className="mt-2 text-sm text-slate-500">
                    This will open the Weekly Report preview with the selected
                    dates and session times.
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-4 text-sm text-indigo-700">
                Week of {formatDate(activeWeek.start)} – {formatDate(activeWeek.end)}
              </div>
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseExportModal}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-600 transition-all hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExportWeekToReport}
                  className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-indigo-500 active:scale-95"
                >
                  Export to Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toasts */}
      {toasts.length > 0 && (
        <div className="fixed right-4 top-4 z-50 space-y-3 md:right-6 md:top-6">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`flex items-center gap-3 rounded-xl border ${
                toast.variant === "error"
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-indigo-200 bg-indigo-50 text-indigo-700"
              } px-4 py-3 text-sm font-semibold shadow-sm animate-in slide-in-from-right-4`}
            >
              {toast.variant === "success" ? (
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
              <span>{toast.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Unarchive Modal - Updated with better styling */}
      {unarchiveModalSession && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4"
          onClick={handleCloseUnarchiveModal}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-0 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-slate-200 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Restore Session?</h3>
                  <p className="mt-2 text-sm text-slate-500">
                    This session from{" "}
                    <span className="font-semibold text-slate-900">
                      {formatDate(unarchiveModalSession.timeInDate)}
                    </span>{" "}
                    will be moved back to your active sessions.
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="rounded-xl bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Session Details</div>
                <div className="mt-3 grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-slate-500">Date</div>
                    <div className="text-sm font-medium text-slate-900">
                      {formatDate(unarchiveModalSession.timeInDate)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Duration</div>
                    <div className="text-sm font-medium text-indigo-300">
                      {unarchiveModalSession.timeInRoundedDate && unarchiveModalSession.timeOutRoundedDate
                        ? formatHours(minutesToHours(diffMinutes(
                            unarchiveModalSession.timeInRoundedDate,
                            unarchiveModalSession.timeOutRoundedDate
                          )))
                        : "--"}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseUnarchiveModal}
                  disabled={!!unarchivingSessionId}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-600 transition-all hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmUnarchive}
                  disabled={!!unarchivingSessionId}
                  className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-indigo-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {unarchivingSessionId ? (
                    <>
                      <svg className="inline h-4 w-4 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Restoring...
                    </>
                  ) : (
                    'Restore Session'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Unarchive Modal - Updated */}
      {bulkUnarchiveModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4"
          onClick={handleCloseBulkUnarchiveModal}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-0 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-slate-200 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Restore Multiple Sessions?</h3>
                  <p className="mt-2 text-sm text-slate-500">
                    You're about to restore{" "}
                    <span className="font-semibold text-indigo-600">
                      {selectedArchivedIds.length}
                    </span>{" "}
                    session{selectedArchivedIds.length === 1 ? "" : "s"} to your active list.
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="rounded-xl bg-slate-50 p-4">
                <div className="flex items-center justify-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {selectedArchivedIds.length} Session{selectedArchivedIds.length === 1 ? "" : "s"}
                    </div>
                    <div className="text-xs text-slate-500">
                      Will be moved to active sessions
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseBulkUnarchiveModal}
                  disabled={isBulkUnarchiving}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-600 transition-all hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBulkUnarchive}
                  disabled={isBulkUnarchiving}
                  className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-indigo-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isBulkUnarchiving ? (
                    <>
                      <svg className="inline h-4 w-4 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Restoring...
                    </>
                  ) : (
                    `Restore ${selectedArchivedIds.length} Session${selectedArchivedIds.length === 1 ? "" : "s"}`
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
