import {
  Bell,
  CalendarDays,
  ChevronRight,
  CircleCheck,
  HeartPulse,
  Home,
  LogOut,
  Menu,
  MessageCircle,
  Pill,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserRound,
  Utensils,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateValue(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  let text = String(value).trim();
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(text)) return null;
  if (!/\d{4}/.test(text)) return null;
  text = text.replace(/^(\d{4}-\d{2}-\d{2}) (\d)/, "$1T$2");
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeDoseStatus(status) {
  const value = String(status || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  if (value === "TAKEN") return "TAKEN";
  if (value === "MISSED" || value === "NOT_TAKEN") return "MISSED";
  return "PENDING";
}

function toHHMM(time) {
  if (!time) return "";
  const parts = String(time).split(":");
  const hour = Number(parts[0]);
  const minute = Number(parts[1]);
  if (parts.length < 2 || Number.isNaN(hour) || Number.isNaN(minute)) return "";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function historyMatchesDose(item, medicationId, scheduleId, scheduleTime, dateKey) {
  if (!item) return false;
  if (
    !medicationId ||
    !item.medication_id ||
    String(item.medication_id) !== String(medicationId)
  ) {
    return false;
  }
  const doseDate = parseDateValue(item.scheduled_at) || parseDateValue(item.actual_taken_at);
  if (!doseDate || getLocalDateKey(doseDate) !== dateKey) return false;

  if (item.schedule_id && scheduleId) {
    return String(item.schedule_id) === String(scheduleId);
  }
  const expectedTime = toHHMM(scheduleTime);
  if (!expectedTime) return false;
  let itemTime = toHHMM(item.scheduled_time);
  if (!itemTime) {
    const scheduledDate = parseDateValue(item.scheduled_at);
    if (scheduledDate) {
      itemTime = toHHMM(`${scheduledDate.getHours()}:${scheduledDate.getMinutes()}`);
    }
  }
  return Boolean(itemTime) && itemTime === expectedTime;
}

function getDoseStatus(medicine, schedule, history, todayKey) {
  const dateKey = todayKey || getLocalDateKey();
  const list = Array.isArray(history) ? history : [];
  const medicationId = medicine?.id ?? medicine?.medication_id;
  const scheduleId = schedule?.id ?? schedule?.schedule_id;
  const scheduleTime = schedule?.time || schedule?.scheduled_time;

  const matches = list.filter((item) =>
    historyMatchesDose(item, medicationId, scheduleId, scheduleTime, dateKey)
  );

  if (matches.length === 0) {
    return { status: "PENDING", recorded: false };
  }

  const finalRecords = matches.filter(
    (item) => normalizeDoseStatus(item.status) !== "PENDING"
  );
  const pool = finalRecords.length > 0 ? finalRecords : matches;
  const latest = pool[0];
  const status = normalizeDoseStatus(latest?.status);
  return { status, recorded: status !== "PENDING" };
}

function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [latestHeartRate, setLatestHeartRate] = useState(null);
  const [heartRateLoading, setHeartRateLoading] = useState(true);

  const [medications, setMedications] = useState([]);
  const [medicationHistory, setMedicationHistory] = useState([]);
  const [adherenceRate, setAdherenceRate] = useState(null);
  const [medicationLoading, setMedicationLoading] = useState(true);

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const loadLatestHeartRate = useCallback(async () => {
    const token = localStorage.getItem("access_token");

    if (!token) {
      setHeartRateLoading(false);
      navigate("/login");
      return;
    }

    setHeartRateLoading(true);

    try {
      const apiBase =
        import.meta.env.VITE_API_BASE_URL ||
        `${window.location.protocol}//${window.location.hostname}:5000/api`;

      const response = await axios.get(`${apiBase}/health/vitals`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const records = Array.isArray(response.data?.vitals)
        ? response.data.vitals
        : [];

      const validHeartRateRecords = records.filter((record) => {
        if (
          record.heart_rate === null ||
          record.heart_rate === undefined ||
          String(record.heart_rate).trim() === ""
        ) {
          return false;
        }

        const value = Number(record.heart_rate);
        return Number.isFinite(value) && value > 0;
      });

      validHeartRateRecords.sort((a, b) => {
        const timeA = a.recorded_at
          ? new Date(a.recorded_at).getTime()
          : 0;

        const timeB = b.recorded_at
          ? new Date(b.recorded_at).getTime()
          : 0;

        const safeTimeA = Number.isFinite(timeA) ? timeA : 0;
        const safeTimeB = Number.isFinite(timeB) ? timeB : 0;

        if (safeTimeA !== safeTimeB) {
          return safeTimeB - safeTimeA;
        }

        return Number(b.id || 0) - Number(a.id || 0);
      });

      const latestRecord = validHeartRateRecords[0];

      setLatestHeartRate(
        latestRecord ? Number(latestRecord.heart_rate) : null
      );
    } catch (error) {
      console.error("Unable to load latest heart rate:", error);
      setLatestHeartRate(null);
    } finally {
      setHeartRateLoading(false);
    }
  }, [navigate]);

  const loadMedicationData = useCallback(async () => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    setMedicationLoading(true);
    try {
      const apiBase =
        import.meta.env.VITE_API_BASE_URL ||
        `${window.location.protocol}//${window.location.hostname}:5000/api`;

      const config = { headers: { Authorization: `Bearer ${token}` } };

      const [medRes, histRes, adhRes] = await Promise.all([
        axios.get(`${apiBase}/medications`, config).catch(() => null),
        axios.get(`${apiBase}/medications/history?days=30`, config).catch(() => null),
        axios.get(`${apiBase}/medications/adherence`, config).catch(() => null),
      ]);

      const medData = medRes?.data;
      const medList = Array.isArray(medData)
        ? medData
        : Array.isArray(medData?.medications)
          ? medData.medications
          : [];
      setMedications(medList.filter((m) => m?.is_active !== false));

      const histData = histRes?.data;
      const histList = Array.isArray(histData)
        ? histData
        : Array.isArray(histData?.history)
          ? histData.history
          : [];
      setMedicationHistory(histList);

      const adhData = adhRes?.data;
      if (adhData) {
        const pct =
          adhData.percentage ??
          adhData.adherence?.percentage ??
          adhData.adherence;
        if (pct !== undefined && pct !== null) {
          setAdherenceRate(Number(pct) || 0);
        }
      }
    } catch (error) {
      console.error("Unable to load medication data:", error);
    } finally {
      setMedicationLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLatestHeartRate();
    loadMedicationData();

    const refreshOnFocus = () => {
      if (document.visibilityState === "visible") {
        loadLatestHeartRate();
        loadMedicationData();
      }
    };

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnFocus);

    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnFocus);
    };
  }, [loadLatestHeartRate, loadMedicationData]);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const todayKey = getLocalDateKey();
  const activeMeds = medications.filter((m) => m?.is_active !== false);

  const todaySchedules = [];
  activeMeds.forEach((medicine) => {
    if (medicine?.start_date && todayKey < medicine.start_date) return;
    if (medicine?.end_date && todayKey > medicine.end_date) return;
    const schedules = Array.isArray(medicine?.schedules) ? medicine.schedules : [];
    schedules.forEach((schedule) => {
      if (schedule?.is_active !== false) {
        todaySchedules.push({ medicine, schedule });
      }
    });
  });

  const todayTotal = todaySchedules.length;
  let completedCount = 0;
  todaySchedules.forEach(({ medicine, schedule }) => {
    const statusObj = getDoseStatus(medicine, schedule, medicationHistory, todayKey);
    if (statusObj.status === "TAKEN") {
      completedCount += 1;
    }
  });
  const remainingCount = Math.max(0, todayTotal - completedCount);

  const calculatedAdherence = adherenceRate !== null
    ? Math.round(adherenceRate)
    : todayTotal > 0
      ? Math.round((completedCount / todayTotal) * 100)
      : 0;

  // Dynamic time-based greeting calculation
  const currentHour = new Date().getHours();
  let timeGreeting = "Good morning";
  if (currentHour >= 12 && currentHour < 17) {
    timeGreeting = "Good afternoon";
  } else if (currentHour >= 17 && currentHour < 21) {
    timeGreeting = "Good evening";
  } else if (currentHour >= 21 || currentHour < 4) {
    timeGreeting = "Good night";
  }

  const mainNavItems = [
    { name: "Medicine Reminders", path: "/medications", icon: Pill },
    { name: "Medicine Finder", path: "/medicine-finder", icon: Search },
    { name: "Health & Vitals", path: "/health-vitals", icon: HeartPulse },
    { name: "Health Reports", path: "/health-reports", icon: MessageCircle },
    { name: "Nutrition", path: "/nutrition", icon: Utensils },
    { name: "Appointments", path: "/appointments", icon: CalendarDays },
    { name: "AI Assistant", path: "/ai-assistant", icon: Sparkles },
    { name: "Connect My Care Team", path: "/my-care-team", icon: ShieldCheck },
  ];

  const accountNavItems = [
    { name: "Profile", path: "/profile", icon: UserRound },
    { name: "Settings", path: "/settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#f4fbfa] text-slate-800">
      {/* A. HEADER */}
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/90 backdrop-blur-xl">
        <div className="flex h-20 items-center justify-between px-5 sm:px-8 lg:px-10">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-50 text-slate-700 transition hover:bg-cyan-50 hover:text-cyan-600 lg:hidden"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>

            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-500 text-2xl shadow-lg shadow-cyan-100">
              🩺
            </div>

            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-800">
                Elder Sense
              </h1>
              <p className="hidden text-xs text-slate-400 sm:block">
                Smart care, simply delivered
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Notifications"
              onClick={() => alert("No new notifications")}
              className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-50 text-slate-600 transition hover:bg-cyan-50 hover:text-cyan-600"
            >
              <Bell size={20} />
              <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-rose-400 ring-2 ring-white" />
            </button>

            <div className="hidden h-10 w-px bg-slate-200 sm:block" />

            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-cyan-100 to-emerald-100 text-xl">
                👩🏻
              </div>

              <div className="hidden sm:block">
                <p className="text-sm font-semibold text-slate-700">
                  {user.full_name || "Elder"}
                </p>
                <p className="text-xs text-slate-400">Elder</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* MOBILE DRAWER OVERLAY */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* MOBILE SIDEBAR DRAWER */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 transform bg-white p-6 shadow-2xl transition-transform duration-300 ease-in-out lg:hidden overflow-y-auto ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between pb-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 text-xl text-white">
              🩺
            </div>
            <span className="font-bold text-slate-800 text-lg">Elder Sense</span>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="mt-6 space-y-1.5">
          {mainNavItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.name}
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate(item.path);
                }}
                className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-semibold transition ${
                  isActive
                    ? "bg-cyan-50 text-cyan-700 shadow-sm"
                    : "text-slate-600 hover:bg-slate-50 hover:text-cyan-600"
                }`}
              >
                <span className="flex shrink-0 w-5 items-center justify-center">
                  <IconComponent size={20} />
                </span>
                <span className="truncate">{item.name}</span>
              </button>
            );
          })}

          <div className="my-4 border-t border-slate-100" />

          {accountNavItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.name}
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate(item.path);
                }}
                className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-semibold transition ${
                  isActive
                    ? "bg-cyan-50 text-cyan-700 shadow-sm"
                    : "text-slate-600 hover:bg-slate-50 hover:text-cyan-600"
                }`}
              >
                <span className="flex shrink-0 w-5 items-center justify-center">
                  <IconComponent size={20} />
                </span>
                <span className="truncate">{item.name}</span>
              </button>
            );
          })}

          <div className="my-4 border-t border-slate-100" />

          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              handleLogout();
            }}
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-semibold text-rose-500 transition hover:bg-rose-50"
          >
            <span className="flex shrink-0 w-5 items-center justify-center">
              <LogOut size={20} />
            </span>
            <span className="truncate">Logout</span>
          </button>
        </nav>
      </div>

      <div className="mx-auto flex max-w-[1500px]">
        {/* B. SIDEBAR NAVIGATION */}
        <aside className="hidden w-64 shrink-0 border-r border-slate-200/70 bg-white px-4 py-6 lg:block sticky top-20 h-[calc(100vh-5rem)] overflow-y-auto">
          <nav className="space-y-1.5">
            {mainNavItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => navigate(item.path)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-semibold transition ${
                    isActive
                      ? "bg-cyan-50 text-cyan-700 shadow-sm"
                      : "text-slate-600 hover:bg-slate-50 hover:text-cyan-600"
                  }`}
                >
                  <span className="flex shrink-0 w-5 items-center justify-center">
                    <IconComponent size={20} />
                  </span>
                  <span className="truncate">{item.name}</span>
                </button>
              );
            })}
          </nav>

          <div className="my-6 border-t border-slate-100" />

          <nav className="space-y-1.5">
            {accountNavItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => navigate(item.path)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-semibold transition ${
                    isActive
                      ? "bg-cyan-50 text-cyan-700 shadow-sm"
                      : "text-slate-600 hover:bg-slate-50 hover:text-cyan-600"
                  }`}
                >
                  <span className="flex shrink-0 w-5 items-center justify-center">
                    <IconComponent size={20} />
                  </span>
                  <span className="truncate">{item.name}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-semibold text-rose-500 transition hover:bg-rose-50"
            >
              <span className="flex shrink-0 w-5 items-center justify-center">
                <LogOut size={20} />
              </span>
              <span className="truncate">Logout</span>
            </button>
          </nav>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="min-w-0 flex-1 px-5 py-7 sm:px-8 lg:px-10">
          {/* C. WELCOME BANNER */}
          <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-cyan-500 via-teal-500 to-emerald-500 p-7 text-white shadow-xl shadow-cyan-100 sm:p-9">
            <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10" />
            <div className="absolute -bottom-28 right-28 h-64 w-64 rounded-full bg-white/10" />

            <div className="relative z-10 max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm backdrop-blur-sm">
                <Sparkles size={16} />
                Your health companion
              </div>

              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                {timeGreeting}, {user.full_name?.split(" ")[0] || "there"}! 👋
              </h2>

              <p className="mt-3 max-w-xl text-sm leading-6 text-cyan-50 sm:text-base">
                Stay on top of your medicines, monitor your health, and take
                small steps toward a healthier day.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => navigate("/medicine-finder")}
                  className="rounded-xl border border-white/30 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
                >
                  Find a medicine 🔎
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/ai-assistant")}
                  className="rounded-xl border border-white/30 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
                >
                  Ask AI 🤖
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/my-care-team")}
                  className="rounded-xl border border-white/30 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
                >
                  🤝 Connect My Care Team
                </button>
              </div>
            </div>

            <div className="absolute bottom-5 right-8 hidden text-[100px] leading-none opacity-90 xl:block">
              👵🏻
            </div>
          </section>

          {/* E. HEALTH OVERVIEW CARDS */}
          <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {/* Today's medicines */}
            <button
              type="button"
              onClick={() => navigate("/medications")}
              className="cursor-pointer rounded-3xl border border-slate-100 bg-white p-5 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
                  <Pill size={23} />
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">
                  Today
                </span>
              </div>

              <p className="mt-5 text-sm text-slate-400">
                Today's Medicines
              </p>
              <h3 className="mt-1 text-3xl font-bold text-slate-800">
                {medicationLoading ? "..." : todayTotal}
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                {medicationLoading
                  ? "Loading..."
                  : `${completedCount} completed · ${remainingCount} remaining`}
              </p>
            </button>

            {/* Heart rate */}
            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
              <div className="flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
                  <HeartPulse size={23} />
                </div>

                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  Latest reading
                </span>
              </div>

              <p className="mt-5 text-sm text-slate-400">Heart Rate</p>

              <h3 className="mt-1 text-3xl font-bold text-slate-800">
                {heartRateLoading
                  ? "..."
                  : latestHeartRate !== null
                    ? latestHeartRate
                    : "—"}{" "}
                <span className="text-sm font-medium text-slate-400">
                  BPM
                </span>
              </h3>

              <p className="mt-1 text-xs text-slate-400">
                {latestHeartRate !== null
                  ? "Latest recorded heart-rate value"
                  : "No heart-rate record found"}
              </p>

              <button
                type="button"
                onClick={() => navigate("/health-vitals")}
                className="mt-3 text-sm font-semibold text-cyan-600 hover:text-cyan-700"
              >
                View health records →
              </button>
            </div>

            {/* Medication adherence */}
            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
              <div className="flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-500">
                  <CircleCheck size={23} />
                </div>

                <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-600">
                  This week
                </span>
              </div>

              <p className="mt-5 text-sm text-slate-400">
                Medication Adherence
              </p>
              <h3 className="mt-1 text-3xl font-bold text-slate-800">
                {medicationLoading ? "..." : `${calculatedAdherence}%`}
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                {calculatedAdherence >= 80
                  ? "Great consistency! 🌟"
                  : calculatedAdherence > 0
                    ? "Keep going! 💪"
                    : "No records yet"}
              </p>
            </div>

            {/* Health risk */}
            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
              <div className="flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-500">
                  <ShieldCheck size={23} />
                </div>

                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  Assessment
                </span>
              </div>

              <p className="mt-5 text-sm text-slate-400">Health Risk</p>
              <h3 className="mt-1 text-3xl font-bold text-slate-800">
                Review
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                Check Health &amp; Vitals for your assessment.
              </p>
              <button
                type="button"
                onClick={() => navigate("/health-vitals")}
                className="mt-3 text-sm font-semibold text-cyan-600 hover:text-cyan-700"
              >
                Review health →
              </button>
            </div>
          </section>

          {/* F. MAIN DASHBOARD SECTIONS (Today's Medicines & AI Care Assistant) */}
          <section className="mt-7 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
            {/* Today's medicines (Connected live with correct counts & emojis) */}
            <div className="rounded-3xl border border-cyan-100 bg-gradient-to-br from-white via-cyan-50/20 to-teal-50/30 p-6 shadow-sm sm:p-7">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    Today's Medicines 💊
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Keep your medication routine on track.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => navigate("/medications")}
                  className="flex items-center gap-1 text-sm font-semibold text-cyan-600 hover:text-cyan-700 transition"
                >
                  Medicine Reminders ⏰
                  <ChevronRight size={17} />
                </button>
              </div>

              <div className="mt-6 rounded-2xl border border-cyan-200/60 bg-white p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700 text-xl shadow-sm">
                    💊
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-slate-800">
                        Your medication schedule
                      </p>
                      <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-700">
                        {medicationLoading ? "Loading..." : `${completedCount} of ${todayTotal} completed ✨`}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm leading-6 text-slate-500">
                      Open Medicine Reminders to view your saved medicines, scheduled times, and recorded dose status.
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate("/medications")}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700"
                    >
                      View my reminders 📋
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* AI assistant */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 p-6 text-white shadow-lg sm:p-7">
              <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/10" />

              <div className="relative z-10">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-2xl backdrop-blur-sm">
                  🤖
                </div>

                <h3 className="mt-6 text-2xl font-bold">
                  Meet your AI Care Assistant
                </h3>

                <p className="mt-3 text-sm leading-6 text-purple-100">
                  Ask questions about your medicines, symptoms, nutrition, or
                  everyday health concerns.
                </p>

                <button
                  type="button"
                  onClick={() => navigate("/ai-assistant")}
                  className="mt-7 flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 font-semibold text-purple-600 transition hover:bg-purple-50 shadow-sm"
                >
                  <MessageCircle size={18} />
                  Start a conversation
                </button>
              </div>
            </div>
          </section>

          {/* F. MAIN DASHBOARD SECTIONS (Medicine Finder, Health Check, Nutrition, Doctor Care) */}
          <section className="mt-7 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {/* Medicine Finder */}
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
                🔎
              </div>

              <h3 className="mt-5 text-lg font-bold text-slate-800">
                Medicine Finder 💊
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                Search for a medicine to view its information and nearby
                pharmacy availability.
              </p>

              <button
                type="button"
                onClick={() => navigate("/medicine-finder")}
                className="mt-5 flex items-center gap-1 text-sm font-semibold text-cyan-600 hover:text-cyan-700"
              >
                Find a medicine
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Health check */}
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
                <HeartPulse size={24} />
              </div>

              <h3 className="mt-5 text-lg font-bold text-slate-800">
                Health Check
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                Record your vital signs and review your health measurements.
              </p>

              <button
                type="button"
                onClick={() => navigate("/health-vitals")}
                className="mt-5 flex items-center gap-1 text-sm font-semibold text-cyan-600 hover:text-cyan-700"
              >
                Check vitals
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Nutrition */}
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
                🥗
              </div>

              <h3 className="mt-5 text-lg font-bold text-slate-800">
                Nutrition
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                Explore healthier food choices and food–medicine interactions.
              </p>

              <button
                type="button"
                onClick={() => navigate("/nutrition")}
                className="mt-5 flex items-center gap-1 text-sm font-semibold text-cyan-600 hover:text-cyan-700"
              >
                Explore nutrition
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Doctor care */}
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-500">
                <Stethoscope size={24} />
              </div>

              <h3 className="mt-5 text-lg font-bold text-slate-800">
                Doctor Care
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                Open your appointments and access available doctor-care
                features.
              </p>

              <button
                type="button"
                onClick={() => navigate("/appointments")}
                className="mt-5 flex items-center gap-1 text-sm font-semibold text-cyan-600 hover:text-cyan-700"
              >
                View appointments
                <ChevronRight size={16} />
              </button>
            </div>
          </section>

          {/* D. CONNECT MY CARE TEAM CARD (At the very bottom) */}
          <section className="mt-7 rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm sm:p-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <ShieldCheck size={28} />
                </div>

                <div>
                  <h3 className="text-xl font-bold text-slate-800">
                    Connect My Care Team 🤝
                  </h3>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                    Connect with your trusted caregiver and doctor. Send a connection
                    request, check its status, and see your approved care team.
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600">
                      ❤️ Caregiver
                    </span>
                    <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600">
                      🩺 Doctor
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate("/my-care-team")}
                className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
              >
                Manage Connections
                <ChevronRight size={18} />
              </button>
            </div>
          </section>

          {/* FOOTER */}
          <footer className="py-8 text-center text-xs text-slate-400">
            Elder Sense · Smart care for healthier living 🩵
          </footer>
        </main>
      </div>
    </div>
  );
}

export default Dashboard;