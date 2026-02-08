import { useEffect, useMemo, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { jsPDF } from "jspdf";
import { doc, updateDoc } from "firebase/firestore";
import { useAuth } from "../context/AuthContext.jsx";
import { useSessions } from "../hooks/useSessions.js";
import { db } from "../firebase.js";
import {
  TARGET_HOURS,
  BASELINE_COMPLETED_MINUTES,
  diffMinutes,
  formatDate,
  formatDateTime,
  formatHours,
  formatTime,
  minutesToHours,
} from "../utils/time.js";

const toDate = (ms) => (ms ? new Date(ms) : null);
const formatDuration = (minutes) => {
  const total = Math.round(minutes);
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return `${hours}h ${mins.toString().padStart(2, "0")}m`;
};

export default function WeeklyReport() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { sessions, loading, error } = useSessions(user?.uid);
  const [now, setNow] = useState(() => new Date());
  const [weeklyReport, setWeeklyReport] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [activeTab, setActiveTab] = useState("report");
  const [charCount, setCharCount] = useState(0);
  const [restoreModalSession, setRestoreModalSession] = useState(null);
  const [restoringSessionId, setRestoringSessionId] = useState(null);
  const [selectedReportIds, setSelectedReportIds] = useState([]);
  const [bulkRestoreModalOpen, setBulkRestoreModalOpen] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setCharCount(weeklyReport.length);
  }, [weeklyReport]);

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

  const isFromArchive = location.state?.source === "archive";
  useEffect(() => {
    if (isFromArchive) {
      setActiveTab("preview");
    }
  }, [isFromArchive]);
  const reportRange = useMemo(() => {
    const state = location.state;
    if (!state?.weekStart || !state?.weekEnd) return null;
    const start = new Date(state.weekStart);
    const end = new Date(state.weekEnd);
    return { start, end };
  }, [location.state]);

  const reportSessions = useMemo(() => {
    if (!reportRange) return normalizedSessions;
    return normalizedSessions.filter((session) => {
      if (!session.timeInDate) return false;
      return session.timeInDate >= reportRange.start && session.timeInDate <= reportRange.end;
    });
  }, [normalizedSessions, reportRange]);

  const visibleReportSessions = useMemo(
    () => reportSessions.slice(0, 5),
    [reportSessions]
  );

  useEffect(() => {
    setSelectedReportIds((prev) =>
      prev.filter((id) =>
        visibleReportSessions.some((session) => session.id === id)
      )
    );
  }, [visibleReportSessions]);

  const totals = useMemo(() => {
    const completed = reportSessions.filter((session) => session.timeOut);
    const completedMinutes = completed.reduce(
      (sum, session) =>
        sum + diffMinutes(session.timeInRoundedDate, session.timeOutRoundedDate),
      0
    );

    const totalMinutes = completedMinutes + BASELINE_COMPLETED_MINUTES;
    const totalHours = minutesToHours(totalMinutes);
    const remainingHours = Math.max(TARGET_HOURS - totalHours, 0);
    const progressPercentage = Math.min((totalHours / TARGET_HOURS) * 100, 100);
    
    return { totalMinutes, totalHours, remainingHours, progressPercentage };
  }, [reportSessions]);

  const handleExportPdf = async () => {
    setIsGenerating(true);
    setExportProgress(0);
    
    // Simulate progress steps for better UX
    const progressInterval = setInterval(() => {
      setExportProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 50);

    try {
      const docPdf = new jsPDF();
      docPdf.setFillColor(255, 255, 255);
      docPdf.rect(0, 0, 210, 297, "F");

      docPdf.setFont("helvetica", "bold");
      docPdf.setFontSize(18);
      docPdf.setTextColor(0, 0, 0);
      docPdf.text("WEEKLY TIME REPORT", 105, 18, { align: "center" });

      docPdf.setFontSize(9);
      docPdf.setTextColor(60, 60, 60);
      docPdf.text(`Generated: ${formatDateTime(now)}`, 105, 26, { align: "center" });

      // Summary section
      docPdf.setDrawColor(200, 200, 200);
      docPdf.setFillColor(245, 245, 245);
      docPdf.roundedRect(14, 34, 182, 34, 2, 2, "FD");

      docPdf.setFontSize(11);
      docPdf.setTextColor(0, 0, 0);
      docPdf.text("Weekly Summary", 20, 46);

      docPdf.setFontSize(10);
      docPdf.setTextColor(60, 60, 60);
      docPdf.text(`Total Time: ${formatDuration(totals.totalMinutes)}`, 20, 55);
      docPdf.text(`Target: ${TARGET_HOURS} hours`, 80, 55);
      docPdf.text(`Remaining: ${totals.remainingHours.toFixed(2)} hours`, 140, 55);

      // Progress bar (print-friendly)
      docPdf.setDrawColor(180, 180, 180);
      docPdf.setFillColor(230, 230, 230);
      docPdf.rect(20, 60, 160, 6, "F");

      docPdf.setFillColor(80, 80, 80);
      const progressWidth = (160 * totals.progressPercentage) / 100;
      docPdf.rect(20, 60, progressWidth, 6, "F");

      docPdf.setFontSize(9);
      docPdf.setTextColor(0, 0, 0);
      docPdf.text(`${totals.progressPercentage.toFixed(1)}%`, 184, 65);

      // Week Summary Table
      let y = 72;
      const sessionDates = reportSessions
        .map((session) => session.timeInDate)
        .filter(Boolean)
        .sort((a, b) => a - b);
      const weekStart = reportRange?.start || (sessionDates.length > 0 ? sessionDates[0] : now);
      const weekEnd = reportRange?.end || (sessionDates.length > 0 ? sessionDates[sessionDates.length - 1] : now);

      docPdf.setFontSize(11);
      docPdf.setTextColor(0, 0, 0);
      docPdf.text("Week Summary", 14, y);
      y += 6;

      const weekTableLeft = 14;
      const weekTableWidth = 182;
      const weekRowHeight = 8;
      const weekColWidths = [120, 62];
      const weekColX = [weekTableLeft, weekTableLeft + weekColWidths[0]];

      docPdf.setFillColor(230, 230, 230);
      docPdf.rect(weekTableLeft, y, weekTableWidth, weekRowHeight, "F");
      docPdf.setFont("helvetica", "bold");
      docPdf.setFontSize(9);
      docPdf.setTextColor(0, 0, 0);
      docPdf.text("Week Range", weekColX[0] + 4, y + 5.5);
      docPdf.text("Total Hours", weekColX[1] + 4, y + 5.5);
      y += weekRowHeight;

      docPdf.setFont("helvetica", "normal");
      docPdf.setFontSize(9);
      docPdf.setDrawColor(200, 200, 200);
      docPdf.rect(weekTableLeft, y, weekTableWidth, weekRowHeight);
      docPdf.setTextColor(40, 40, 40);
      docPdf.text(`${formatDate(weekStart)} – ${formatDate(weekEnd)}`, weekColX[0] + 4, y + 5.5);
      docPdf.text(formatHours(totals.totalHours), weekColX[1] + 4, y + 5.5);
      y += weekRowHeight + 8;

      // Weekly Report Section
      docPdf.setFontSize(12);
      docPdf.setTextColor(0, 0, 0);
      docPdf.text("Weekly Reflection", 14, y);
      y += 8;

      docPdf.setFontSize(10);
      docPdf.setTextColor(50, 50, 50);
      const reportText = weeklyReport.trim() || "No weekly report provided.";
      const reportLines = docPdf.splitTextToSize(reportText, 180);

      docPdf.setDrawColor(200, 200, 200);
      docPdf.setFillColor(255, 255, 255);
      docPdf.roundedRect(14, y - 4, 182, reportLines.length * 6 + 8, 2, 2, "FD");
      docPdf.text(reportLines, 18, y + 2);

      y += reportLines.length * 6 + 16;

      // Days Table (with reflection)
      docPdf.setFontSize(12);
      docPdf.setTextColor(0, 0, 0);
      docPdf.text("Days Summary", 14, y);
      y += 8;

      const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
      const dayTotals = {};
      reportSessions.forEach((session) => {
        if (!session.timeInRoundedDate || !session.timeOutRoundedDate) return;
        const dayIndex = session.timeInRoundedDate.getDay();
        const name = dayNames[(dayIndex + 6) % 7];
        const duration = diffMinutes(session.timeInRoundedDate, session.timeOutRoundedDate);
        dayTotals[name] = (dayTotals[name] || 0) + duration;
      });

      const daysTableLeft = 14;
      const daysTableWidth = 182;
      const daysRowHeight = 8;
      const dayColWidths = [50, 32, 100];
      const dayColX = [
        daysTableLeft,
        daysTableLeft + dayColWidths[0],
        daysTableLeft + dayColWidths[0] + dayColWidths[1],
      ];

      docPdf.setFillColor(230, 230, 230);
      docPdf.rect(daysTableLeft, y, daysTableWidth, daysRowHeight, "F");
      docPdf.setFont("helvetica", "bold");
      docPdf.setFontSize(9);
      docPdf.setTextColor(0, 0, 0);
      docPdf.text("Day", dayColX[0] + 4, y + 5.5);
      docPdf.text("Total Hours", dayColX[1] + 4, y + 5.5);
      docPdf.text("Reflection", dayColX[2] + 4, y + 5.5);
      y += daysRowHeight;

      docPdf.setFont("helvetica", "normal");
      docPdf.setFontSize(9);
      const dailyReflectionText =
        weeklyReport.trim() || "No daily reflection provided.";

      dayNames.forEach((day) => {
        if (y > 270) {
          docPdf.addPage();
          y = 20;
        }
        const minutes = dayTotals[day] || 0;
        const reflectionLines = docPdf.splitTextToSize(
          dailyReflectionText,
          dayColWidths[2] - 8
        );
        const rowHeight = Math.max(daysRowHeight, reflectionLines.length * 5);
        docPdf.setDrawColor(200, 200, 200);
        docPdf.rect(daysTableLeft, y, daysTableWidth, rowHeight);
        docPdf.setTextColor(40, 40, 40);
        docPdf.text(day, dayColX[0] + 4, y + 5.5);
        docPdf.text(formatHours(minutesToHours(minutes)), dayColX[1] + 4, y + 5.5);
        docPdf.text(reflectionLines, dayColX[2] + 4, y + 5.5);
        y += rowHeight;
      });

      y += 10;

      // Sessions Table
      docPdf.setFontSize(12);
      docPdf.setTextColor(0, 0, 0);
      docPdf.text("Time Sessions", 14, y);
      y += 8;

      const sessionsForPdf = [...reportSessions].reverse();
      if (sessionsForPdf.length === 0) {
        docPdf.setFontSize(10);
        docPdf.setTextColor(100, 116, 139);
        docPdf.text("No sessions recorded this week.", 14, y);
      } else {
        const tableLeft = 14;
        const tableWidth = 182;
        const rowHeight = 10;
        const colWidths = [50, 35, 35, 40, 22];
        const colX = [
          tableLeft,
          tableLeft + colWidths[0],
          tableLeft + colWidths[0] + colWidths[1],
          tableLeft + colWidths[0] + colWidths[1] + colWidths[2],
          tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3],
        ];

        // Table Header
        docPdf.setFillColor(230, 230, 230);
        docPdf.roundedRect(tableLeft, y, tableWidth, rowHeight, 2, 2, "F");

        docPdf.setFont("helvetica", "bold");
        docPdf.setFontSize(9);
        docPdf.setTextColor(0, 0, 0);
        docPdf.text("Date", colX[0] + 4, y + 6.5);
        docPdf.text("In", colX[1] + 4, y + 6.5);
        docPdf.text("Out", colX[2] + 4, y + 6.5);
        docPdf.text("Duration", colX[3] + 4, y + 6.5);
        docPdf.text("Status", colX[4] + 4, y + 6.5);
        y += rowHeight;

        // Table Rows
        docPdf.setFont("helvetica", "normal");
        docPdf.setFontSize(8.5);
        
        sessionsForPdf.forEach((session, index) => {
          if (y > 270) {
            docPdf.addPage();
            y = 20;
          }

          const durationMinutes =
            session.timeOutRoundedDate && session.timeInRoundedDate
              ? diffMinutes(session.timeInRoundedDate, session.timeOutRoundedDate)
              : 0;
          const durationLabel =
            session.timeOutRoundedDate && session.timeInRoundedDate
              ? formatHours(minutesToHours(durationMinutes))
              : "Active";
          
          const isActive = !session.timeOutRoundedDate;
          
          // Alternating row colors
          docPdf.setFillColor(index % 2 === 0 ? 255 : 245, 245, 245);
          docPdf.rect(tableLeft, y, tableWidth, rowHeight, "F");
          docPdf.setDrawColor(200, 200, 200);
          docPdf.rect(tableLeft, y, tableWidth, rowHeight);

          docPdf.setTextColor(20, 20, 20);
          docPdf.text(formatDate(session.timeInDate), colX[0] + 4, y + 6.5);
          docPdf.text(formatTime(session.timeInRoundedDate), colX[1] + 4, y + 6.5);
          docPdf.text(session.timeOutRoundedDate ? formatTime(session.timeOutRoundedDate) : "—", colX[2] + 4, y + 6.5);
          docPdf.text(durationLabel, colX[3] + 4, y + 6.5);
          
          // Status indicator
          docPdf.setFillColor(isActive ? 50 : 80, 80, 80);
          docPdf.circle(colX[4] + 11, y + 6.5, 2, "F");
          docPdf.setTextColor(20, 20, 20);
          docPdf.text(isActive ? "Live" : "Done", colX[4] + 4, y + 6.5);

          y += rowHeight;
        });
      }

      // Footer
      docPdf.setFontSize(8);
      docPdf.setTextColor(100, 100, 100);
      docPdf.text("Generated with TimeTracker", 105, 285, { align: "center" });
      docPdf.text(`User: ${user?.email || "Anonymous"}`, 105, 290, { align: "center" });

      setTimeout(() => {
        setExportProgress(100);
        setTimeout(() => {
          docPdf.save(`weekly-report-${formatDate(now).replace(/\//g, '-')}.pdf`);
          setIsGenerating(false);
          setExportProgress(0);
        }, 300);
      }, 500);

    } catch (err) {
      console.error("PDF generation failed:", err);
      setIsGenerating(false);
      setExportProgress(0);
    }
  };

  const handleSampleReport = () => {
    const sample = `This week I focused on:
• Completing project milestones ahead of schedule
• Collaborating with the design team on new features
• Optimizing performance in key user flows
• Participating in team knowledge sharing sessions

Key achievements:
✅ Delivered feature ahead of deadline
✅ Improved app performance by 15%
✅ Mentored 2 junior developers

Next week priorities:
• Implement new authentication flow
• Conduct user testing sessions
• Refactor legacy components`;
    setWeeklyReport(sample);
    textareaRef.current?.focus();
  };

  const handleClearReport = () => {
    setWeeklyReport("");
  };

  const handleRequestRestore = (session) => {
    if (!session) return;
    setRestoreModalSession(session);
  };

  const handleCloseRestoreModal = () => {
    if (restoringSessionId) return;
    setRestoreModalSession(null);
  };

  const handleConfirmRestore = async () => {
    if (!user || !restoreModalSession?.id) return;
    const sessionId = restoreModalSession.id;
    setRestoringSessionId(sessionId);
    const sessionRef = doc(db, "users", user.uid, "sessions", sessionId);
    try {
      await updateDoc(sessionRef, {
        archivedAt: restoreModalSession.archivedAt || Date.now(),
      });
      navigate("/archive");
    } catch (restoreError) {
      console.error("Failed to restore session:", restoreError);
    } finally {
      setRestoringSessionId(null);
      setRestoreModalSession(null);
    }
  };

  const toggleSelectReport = (sessionId) => {
    setSelectedReportIds((prev) =>
      prev.includes(sessionId)
        ? prev.filter((id) => id !== sessionId)
        : [...prev, sessionId]
    );
  };

  const toggleSelectAllReport = () => {
    if (visibleReportSessions.length === 0) {
      setSelectedReportIds([]);
      return;
    }
    if (selectedReportIds.length === visibleReportSessions.length) {
      setSelectedReportIds([]);
      return;
    }
    setSelectedReportIds(visibleReportSessions.map((session) => session.id));
  };

  const handleRestoreSelected = async () => {
    if (!user || selectedReportIds.length === 0) return;
    try {
      await Promise.all(
        selectedReportIds.map((sessionId) =>
          updateDoc(doc(db, "users", user.uid, "sessions", sessionId), {
            archivedAt: Date.now(),
          })
        )
      );
      setSelectedReportIds([]);
      navigate("/archive");
    } catch (restoreError) {
      console.error("Failed to restore selected sessions:", restoreError);
    }
  };

  const handleRequestBulkRestore = () => {
    if (selectedReportIds.length === 0) return;
    setBulkRestoreModalOpen(true);
  };

  const handleCloseBulkRestore = () => {
    if (restoringSessionId) return;
    setBulkRestoreModalOpen(false);
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-6 w-2 rounded-full bg-indigo-600"></div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">
              Weekly Insights
            </p>
          </div>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">
            Performance Report
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
          <span className="text-xs text-slate-500">Live tracking</span>
        </div>
      </div>

      {reportRange && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
          Exporting archived week: {formatDate(reportRange.start)} – {formatDate(reportRange.end)}
        </div>
      )}

      {!isFromArchive && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
          <p className="mb-2 text-sm text-slate-600">
            You can still write your weekly reflection even without an exported
            week. Export a week from the Archive to enable the report preview and
            PDF export.
          </p>
        </div>
      )}

      {/* Stats Cards */}
      {isFromArchive && (
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
          <div className="absolute right-0 top-0 h-16 w-16 rounded-bl-full bg-indigo-100"></div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
            Total Time
          </p>
          <p className="mb-2 text-2xl font-bold text-slate-900">
            {formatDuration(totals.totalMinutes)}
          </p>
          <div className="h-2 w-full rounded-full bg-slate-200">
            <div 
              className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-sky-500 transition-all duration-1000 ease-out"
              style={{ width: `${Math.min((totals.totalHours / TARGET_HOURS) * 100, 100)}%` }}
            ></div>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {totals.totalHours.toFixed(1)} of {TARGET_HOURS} hours
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
          <div className="absolute right-0 top-0 h-16 w-16 rounded-bl-full bg-green-100"></div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-green-600">
            Remaining
          </p>
          <p className="mb-2 text-2xl font-bold text-slate-900">
            {formatHours(totals.remainingHours)}
          </p>
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 rounded-full bg-slate-200">
              <div 
                className="h-2 rounded-full bg-gradient-to-r from-indigo-400 to-sky-500 transition-all duration-1000 ease-out"
                style={{ width: `${100 - (totals.remainingHours / TARGET_HOURS) * 100}%` }}
              ></div>
            </div>
            <span className="text-xs font-semibold text-green-600">
              {totals.progressPercentage.toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
          <div className="absolute right-0 top-0 h-16 w-16 rounded-bl-full bg-slate-100"></div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Last Updated
          </p>
          <p className="mb-1 text-lg font-bold text-slate-900">{formatDateTime(now)}</p>
          <div className="mt-3 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <p className="text-xs text-slate-500">
              {normalizedSessions.length} sessions this week
            </p>
          </div>
        </div>
      </div>
      )}

      {/* Tab Navigation */}
      {isFromArchive && (
        <div className="mb-6 flex gap-2">
        <button
          onClick={() => setActiveTab("report")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ${
            activeTab === "report"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          📝 Write Report
        </button>
        <button
          onClick={() => setActiveTab("preview")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ${
            activeTab === "preview"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          👁️ Preview
        </button>
      </div>
      )}

      {/* Content Area */}
      {(!isFromArchive || activeTab === "report") ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Write your weekly reflection. This will be included in your PDF report.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleSampleReport}
                className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition-colors duration-200 hover:bg-indigo-100"
              >
                Use Template
              </button>
              <button
                onClick={handleClearReport}
                className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors duration-200 hover:bg-slate-200"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="relative">
            <textarea
              ref={textareaRef}
              value={weeklyReport}
              onChange={(event) => setWeeklyReport(event.target.value)}
              className="mt-4 h-64 w-full resize-none rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-500 placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 focus:outline-none transition-all duration-300"
            />
            <div className="absolute bottom-3 right-3 text-xs text-slate-400">
              {charCount}/2000 characters
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">Preview</h3>
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h4 className="mb-2 font-semibold text-slate-900">Report Summary</h4>
              <p className="text-sm text-slate-600">
                {weeklyReport || "Your report will appear here..."}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h4 className="mb-2 font-semibold text-slate-900">Statistics</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-500">Total Sessions</p>
                  <p className="text-lg font-bold text-slate-900">{reportSessions.length}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Progress</p>
                  <p className="text-lg font-bold text-slate-900">{totals.progressPercentage.toFixed(1)}%</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h4 className="font-semibold text-slate-900">Session Dates & Times</h4>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={
                        visibleReportSessions.length > 0 &&
                        selectedReportIds.length === visibleReportSessions.length
                      }
                      onChange={toggleSelectAllReport}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
                    />
                    Select all
                  </label>
                  <button
                    type="button"
                    onClick={handleRequestBulkRestore}
                    disabled={selectedReportIds.length === 0}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Restore selected
                  </button>
                </div>
              </div>
              {reportSessions.length === 0 ? (
                <p className="text-sm text-slate-500">No sessions available for this range.</p>
              ) : (
                <div className="space-y-2 text-sm text-slate-600">
                  {visibleReportSessions.map((session) => (
                    <div key={session.id} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedReportIds.includes(session.id)}
                          onChange={() => toggleSelectReport(session.id)}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
                        />
                        <span>{formatDate(session.timeInDate)}</span>
                        <span>
                          {formatTime(session.timeInRoundedDate)} –{" "}
                          {session.timeOutRoundedDate ? formatTime(session.timeOutRoundedDate) : "Live"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRequestRestore(session)}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-500 transition-colors hover:border-indigo-200 hover:text-indigo-600"
                      >
                        Restore to Archive
                      </button>
                    </div>
                  ))}
                  {reportSessions.length > 5 && (
                    <div className="text-xs text-slate-400">
                      +{reportSessions.length - 5} more sessions
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Export Button with Progress */}
      <div className="mt-8 space-y-4">
        <button
          type="button"
          onClick={handleExportPdf}
          disabled={isGenerating || !isFromArchive}
          className="relative w-full rounded-2xl bg-indigo-600 px-6 py-4 text-sm font-semibold text-white uppercase tracking-[0.15em] shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <div className="relative z-10 flex items-center justify-center gap-2">
            {isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Generating PDF... {exportProgress}%</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Export Weekly Report</span>
              </>
            )}
          </div>
          
          {isGenerating && (
            <div 
              className="absolute inset-0 bg-gradient-to-r from-indigo-700 to-sky-700 transition-all duration-300 ease-out"
              style={{ width: `${exportProgress}%` }}
            ></div>
          )}
          
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-700 to-sky-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        </button>

        {/* Status Info */}
        <div className={`rounded-2xl px-4 py-3 text-xs transition-all duration-300 ${
          loading ? "bg-green-50 text-green-600" :
          error ? "bg-red-50 text-red-600" :
          "bg-gradient-to-r from-slate-50 to-white border-4 border-slate-200 text-slate-600"
        }`}>
          <div className="flex items-center gap-2">
            {loading && (
              <>
                <div className="w-3 h-3 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                <span>Loading sessions data...</span>
              </>
            )}
            {!loading && error && (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
              </>
            )}
            {!loading && !error && (
              <>
                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Ready to export • Includes {normalizedSessions.length} sessions • PDF will feature modern design</span>
              </>
            )}
          </div>
        </div>
      </div>

      {restoreModalSession && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4"
          onClick={handleCloseRestoreModal}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-0 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-900">Restore to Archive?</h3>
              <p className="mt-2 text-sm text-slate-500">
                This will restore the session to your Archive list.
              </p>
            </div>
            <div className="p-6">
              <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                <div className="font-semibold text-slate-900">
                  {formatDate(restoreModalSession.timeInDate)}
                </div>
                <div>
                  {formatTime(restoreModalSession.timeInRoundedDate)} –{" "}
                  {restoreModalSession.timeOutRoundedDate
                    ? formatTime(restoreModalSession.timeOutRoundedDate)
                    : "Live"}
                </div>
              </div>
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseRestoreModal}
                  disabled={!!restoringSessionId}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-600 transition-all hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRestore}
                  disabled={!!restoringSessionId}
                  className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-indigo-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {restoringSessionId ? "Restoring..." : "Restore to Archive"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {bulkRestoreModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={handleCloseBulkRestore}
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
                  <h3 className="text-lg font-bold text-slate-900">Restore Selected Sessions?</h3>
                  <p className="mt-2 text-sm text-slate-500">
                    You are about to restore{" "}
                    <span className="font-semibold text-indigo-600">
                      {selectedReportIds.length}
                    </span>{" "}
                    session{selectedReportIds.length === 1 ? "" : "s"} to your Archive.
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-4 text-sm text-indigo-700">
                This action will move the selected sessions back to the Archive list.
              </div>
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseBulkRestore}
                  disabled={restoringSessionId}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-600 transition-all hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRestoreSelected}
                  disabled={restoringSessionId}
                  className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-indigo-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {restoringSessionId ? "Restoring..." : "Restore Sessions"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}