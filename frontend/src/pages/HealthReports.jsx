import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Heart,
  LoaderCircle,
  Pill,
  RefreshCw,
  Salad,
  ShieldCheck,
  Stethoscope,
  UserRound,
  AlertCircle,
  ClipboardList,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

// --- PROFESSIONAL HEALTHCARE DESIGN SYSTEM (PARROT-GREEN / MINT THEME) ---
const THEME = {
  bg: "#F7F9F4",                // Warm off-white background
  surface: "#FFFFFF",           // Clean white card surface
  surfaceTint: "#FAFBF7",       // Subtle tinted surface
  border: "#E2E8DE",            // Crisp, restrained border
  textDark: "#29352C",          // Main readable text
  textMuted: "#6E786D",         // Secondary helper text

  // Primary Parrot Green & Deep Natural Green Brand Identity
  primary: "#39764A",           // Deep natural green for main actions/headings
  primaryLight: "#EAF5E4",      // Soft mint container background
  primaryBorder: "#CDE2C5",     // Soft mint border
  parrot: "#8BCF65",            // Primary parrot green accent

  // Restrained Category Accents (Used sparingly & purposefully)
  medication: {
    accent: "#39764A",
    bg: "#EAF5E4",
    border: "#CDE2C5",
  },
  vitals: {
    accent: "#D66860",          // Refined soft coral
    bg: "#FCF1F0",
    border: "#F5D1CE",
  },
  nutrition: {
    accent: "#D97736",          // Refined warm peach/amber
    bg: "#FEF4EC",
    border: "#FAD8C7",
  },
  medical: {
    accent: "#7C529E",          // Refined muted lavender
    bg: "#F4EFFF",
    border: "#E2D3F5",
  },
  appointments: {
    accent: "#2E6988",          // Calm supportive blue-gray
    bg: "#EFF5F9",
    border: "#D1E2EE",
  }
};

function getStoredUser() {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function formatDate(value) {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }
  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value) {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }
  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function displayValue(value, suffix = "") {
  if (value === null || value === undefined || value === "") {
    return "Not recorded";
  }
  return `${value}${suffix}`;
}

function Section({
  title,
  description,
  icon: Icon,
  accent = THEME.primary,
  bg = THEME.primaryLight,
  border = THEME.primaryBorder,
  children,
  count,
}) {
  return (
    <section
      className="overflow-hidden rounded-3xl border bg-white shadow-2xs transition-all duration-300 hover:shadow-xs"
      style={{ borderColor: THEME.border }}
    >
      <div
        className="flex flex-wrap items-center justify-between gap-4 border-b px-6 py-5 sm:px-7"
        style={{
          borderColor: THEME.border,
          backgroundColor: bg,
        }}
      >
        <div className="flex items-center gap-4">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl shadow-2xs transition-transform duration-200"
            style={{
              backgroundColor: THEME.surface,
              color: accent,
              border: `1.5px solid ${border}`,
            }}
          >
            <Icon size={22} strokeWidth={2.2} />
          </div>

          <div>
            <h2
              className="text-lg font-bold tracking-tight sm:text-xl"
              style={{ color: THEME.textDark }}
            >
              {title}
            </h2>
            {description && (
              <p
                className="mt-0.5 text-xs font-medium sm:text-sm"
                style={{ color: THEME.textMuted }}
              >
                {description}
              </p>
            )}
          </div>
        </div>

        {count !== undefined && (
          <span
            className="rounded-full px-4 py-1.5 text-xs font-bold shadow-2xs"
            style={{
              backgroundColor: THEME.surface,
              color: accent,
              border: `1.5px solid ${border}`,
            }}
          >
            {count} {count === 1 ? "record" : "records"}
          </span>
        )}
      </div>

      <div className="p-6 sm:p-7">{children}</div>
    </section>
  );
}

function EmptyState({ message = "No records available for this period." }) {
  return (
    <div
      className="rounded-2xl border border-dashed px-6 py-10 text-center text-sm"
      style={{
        borderColor: THEME.border,
        color: THEME.textMuted,
        backgroundColor: THEME.surfaceTint,
      }}
    >
      <div
        className="mx-auto mb-3.5 flex h-14 w-14 items-center justify-center rounded-2xl shadow-2xs"
        style={{
          backgroundColor: THEME.primaryLight,
          color: THEME.primary,
          border: `1.5px solid ${THEME.primaryBorder}`,
        }}
      >
        <FileText size={24} strokeWidth={2} />
      </div>
      <p style={{ color: THEME.textDark, fontWeight: 600, fontSize: "0.95rem" }}>{message}</p>
    </div>
  );
}

function DataTable({ columns, rows, emptyMessage, accent = THEME.primary, bg = THEME.primaryLight }) {
  if (!rows || rows.length === 0) {
    return <EmptyState message={emptyMessage} />;
  }

  return (
    <div
      className="overflow-x-auto rounded-2xl border shadow-2xs"
      style={{ borderColor: THEME.border }}
    >
      <table className="w-full min-w-max text-left text-sm">
        <thead style={{ backgroundColor: bg }}>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className="whitespace-nowrap px-5 py-4 text-xs font-bold uppercase tracking-wider"
                style={{ color: accent }}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y" style={{ borderColor: THEME.border }}>
          {rows.map((row, index) => (
            <tr
              key={row.id ?? `${row.recorded_at ?? row.date ?? "record"}-${index}`}
              className="transition-colors hover:bg-slate-50/70"
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className="max-w-xs px-5 py-4 align-middle text-sm font-medium"
                  style={{ color: THEME.textDark }}
                >
                  {column.render
                    ? column.render(row[column.key], row)
                    : displayValue(row[column.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }) {
  const value = String(status || "UNKNOWN").toUpperCase();

  let background = "#F1F5F9";
  let foreground = "#475569";
  let border = "#CBD5E1";

  if (value === "TAKEN" || value === "COMPLETED") {
    background = THEME.medication.bg;
    foreground = THEME.medication.accent;
    border = THEME.medication.border;
  } else if (value === "MISSED" || value === "CANCELLED") {
    background = THEME.vitals.bg;
    foreground = THEME.vitals.accent;
    border = THEME.vitals.border;
  } else if (value === "CONFIRMED") {
    background = THEME.primaryLight;
    foreground = THEME.primary;
    border = THEME.primaryBorder;
  } else if (value === "PENDING" || value === "SKIPPED") {
    background = THEME.nutrition.bg;
    foreground = THEME.nutrition.accent;
    border = THEME.nutrition.border;
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold tracking-wide shadow-2xs"
      style={{ background, color: foreground, borderColor: border }}
    >
      {value}
    </span>
  );
}

function SummaryCard({ title, value, subtitle, icon: Icon, accent = THEME.primary, bg = THEME.primaryLight, border = THEME.primaryBorder }) {
  return (
    <div
      className="relative overflow-hidden rounded-3xl border bg-white p-6 shadow-2xs transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xs sm:p-7"
      style={{ borderColor: THEME.border }}
    >
      <div
        className="absolute left-0 top-0 h-full w-2 rounded-r-full"
        style={{ backgroundColor: accent }}
      />

      <div className="flex items-start justify-between gap-4 pl-2">
        <div className="min-w-0">
          <p
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: THEME.textMuted }}
          >
            {title}
          </p>

          <p
            className="mt-3 break-words text-3xl font-extrabold tracking-tight sm:text-4xl"
            style={{ color: THEME.textDark }}
          >
            {value}
          </p>

          <p className="mt-2 text-xs font-medium" style={{ color: THEME.textMuted }}>
            {subtitle}
          </p>
        </div>

        <div
          className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl shadow-2xs"
          style={{
            backgroundColor: bg,
            color: accent,
            border: `1.5px solid ${border}`,
          }}
        >
          <Icon size={24} strokeWidth={2.2} />
        </div>
      </div>
    </div>
  );
}

export default function HealthReports() {
  const navigate = useNavigate();

  const [user] = useState(getStoredUser);
  const role = String(user?.role || "").toUpperCase();

  const [period, setPeriod] = useState("7");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [elderId, setElderId] = useState("");

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const needsElderId = role === "CAREGIVER" || role === "DOCTOR";

  const getParams = useCallback(() => {
    const params = { period };

    if (period === "custom") {
      params.start_date = startDate;
      params.end_date = endDate;
    }

    if (needsElderId && elderId.trim()) {
      params.elder_id = elderId.trim();
    }

    return params;
  }, [period, startDate, endDate, needsElderId, elderId]);

  const validateFilters = useCallback(() => {
    if (needsElderId && !elderId.trim()) {
      return "Please enter the ID of an elder linked to your account.";
    }

    if (period === "custom") {
      if (!startDate || !endDate) {
        return "Please select both the start date and the end date.";
      }

      if (startDate > endDate) {
        return "Start date must not be after the end date.";
      }

      if (
        (new Date(`${endDate}T00:00:00`) -
          new Date(`${startDate}T00:00:00`)) /
          86400000 >
        366
      ) {
        return "Please select a date range of 366 days or less.";
      }
    }

    return "";
  }, [needsElderId, elderId, period, startDate, endDate]);

  const loadReport = useCallback(async () => {
    const validationError = validateFilters();

    if (validationError) {
      setError(validationError);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    setNotice("");

    try {
      const response = await api.get("/health-reports", {
        params: getParams(),
      });

      setReport(response.data);
    } catch (err) {
      setReport(null);

      const status = err?.response?.status;
      const message =
        err?.response?.data?.error ||
        "Unable to load the health report. Please check your network or backend service.";

      if (
        needsElderId &&
        (status === 403 || status === 404) &&
        /linked|access|patient|elder/i.test(message)
      ) {
        setError(
          `${message} If this account has no linked elders yet, please link an elder before requesting their report.`
        );
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [validateFilters, getParams, needsElderId]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  async function downloadPDF() {
    const validationError = validateFilters();

    if (validationError) {
      setError(validationError);
      return;
    }

    setDownloading(true);
    setError("");
    setNotice("");

    try {
      const response = await api.get("/health-reports/pdf", {
        params: getParams(),
        responseType: "blob",
      });

      const blob = new Blob([response.data], {
        type: "application/pdf",
      });

      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = downloadUrl;

      const reportDate = new Date().toISOString().slice(0, 10);
      link.download = `elder-sense-health-report-${reportDate}.pdf`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(downloadUrl);

      setNotice("Your health report PDF has been downloaded successfully.");
    } catch (err) {
      let message =
        err?.response?.data?.error ||
        "Could not download the PDF. Please try again.";

      if (err?.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text);
          message = parsed.error || message;
        } catch {
          // Keep fallback message
        }
      }

      setError(message);
    } finally {
      setDownloading(false);
    }
  }

  const profile = report?.profile;
  const medications = report?.medications;
  const vitals = report?.vitals;
  const nutrition = report?.nutrition;
  const medical = report?.medical_history;
  const appointments = report?.appointments;

  const totalMedicationLogs = medications?.logged_doses ?? 0;

  const adherenceValue =
    medications?.adherence_percentage === null ||
    medications?.adherence_percentage === undefined
      ? "—"
      : `${medications.adherence_percentage}%`;

  const adherenceDescription =
    totalMedicationLogs === 0
      ? "No logged doses in this period"
      : `${medications.taken} taken out of ${totalMedicationLogs} logged doses`;

  const vitalColumns = [
    {
      key: "recorded_at",
      label: "Recorded",
      render: (value) => formatDateTime(value),
    },
    { key: "blood_pressure", label: "Blood Pressure" },
    {
      key: "heart_rate",
      label: "Heart Rate",
      render: (value) => displayValue(value, value != null ? " BPM" : ""),
    },
    {
      key: "blood_sugar",
      label: "Blood Sugar",
      render: (value) => displayValue(value),
    },
    {
      key: "temperature",
      label: "Temperature",
      render: (value) => displayValue(value, value != null ? " °C" : ""),
    },
    {
      key: "oxygen_level",
      label: "Oxygen",
      render: (value) => displayValue(value, value != null ? "%" : ""),
    },
    {
      key: "weight",
      label: "Weight",
      render: (value) => displayValue(value, value != null ? " kg" : ""),
    },
  ];

  const medicationColumns = [
    {
      key: "scheduled_at",
      label: "Scheduled",
      render: (value) => formatDateTime(value),
    },
    { key: "medication", label: "Medication" },
    { key: "dosage", label: "Dosage" },
    {
      key: "status",
      label: "Status",
      render: (value) => <StatusBadge status={value} />,
    },
    {
      key: "missed_reason",
      label: "Notes / Reason",
      render: (value, row) => value || row.notes || "—",
    },
  ];

  const nutritionColumns = [
    {
      key: "recorded_at",
      label: "Recorded",
      render: (value) => formatDateTime(value),
    },
    { key: "meal_type", label: "Meal" },
    { key: "food_items", label: "Food Items" },
    {
      key: "calories",
      label: "Calories",
      render: (value) => displayValue(value, value != null ? " kcal" : ""),
    },
    {
      key: "protein",
      label: "Protein",
      render: (value) => displayValue(value, value != null ? " g" : ""),
    },
    {
      key: "carbohydrates",
      label: "Carbs",
      render: (value) => displayValue(value, value != null ? " g" : ""),
    },
    {
      key: "fats",
      label: "Fats",
      render: (value) => displayValue(value, value != null ? " g" : ""),
    },
  ];

  const symptomColumns = [
    {
      key: "recorded_at",
      label: "Recorded",
      render: (value) => formatDateTime(value),
    },
    { key: "symptom", label: "Symptom" },
    { key: "severity", label: "Severity" },
    { key: "notes", label: "Notes" },
  ];

  const assessmentColumns = [
    {
      key: "created_at",
      label: "Date",
      render: (value) => formatDateTime(value),
    },
    { key: "risk_level", label: "Risk Level" },
    { key: "risk_score", label: "Risk Score" },
    { key: "prediction", label: "Assessment" },
    { key: "recommendations", label: "Recommendations" },
  ];

  const prescriptionColumns = [
    {
      key: "prescription_date",
      label: "Date",
      render: (value) => formatDate(value),
    },
    { key: "doctor", label: "Doctor" },
    { key: "notes", label: "Notes" },
  ];

  const appointmentColumns = [
    {
      key: "date",
      label: "Date",
      render: (value) => formatDate(value),
    },
    { key: "time", label: "Time" },
    {
      key: "status",
      label: "Status",
      render: (value) => <StatusBadge status={value} />,
    },
    { key: "doctor", label: "Doctor" },
    { key: "hospital", label: "Hospital" },
    { key: "reason", label: "Reason" },
  ];

  return (
    <div
      className="min-h-screen font-sans"
      style={{ backgroundColor: THEME.bg, color: THEME.textDark }}
    >
      {/* Top Navigation */}
      <header
        className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur-md shadow-2xs"
        style={{ borderColor: THEME.border }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border transition-all duration-200 hover:bg-slate-50 active:scale-95 shadow-2xs cursor-pointer"
              style={{
                borderColor: THEME.border,
                color: THEME.primary,
                backgroundColor: THEME.surface,
              }}
              aria-label="Go back"
            >
              <ArrowLeft size={20} strokeWidth={2.2} />
            </button>

            <div>
              <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl" style={{ color: THEME.textDark }}>
                Health Reports
              </h1>
              <p className="text-xs font-medium sm:text-sm" style={{ color: THEME.textMuted }}>
                Elder Sense Smart Elderly Care System
              </p>
            </div>
          </div>

          <div
            className="hidden items-center gap-2.5 rounded-full border px-4 py-2 text-xs font-bold shadow-2xs sm:flex"
            style={{
              backgroundColor: THEME.primaryLight,
              color: THEME.primary,
              borderColor: THEME.primaryBorder,
            }}
          >
            <ShieldCheck size={16} strokeWidth={2.2} />
            Verified Secure Records
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Hero Header Banner */}
        <div
          className="relative overflow-hidden rounded-3xl border p-6 shadow-xs sm:p-8"
          style={{
            background: "linear-gradient(135deg, #EAF5E4 0%, #FFFFFF 65%, #F4F8F1 100%)",
            borderColor: THEME.primaryBorder,
          }}
        >
          <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div className="max-w-2xl">
              <div
                className="mb-3.5 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-bold shadow-2xs"
                style={{
                  backgroundColor: THEME.surface,
                  color: THEME.primary,
                  borderColor: THEME.primaryBorder,
                }}
              >
                <ClipboardList size={16} strokeWidth={2.2} />
                Clinical Summary & Telemetry
              </div>

              <h2
                className="text-2xl font-black tracking-tight sm:text-3xl"
                style={{ color: THEME.textDark }}
              >
                Comprehensive Health Overview
              </h2>

              <p
                className="mt-2.5 text-sm font-medium leading-relaxed sm:text-base"
                style={{ color: THEME.textMuted }}
              >
                Review medication adherence, biometric vitals, daily nutrition, and appointments in a clear, reassuring format. Download or share official PDF reports instantly.
              </p>
            </div>

            <button
              type="button"
              onClick={downloadPDF}
              disabled={downloading || loading}
              className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2.5 rounded-2xl px-6 py-3.5 text-sm font-bold text-white shadow-sm transition-all duration-200 hover:brightness-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
              style={{
                backgroundColor: THEME.primary,
                boxShadow: "0 6px 16px rgba(57, 118, 74, 0.22)",
              }}
            >
              {downloading ? (
                <LoaderCircle className="animate-spin" size={20} />
              ) : (
                <Download size={20} strokeWidth={2.2} />
              )}
              {downloading ? "Preparing PDF..." : "Download Official PDF"}
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <section
          className="rounded-3xl border bg-white p-6 shadow-xs sm:p-7"
          style={{ borderColor: THEME.border }}
        >
          <div className="mb-4 flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-2xl shadow-2xs"
              style={{
                backgroundColor: THEME.primaryLight,
                color: THEME.primary,
                border: `1.5px solid ${THEME.primaryBorder}`,
              }}
            >
              <CalendarDays size={20} strokeWidth={2.2} />
            </div>
            <h2 className="text-base font-bold sm:text-lg" style={{ color: THEME.textDark }}>
              Report Filters & Date Range
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs font-bold uppercase tracking-wider" style={{ color: THEME.textMuted }}>
              Select Period
              <select
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
                className="mt-2 min-h-12 w-full rounded-2xl border bg-white px-4 text-sm font-medium outline-none transition-all focus:ring-2 focus:ring-green-600 shadow-2xs cursor-pointer"
                style={{
                  borderColor: THEME.border,
                  color: THEME.textDark,
                }}
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="custom">Custom date range</option>
              </select>
            </label>

            {period === "custom" && (
              <>
                <label className="text-xs font-bold uppercase tracking-wider" style={{ color: THEME.textMuted }}>
                  Start Date
                  <input
                    type="date"
                    value={startDate}
                    max={endDate || undefined}
                    onChange={(event) => setStartDate(event.target.value)}
                    className="mt-2 min-h-12 w-full rounded-2xl border bg-white px-4 text-sm font-medium outline-none focus:ring-2 focus:ring-green-600 shadow-2xs"
                    style={{ borderColor: THEME.border, color: THEME.textDark }}
                  />
                </label>

                <label className="text-xs font-bold uppercase tracking-wider" style={{ color: THEME.textMuted }}>
                  End Date
                  <input
                    type="date"
                    value={endDate}
                    min={startDate || undefined}
                    onChange={(event) => setEndDate(event.target.value)}
                    className="mt-2 min-h-12 w-full rounded-2xl border bg-white px-4 text-sm font-medium outline-none focus:ring-2 focus:ring-green-600 shadow-2xs"
                    style={{ borderColor: THEME.border, color: THEME.textDark }}
                  />
                </label>
              </>
            )}

            {needsElderId && (
              <label className="text-xs font-bold uppercase tracking-wider" style={{ color: THEME.textMuted }}>
                Elder ID
                <input
                  type="number"
                  min="1"
                  value={elderId}
                  onChange={(event) => setElderId(event.target.value)}
                  placeholder="Enter linked elder ID"
                  className="mt-2 min-h-12 w-full rounded-2xl border bg-white px-4 text-sm font-medium outline-none focus:ring-2 focus:ring-green-600 shadow-2xs"
                  style={{ borderColor: THEME.border, color: THEME.textDark }}
                />
              </label>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t pt-4" style={{ borderColor: THEME.border }}>
            <button
              type="button"
              onClick={loadReport}
              disabled={loading}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-6 py-2.5 text-sm font-bold text-white shadow-xs transition-all hover:brightness-105 active:scale-95 disabled:opacity-60 cursor-pointer"
              style={{ backgroundColor: THEME.primary }}
            >
              {loading ? (
                <LoaderCircle className="animate-spin" size={18} />
              ) : (
                <RefreshCw size={17} strokeWidth={2.2} />
              )}
              Apply Filters
            </button>

            <p className="text-xs font-medium" style={{ color: THEME.textMuted }}>
              Showing verified database records within the chosen date range.
            </p>
          </div>
        </section>

        {/* Error Alert */}
        {error && (
          <div
            role="alert"
            className="flex items-start gap-4 rounded-3xl border p-5 shadow-2xs"
            style={{
              backgroundColor: THEME.vitals.bg,
              borderColor: THEME.vitals.border,
              color: THEME.vitals.accent,
            }}
          >
            <AlertCircle className="mt-0.5 shrink-0" size={22} strokeWidth={2.2} />
            <div>
              <p className="font-bold text-base">Unable to complete request</p>
              <p className="mt-1 text-sm font-medium">{error}</p>
              <button
                type="button"
                onClick={loadReport}
                className="mt-2.5 inline-block text-xs font-bold uppercase tracking-wider underline hover:opacity-80 cursor-pointer"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Notice Alert */}
        {notice && (
          <div
            role="status"
            className="flex items-center gap-3 rounded-3xl border p-4 text-sm font-bold shadow-2xs"
            style={{
              backgroundColor: THEME.medication.bg,
              borderColor: THEME.medication.border,
              color: THEME.medication.accent,
            }}
          >
            <CheckCircle2 size={20} strokeWidth={2.2} />
            {notice}
          </div>
        )}

        {/* Loading / Content States */}
        {loading && !report ? (
          <div
            className="rounded-3xl border bg-white px-6 py-20 text-center shadow-2xs"
            style={{ borderColor: THEME.border }}
          >
            <LoaderCircle
              className="mx-auto animate-spin"
              size={38}
              style={{ color: THEME.primary }}
            />
            <p className="mt-4 text-base font-bold" style={{ color: THEME.textDark }}>Loading health records...</p>
            <p className="mt-1 text-sm font-medium" style={{ color: THEME.textMuted }}>
              Retrieving verified patient telemetry from database.
            </p>
          </div>
        ) : report ? (
          <>
            {/* Elder Profile Card */}
            <section
              className="overflow-hidden rounded-3xl border bg-white p-6 shadow-xs sm:p-7"
              style={{ borderColor: THEME.border }}
            >
              <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
                <div className="flex items-center gap-4">
                  <div
                    className="flex h-16 w-16 items-center justify-center rounded-2xl shadow-2xs"
                    style={{
                      backgroundColor: THEME.primaryLight,
                      color: THEME.primary,
                      border: `1.5px solid ${THEME.primaryBorder}`,
                    }}
                  >
                    <UserRound size={30} strokeWidth={2.2} />
                  </div>

                  <div>
                    <h2 className="text-xl font-black tracking-tight sm:text-2xl" style={{ color: THEME.textDark }}>
                      {profile?.name || "Elder Patient"}
                    </h2>
                    <p className="mt-1 text-sm font-medium" style={{ color: THEME.textMuted }}>
                      Elder ID: <strong style={{ color: THEME.textDark }}>{profile?.elder_id ?? "—"}</strong>
                      {profile?.age != null ? ` · ${profile.age} years old` : ""}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border p-4 text-sm sm:text-right shadow-2xs" style={{ backgroundColor: THEME.surfaceTint, borderColor: THEME.border }}>
                  <p className="font-bold" style={{ color: THEME.textDark }}>
                    {formatDate(profile?.start_date)} – {formatDate(profile?.end_date)}
                  </p>
                  <p className="mt-1 text-xs font-medium" style={{ color: THEME.textMuted }}>
                    Generated: {formatDateTime(profile?.generated_at)}
                  </p>
                </div>
              </div>

              <div
                className="mt-6 grid grid-cols-1 gap-4 border-t pt-5 sm:grid-cols-3"
                style={{ borderColor: THEME.border }}
              >
                <div className="rounded-2xl border p-4 shadow-2xs" style={{ backgroundColor: THEME.surfaceTint, borderColor: THEME.border }}>
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: THEME.textMuted }}>
                    Date of Birth
                  </p>
                  <p className="mt-1.5 text-sm font-bold" style={{ color: THEME.textDark }}>
                    {formatDate(profile?.date_of_birth)}
                  </p>
                </div>

                <div className="rounded-2xl border p-4 shadow-2xs" style={{ backgroundColor: THEME.surfaceTint, borderColor: THEME.border }}>
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: THEME.textMuted }}>
                    Gender
                  </p>
                  <p className="mt-1.5 text-sm font-bold" style={{ color: THEME.textDark }}>
                    {profile?.gender || "Not recorded"}
                  </p>
                </div>

                <div className="rounded-2xl border p-4 shadow-2xs" style={{ backgroundColor: THEME.surfaceTint, borderColor: THEME.border }}>
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: THEME.textMuted }}>
                    Blood Group
                  </p>
                  <p className="mt-1.5 text-sm font-bold" style={{ color: THEME.textDark }}>
                    {profile?.blood_group || "Not recorded"}
                  </p>
                </div>
              </div>
            </section>

            {/* Summary Metrics Grid */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                title="Medication Adherence"
                value={adherenceValue}
                subtitle={adherenceDescription}
                icon={Pill}
                accent={THEME.medication.accent}
                bg={THEME.medication.bg}
                border={THEME.medication.border}
              />

              <SummaryCard
                title="Vitals Recorded"
                value={vitals?.count ?? 0}
                subtitle="Saved biometric logs"
                icon={Heart}
                accent={THEME.vitals.accent}
                bg={THEME.vitals.bg}
                border={THEME.vitals.border}
              />

              <SummaryCard
                title="Meal Records"
                value={nutrition?.summary?.meal_records ?? 0}
                subtitle="Logged nutrition entries"
                icon={Salad}
                accent={THEME.nutrition.accent}
                bg={THEME.nutrition.bg}
                border={THEME.nutrition.border}
              />

              <SummaryCard
                title="Appointments"
                value={appointments?.count ?? 0}
                subtitle={`${appointments?.completed ?? 0} completed`}
                icon={CalendarDays}
                accent={THEME.appointments.accent}
                bg={THEME.appointments.bg}
                border={THEME.appointments.border}
              />
            </div>

            {/* Medication Summary & Section */}
            <Section
              title="Medication Management & Adherence"
              description="Detailed adherence metrics, active prescriptions, and dose logs"
              icon={Pill}
              accent={THEME.medication.accent}
              bg={THEME.medication.bg}
              border={THEME.medication.border}
            >
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {[
                  {
                    label: "Logged Doses",
                    value: medications?.logged_doses ?? 0,
                    accent: THEME.appointments.accent,
                    bg: THEME.appointments.bg,
                    border: THEME.appointments.border,
                  },
                  {
                    label: "Taken",
                    value: medications?.taken ?? 0,
                    accent: THEME.medication.accent,
                    bg: THEME.medication.bg,
                    border: THEME.medication.border,
                  },
                  {
                    label: "Missed",
                    value: medications?.missed ?? 0,
                    accent: THEME.vitals.accent,
                    bg: THEME.vitals.bg,
                    border: THEME.vitals.border,
                  },
                  {
                    label: "Skipped",
                    value: medications?.skipped ?? 0,
                    accent: THEME.nutrition.accent,
                    bg: THEME.nutrition.bg,
                    border: THEME.nutrition.border,
                  },
                ].map(({ label, value, accent, bg, border }) => (
                  <div
                    key={label}
                    className="rounded-2xl border p-4.5 shadow-2xs transition-all hover:shadow-xs"
                    style={{
                      borderColor: border,
                      backgroundColor: bg,
                    }}
                  >
                    <p className="text-xs font-bold uppercase tracking-wider" style={{ color: accent }}>
                      {label}
                    </p>
                    <p className="mt-2.5 text-3xl font-black" style={{ color: THEME.textDark }}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              <p className="mt-4 text-xs font-medium leading-relaxed" style={{ color: THEME.textMuted }}>
                {medications?.adherence_note}
              </p>

              <h3 className="mb-4 mt-8 text-base font-bold tracking-tight" style={{ color: THEME.textDark }}>
                Active Prescribed Medications
              </h3>

              {medications?.active_medications?.length ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {medications.active_medications.map((item, index) => (
                    <div
                      key={`${item.name}-${index}`}
                      className="rounded-2xl border p-4.5 transition-all hover:bg-slate-50/80 shadow-2xs"
                      style={{ borderColor: THEME.medication.border, backgroundColor: THEME.surface }}
                    >
                      <div className="flex items-start gap-3.5">
                        <div
                          className="rounded-xl p-2.5 shadow-2xs"
                          style={{
                            backgroundColor: THEME.medication.bg,
                            color: THEME.medication.accent,
                            border: `1px solid ${THEME.medication.border}`,
                          }}
                        >
                          <Pill size={20} strokeWidth={2.2} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <h4 className="text-base font-bold" style={{ color: THEME.textDark }}>{item.name}</h4>
                          <p className="mt-1 text-xs font-medium" style={{ color: THEME.textMuted }}>
                            Dosage: <span style={{ color: THEME.textDark, fontWeight: 600 }}>{item.dosage}</span>
                          </p>

                          {item.purpose && (
                            <p className="mt-1 text-xs font-medium" style={{ color: THEME.textMuted }}>
                              Purpose: <span style={{ color: THEME.textDark, fontWeight: 600 }}>{item.purpose}</span>
                            </p>
                          )}

                          {item.schedules?.length > 0 && (
                            <p className="mt-2 text-xs font-bold" style={{ color: THEME.medication.accent }}>
                              Schedule: {item.schedules.map((schedule) => schedule.time).join(", ")}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState message="No active medications are recorded." />
              )}

              <h3 className="mb-4 mt-8 text-base font-bold tracking-tight" style={{ color: THEME.textDark }}>
                Medication History Log
              </h3>

              <DataTable
                columns={medicationColumns}
                rows={medications?.history || []}
                emptyMessage="No medication logs were saved in this period."
                accent={THEME.medication.accent}
                bg={THEME.medication.bg}
              />
            </Section>

            {/* Health & Vitals Section */}
            <Section
              title="Health & Vitals Telemetry"
              description="Biometric logs recorded through the Health & Vitals module"
              icon={Activity}
              accent={THEME.vitals.accent}
              bg={THEME.vitals.bg}
              border={THEME.vitals.border}
              count={vitals?.count ?? 0}
            >
              {vitals?.latest && (
                <div
                  className="mb-6 rounded-2xl border p-5 shadow-2xs"
                  style={{
                    borderColor: THEME.vitals.border,
                    backgroundColor: THEME.vitals.bg,
                  }}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock size={18} style={{ color: THEME.vitals.accent }} strokeWidth={2.2} />
                      <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: THEME.textDark }}>
                        Latest Recorded Vitals
                      </h3>
                    </div>
                    <span className="text-xs font-semibold" style={{ color: THEME.textMuted }}>
                      {formatDateTime(vitals.latest.recorded_at)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 pt-2">
                    {[
                      ["Blood Pressure", vitals.latest.blood_pressure],
                      [
                        "Heart Rate",
                        displayValue(vitals.latest.heart_rate, vitals.latest.heart_rate != null ? " BPM" : ""),
                      ],
                      ["Blood Sugar", vitals.latest.blood_sugar],
                      [
                        "Temperature",
                        displayValue(vitals.latest.temperature, vitals.latest.temperature != null ? " °C" : ""),
                      ],
                      [
                        "Oxygen Level",
                        displayValue(vitals.latest.oxygen_level, vitals.latest.oxygen_level != null ? "%" : ""),
                      ],
                      [
                        "Weight",
                        displayValue(vitals.latest.weight, vitals.latest.weight != null ? " kg" : ""),
                      ],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl border bg-white p-3.5 shadow-2xs" style={{ borderColor: THEME.vitals.border }}>
                        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: THEME.textMuted }}>
                          {label}
                        </p>
                        <p className="mt-1.5 break-words text-sm font-bold" style={{ color: THEME.textDark }}>
                          {value ?? "Not recorded"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <DataTable
                columns={vitalColumns}
                rows={vitals?.history || []}
                emptyMessage="No vitals were recorded in this period."
                accent={THEME.vitals.accent}
                bg={THEME.vitals.bg}
              />
            </Section>

            {/* Nutrition Section */}
            <Section
              title="Nutrition & Meal Tracking"
              description="Logged meals, calories, and macronutrient summaries"
              icon={Salad}
              accent={THEME.nutrition.accent}
              bg={THEME.nutrition.bg}
              border={THEME.nutrition.border}
              count={nutrition?.records?.length ?? 0}
            >
              <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  {
                    label: "Total Calories",
                    value: nutrition?.summary?.calories_total,
                    unit: "kcal",
                    accent: THEME.nutrition.accent,
                    bg: THEME.nutrition.bg,
                    border: THEME.nutrition.border,
                  },
                  {
                    label: "Protein",
                    value: nutrition?.summary?.protein_total,
                    unit: "g",
                    accent: THEME.medication.accent,
                    bg: THEME.medication.bg,
                    border: THEME.medication.border,
                  },
                  {
                    label: "Carbohydrates",
                    value: nutrition?.summary?.carbohydrates_total,
                    unit: "g",
                    accent: THEME.appointments.accent,
                    bg: THEME.appointments.bg,
                    border: THEME.appointments.border,
                  },
                  {
                    label: "Fats",
                    value: nutrition?.summary?.fats_total,
                    unit: "g",
                    accent: THEME.medical.accent,
                    bg: THEME.medical.bg,
                    border: THEME.medical.border,
                  },
                ].map(({ label, value, unit, accent, bg, border }) => (
                  <div
                    key={label}
                    className="rounded-2xl border p-4.5 shadow-2xs"
                    style={{
                      borderColor: border,
                      backgroundColor: bg,
                    }}
                  >
                    <p className="text-xs font-bold uppercase tracking-wider" style={{ color: accent }}>
                      {label}
                    </p>
                    <p className="mt-2.5 break-words text-xl font-black" style={{ color: THEME.textDark }}>
                      {value == null ? "—" : `${value} ${unit}`}
                    </p>
                  </div>
                ))}
              </div>

              <p className="mb-4 text-xs font-medium" style={{ color: THEME.textMuted }}>
                Nutritional aggregates reflect saved records within the chosen date range.
              </p>

              <DataTable
                columns={nutritionColumns}
                rows={nutrition?.records || []}
                emptyMessage="No saved meal records were found in this period."
                accent={THEME.nutrition.accent}
                bg={THEME.nutrition.bg}
              />
            </Section>

            {/* Medical History Section */}
            <Section
              title="Medical History & Assessments"
              description="Symptom reports, automated risk assessments, and clinical prescriptions"
              icon={Stethoscope}
              accent={THEME.medical.accent}
              bg={THEME.medical.bg}
              border={THEME.medical.border}
            >
              <h3
                className="mb-3.5 border-l-4 pl-3.5 text-base font-bold tracking-tight"
                style={{ borderColor: THEME.medical.accent, color: THEME.textDark }}
              >
                Recorded Symptoms
              </h3>

              <DataTable
                columns={symptomColumns}
                rows={medical?.symptoms || []}
                emptyMessage="No symptoms were recorded in this period."
                accent={THEME.medical.accent}
                bg={THEME.medical.bg}
              />

              <h3
                className="mb-3.5 mt-8 border-l-4 pl-3.5 text-base font-bold tracking-tight"
                style={{ borderColor: THEME.appointments.accent, color: THEME.textDark }}
              >
                Health Assessments & Risk Predictions
              </h3>

              <DataTable
                columns={assessmentColumns}
                rows={medical?.assessments || []}
                emptyMessage="No saved health assessments were found in this period."
                accent={THEME.medical.accent}
                bg={THEME.medical.bg}
              />

              <h3
                className="mb-3.5 mt-8 border-l-4 pl-3.5 text-base font-bold tracking-tight"
                style={{ borderColor: THEME.nutrition.accent, color: THEME.textDark }}
              >
                Doctor Prescriptions
              </h3>

              <DataTable
                columns={prescriptionColumns}
                rows={medical?.prescriptions || []}
                emptyMessage="No prescriptions were recorded in this period."
                accent={THEME.medical.accent}
                bg={THEME.medical.bg}
              />
            </Section>

            {/* Appointments Section */}
            <Section
              title="Appointments Schedule"
              description="Upcoming and completed medical consultations"
              icon={CalendarDays}
              accent={THEME.appointments.accent}
              bg={THEME.appointments.bg}
              border={THEME.appointments.border}
              count={appointments?.count ?? 0}
            >
              <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div
                  className="rounded-2xl border p-4.5 shadow-2xs"
                  style={{
                    borderColor: THEME.medication.border,
                    backgroundColor: THEME.medication.bg,
                  }}
                >
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: THEME.medication.accent }}>
                    Completed Appointments
                  </p>
                  <p className="mt-2.5 text-3xl font-black" style={{ color: THEME.textDark }}>
                    {appointments?.completed ?? 0}
                  </p>
                </div>

                <div
                  className="rounded-2xl border p-4.5 shadow-2xs"
                  style={{
                    borderColor: THEME.nutrition.border,
                    backgroundColor: THEME.nutrition.bg,
                  }}
                >
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: THEME.nutrition.accent }}>
                    Upcoming / Pending
                  </p>
                  <p className="mt-2.5 text-3xl font-black" style={{ color: THEME.textDark }}>
                    {appointments?.upcoming ?? 0}
                  </p>
                </div>
              </div>

              <DataTable
                columns={appointmentColumns}
                rows={appointments?.records || []}
                emptyMessage="No appointments were found in this period."
                accent={THEME.appointments.accent}
                bg={THEME.appointments.bg}
              />
            </Section>

            {/* Disclaimer Footer Box */}
            <div
              className="flex items-start gap-4 rounded-3xl border p-5 text-sm leading-relaxed shadow-2xs"
              style={{
                backgroundColor: THEME.nutrition.bg,
                borderColor: THEME.nutrition.border,
                color: "#7A3E16",
              }}
            >
              <ShieldCheck className="mt-0.5 shrink-0" size={22} strokeWidth={2.2} />
              <div>
                <strong className="font-bold">Medical Disclaimer: </strong>
                {report.disclaimer ||
                  "This report summarizes saved health records for informational purposes. It does not constitute a formal medical diagnosis. Always consult a qualified healthcare professional for medical advice."}
              </div>
            </div>
          </>
        ) : !error ? (
          <EmptyState message="No report is available yet." />
        ) : null}

        <footer className="pb-6 pt-2 text-center text-xs font-semibold" style={{ color: THEME.textMuted }}>
          Elder Sense · Smart Elderly Care System for Medication Monitoring and Healthcare Management
        </footer>
      </main>
    </div>
  );
}