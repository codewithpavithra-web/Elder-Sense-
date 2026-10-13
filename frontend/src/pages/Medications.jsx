import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  Activity,
  AlarmClock,
  AlertCircle,
  Bell,
  BellOff,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Download,
  Edit3,
  Flame,
  HeartPulse,
  History,
  ImagePlus,
  Languages,
  Moon,
  MoreVertical,
  Pill,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  TrendingUp,
  Upload,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:5000/api`;

const LANGUAGES = [
  {
    value: "English",
    label: "English",
    voice: "en-IN",
  },
  {
    value: "Kannada",
    label: "ಕನ್ನಡ",
    voice: "kn-IN",
  },
  {
    value: "Tamil",
    label: "தமிழ்",
    voice: "ta-IN",
  },
  {
    value: "Telugu",
    label: "తెలుగు",
    voice: "te-IN",
  },
  {
    value: "Hindi",
    label: "हिन्दी",
    voice: "hi-IN",
  },
  {
    value: "Malayalam",
    label: "മലയാളം",
    voice: "ml-IN",
  },
];

const MEDICINE_COLORS = [
  "cyan",
  "teal",
  "emerald",
  "violet",
  "amber",
  "rose",
];

const MISSED_REASONS = [
  "Forgot",
  "Feeling unwell",
  "Not available",
  "Other",
];

const EMPTY_FORM = {
  name: "",
  dosage: "",
  form: "Tablet",
  purpose: "",
  instructions: "",
  start_date: "",
  end_date: "",
};

const EMPTY_SCHEDULE = {
  time: "08:00",
  time_format: "12h",
  reminder_enabled: true,
};

function getToken() {
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("jwt_token") ||
    ""
  );
}

function getAuthConfig() {
  const token = getToken();

  return token
    ? {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    : {};
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getLocalDateTimeString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

function formatTime(time) {
  if (!time) return "—";

  const parts = String(time).split(":");
  const hour = Number(parts[0]);
  const minute = Number(parts[1]);

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return String(time);
  }

  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function getTimeParts(time) {
  const [hourString, minuteString] = String(time || "08:00").split(":");
  const hour = Number(hourString);
  const minute = Number(minuteString);

  return {
    hour: Number.isNaN(hour) ? 8 : Math.min(Math.max(hour, 0), 23),
    minute: Number.isNaN(minute)
      ? 0
      : Math.min(Math.max(minute, 0), 59),
  };
}

function convert12HourTo24(hour12, minute, period) {
  let hour = Number(hour12);
  if (period === "AM") {
    hour = hour === 12 ? 0 : hour;
  } else {
    hour = hour === 12 ? 12 : hour + 12;
  }

  return `${String(hour).padStart(2, "0")}:${String(
    Number(minute)
  ).padStart(2, "0")}`;
}

function get12HourParts(time) {
  const { hour, minute } = getTimeParts(time);
  return {
    hour12: String(hour % 12 || 12),
    minute: String(minute).padStart(2, "0"),
    period: hour >= 12 ? "PM" : "AM",
  };
}

function getWeekSunday(date = new Date()) {
  const sunday = new Date(date);
  sunday.setHours(0, 0, 0, 0);
  sunday.setDate(sunday.getDate() - sunday.getDay());
  return sunday;
}

function formatDate(dateValue) {
  if (!dateValue) return "—";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return String(dateValue);
  }

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(dateValue) {
  if (!dateValue) return "—";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return String(dateValue);
  }

  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getMedicineColor(index) {
  return MEDICINE_COLORS[index % MEDICINE_COLORS.length];
}

function getColorClasses(color) {
  const colors = {
    cyan: {
      soft: "bg-cyan-50",
      border: "border-cyan-100",
      icon: "bg-cyan-100 text-cyan-700",
      text: "text-cyan-700",
      strong: "bg-cyan-500",
    },
    teal: {
      soft: "bg-teal-50",
      border: "border-teal-100",
      icon: "bg-teal-100 text-teal-700",
      text: "text-teal-700",
      strong: "bg-teal-500",
    },
    emerald: {
      soft: "bg-emerald-50",
      border: "border-emerald-100",
      icon: "bg-emerald-100 text-emerald-700",
      text: "text-emerald-700",
      strong: "bg-emerald-500",
    },
    violet: {
      soft: "bg-violet-50",
      border: "border-violet-100",
      icon: "bg-violet-100 text-violet-700",
      text: "text-violet-700",
      strong: "bg-violet-500",
    },
    amber: {
      soft: "bg-amber-50",
      border: "border-amber-100",
      icon: "bg-amber-100 text-amber-700",
      text: "text-amber-700",
      strong: "bg-amber-500",
    },
    rose: {
      soft: "bg-rose-50",
      border: "border-rose-100",
      icon: "bg-rose-100 text-rose-700",
      text: "text-rose-700",
      strong: "bg-rose-500",
    },
  };

  return colors[color] || colors.cyan;
}

function getMedicineName(medicine) {
  return (
    medicine?.name ||
    medicine?.medicine_name ||
    medicine?.medication_name ||
    "Medicine"
  );
}

function getMedicineDosage(medicine) {
  return medicine?.dosage || medicine?.dose || "";
}

function getSchedules(medicine) {
  return Array.isArray(medicine?.schedules)
    ? medicine.schedules
    : [];
}

function getScheduleTime(schedule) {
  return schedule?.time || schedule?.scheduled_time || "";
}

function getScheduleId(schedule) {
  return schedule?.id ?? schedule?.schedule_id;
}

function getMedicationId(medicine) {
  return medicine?.id ?? medicine?.medication_id;
}

function getScheduleDateTime(schedule, date = new Date()) {
  const time = getScheduleTime(schedule);

  if (!time) return null;

  const [hours, minutes] = String(time)
    .split(":")
    .map(Number);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes)
  ) {
    return null;
  }

  const scheduled = new Date(date);

  scheduled.setHours(hours, minutes, 0, 0);

  return scheduled;
}

function normalizeHistoryItem(item) {
  return {
    ...item,
    medication_name:
      item?.medication_name ||
      item?.medicine_name ||
      item?.name ||
      "Medicine",
    scheduled_at:
      item?.scheduled_at ||
      item?.scheduled_time ||
      null,
    actual_taken_at:
      item?.actual_taken_at ||
      item?.taken_at ||
      item?.marked_taken_at ||
      null,
    status:
      item?.status ||
      "PENDING",
  };
}

function hasValue(value) {
  return (
    value !== undefined &&
    value !== null &&
    value !== ""
  );
}

function toHHMM(time) {
  if (!time) return "";

  const parts = String(time).split(":");
  const hour = Number(parts[0]);
  const minute = Number(parts[1]);

  if (
    parts.length < 2 ||
    Number.isNaN(hour) ||
    Number.isNaN(minute)
  ) {
    return "";
  }

  return `${String(hour).padStart(2, "0")}:${String(
    minute
  ).padStart(2, "0")}`;
}

function parseDateValue(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  let text = String(value).trim();

  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(text)) {
    return null;
  }

  if (!/\d{4}/.test(text)) {
    return null;
  }

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

  if (value === "MISSED" || value === "NOT_TAKEN") {
    return "MISSED";
  }

  return "PENDING";
}

function getHistoryDoseDate(item) {
  return (
    parseDateValue(item?.scheduled_at) ||
    parseDateValue(item?.actual_taken_at) ||
    null
  );
}

function getHistoryRecordTimestamp(item) {
  const date =
    parseDateValue(item?.actual_taken_at) ||
    parseDateValue(item?.scheduled_at);

  return date ? date.getTime() : 0;
}

function historyMatchesDose(
  item,
  medicationId,
  scheduleId,
  scheduleTime,
  dateKey
) {
  if (!item) return false;

  if (
    !hasValue(medicationId) ||
    !hasValue(item.medication_id) ||
    String(item.medication_id) !== String(medicationId)
  ) {
    return false;
  }

  const doseDate = getHistoryDoseDate(item);

  if (
    !doseDate ||
    getLocalDateKey(doseDate) !== dateKey
  ) {
    return false;
  }

  if (
    hasValue(item.schedule_id) &&
    hasValue(scheduleId)
  ) {
    return String(item.schedule_id) === String(scheduleId);
  }

  const expectedTime = toHHMM(scheduleTime);

  if (!expectedTime) return false;

  let itemTime = toHHMM(item.scheduled_time);

  if (!itemTime) {
    const scheduledDate = parseDateValue(item.scheduled_at);

    if (scheduledDate) {
      itemTime = toHHMM(
        `${scheduledDate.getHours()}:${scheduledDate.getMinutes()}`
      );
    }
  }

  return Boolean(itemTime) && itemTime === expectedTime;
}

function getDoseStatus(
  medicine,
  schedule,
  history,
  todayKey
) {
  const dateKey = todayKey || getLocalDateKey();
  const list = Array.isArray(history) ? history : [];

  const medicationId = getMedicationId(medicine);
  const scheduleId = getScheduleId(schedule);
  const scheduleTime = getScheduleTime(schedule);

  const matches = list.filter((item) =>
    historyMatchesDose(
      item,
      medicationId,
      scheduleId,
      scheduleTime,
      dateKey
    )
  );

  if (matches.length === 0) {
    return {
      status: "PENDING",
      recorded: false,
      record: null,
    };
  }

  const finalRecords = matches.filter(
    (item) =>
      normalizeDoseStatus(item.status) !== "PENDING"
  );

  const pool =
    finalRecords.length > 0 ? finalRecords : matches;

  const latest = pool.reduce((best, item) => {
    if (!best) return item;

    const itemTime = getHistoryRecordTimestamp(item);
    const bestTime = getHistoryRecordTimestamp(best);

    if (itemTime !== bestTime) {
      return itemTime > bestTime ? item : best;
    }

    const itemId = Number(item.id);
    const bestId = Number(best.id);

    if (
      !Number.isNaN(itemId) &&
      !Number.isNaN(bestId) &&
      itemId !== bestId
    ) {
      return itemId > bestId ? item : best;
    }

    return best;
  }, null);

  const status = normalizeDoseStatus(latest?.status);

  return {
    status,
    recorded: status !== "PENDING",
    record: latest,
  };
}

function getDoseStatusStyles(status, nightMode) {
  if (status === "TAKEN") {
    return {
      container: nightMode
        ? "border-emerald-700 bg-emerald-950/40"
        : "border-emerald-200 bg-emerald-50",
      icon: "bg-emerald-100 text-emerald-700",
    };
  }

  if (status === "MISSED") {
    return {
      container: nightMode
        ? "border-rose-700 bg-rose-950/40"
        : "border-rose-200 bg-rose-50",
      icon: "bg-rose-100 text-rose-700",
    };
  }

  return {
    container: nightMode
      ? "border-amber-700 bg-amber-950/40"
      : "border-amber-200 bg-amber-50",
    icon: "bg-amber-100 text-amber-700",
  };
}

function speakText(text, language) {
  if (
    typeof window === "undefined" ||
    !window.speechSynthesis ||
    !text
  ) {
    return false;
  }

  window.speechSynthesis.cancel();

  const utterance =
    new SpeechSynthesisUtterance(text);

  utterance.lang =
    LANGUAGES.find(
      (item) => item.value === language
    )?.voice || "en-IN";

  utterance.rate = 0.62;
  utterance.pitch = 1;
  utterance.volume = 1;

  window.speechSynthesis.speak(utterance);

  return true;
}

function playAlarmSound(duration = 10000) {
  if (typeof window === "undefined") {
    return () => {};
  }

  let audioContext = null;
  let gainNode = null;
  let oscillator = null;
  let stopped = false;

  try {
    const AudioContext =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!AudioContext) {
      return () => {};
    }

    audioContext = new AudioContext();

    if (audioContext.state === "suspended") {
      audioContext.resume().catch(() => {});
    }

    gainNode =
      audioContext.createGain();

    oscillator =
      audioContext.createOscillator();

    oscillator.type = "sine";
    oscillator.frequency.value = 880;

    gainNode.gain.value = 0.18;

    oscillator.connect(gainNode);
    gainNode.connect(
      audioContext.destination
    );

    oscillator.start();

    const startedAt = Date.now();

    const interval = window.setInterval(() => {
      if (
        stopped ||
        Date.now() - startedAt >= duration
      ) {
        window.clearInterval(interval);
        return;
      }

      oscillator.frequency.value =
        oscillator.frequency.value === 880
          ? 660
          : 880;
    }, 500);

    window.setTimeout(() => {
      if (stopped) return;

      try {
        oscillator.stop();
      } catch {}

      try {
        audioContext.close();
      } catch {}
    }, duration);

    return () => {
      stopped = true;
      window.clearInterval(interval);

      try {
        oscillator.stop();
      } catch {}

      try {
        audioContext.close();
      } catch {}
    };
  } catch {
    return () => {};
  }
}

function MedicineReminders() {
  const navigate = useNavigate();

  const [medications, setMedications] =
    useState([]);

  const [history, setHistory] =
    useState([]);

  const [adherence, setAdherence] =
    useState(null);

  const [language, setLanguage] =
    useState("English");

  const [elderName, setElderName] =
    useState("there");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const [showForm, setShowForm] =
    useState(false);

  const [showHistory, setShowHistory] =
    useState(false);

  const [showLanguage, setShowLanguage] =
    useState(false);

  const [showReportMenu, setShowReportMenu] =
    useState(false);

  const [elderMode, setElderMode] =
    useState(false);

  const [nightMode, setNightMode] =
    useState(false);

  const [editingMedication, setEditingMedication] =
    useState(null);

  const [form, setForm] =
    useState(EMPTY_FORM);

  const [scheduleRows, setScheduleRows] =
    useState([{ ...EMPTY_SCHEDULE }]);

  const [activeReminder, setActiveReminder] =
    useState(null);

  const [missedReason, setMissedReason] =
    useState("");

  const [showMissedReason, setShowMissedReason] =
    useState(false);

  const [secondReminderTimers, setSecondReminderTimers] =
    useState({});

  const [reminderCheckRef] =
    useState(() => ({
      value: null,
    }));

  const reminderTimersRef =
    useRef({});

  const alarmStopRef =
    useRef(null);

  const voiceTimersRef =
    useRef([]);

  const fileInputRef =
    useRef(null);

  const [selectedPhoto, setSelectedPhoto] =
    useState(null);

  const [photoPreview, setPhotoPreview] =
    useState("");

  const [isTestingVoice, setIsTestingVoice] =
    useState(false);

  const [removedHistoryIds, setRemovedHistoryIds] =
    useState([]);

  const [todayKey, setTodayKey] =
    useState(() => getLocalDateKey());

  useEffect(() => {
    const interval = window.setInterval(() => {
      const currentKey = getLocalDateKey();

      setTodayKey((previous) =>
        previous === currentKey
          ? previous
          : currentKey
      );
    }, 60 * 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const clearMessages = useCallback(() => {
    setMessage("");
    setError("");
  }, []);

  const loadData = useCallback(
    async () => {
      setLoading(true);
      clearMessages();

      try {
        const config = getAuthConfig();

        const [
          medicationResponse,
          adherenceResponse,
          languageResponse,
        ] = await Promise.all([
          axios.get(
            `${API_BASE_URL}/medications`,
            config
          ),
          axios
            .get(
              `${API_BASE_URL}/medications/adherence`,
              config
            )
            .catch(() => null),
          axios
            .get(
              `${API_BASE_URL}/medications/language`,
              config
            )
            .catch(() => null),
        ]);

        const medicationData =
          medicationResponse?.data;

        const medicationList =
          Array.isArray(medicationData)
            ? medicationData
            : Array.isArray(
                medicationData?.medications
              )
              ? medicationData.medications
              : [];

        setMedications(
          medicationList.filter(
            (medicine) =>
              medicine?.is_active !== false
          )
        );

        if (adherenceResponse?.data) {
          setAdherence(
            adherenceResponse.data?.adherence ??
              adherenceResponse.data
          );
        }

        if (languageResponse?.data?.language) {
          setLanguage(
            languageResponse.data.language
          );
        }

        const firstMedicine =
          medicationList.find(
            (medicine) =>
              medicine?.elder_name ||
              medicine?.user_name ||
              medicine?.full_name
          );

        if (firstMedicine) {
          setElderName(
            firstMedicine.elder_name ||
              firstMedicine.user_name ||
              firstMedicine.full_name ||
              "there"
          );
        } else {
          try {
            const profileResponse =
              await axios.get(
                `${API_BASE_URL}/medications/language`,
                config
              );

            const name =
              profileResponse?.data?.elder_name;

            if (name) {
              setElderName(name);
            }
          } catch {}
        }
      } catch (err) {
        console.error(
          "Medication loading error:",
          err
        );

        setError(
          "Unable to load your medicines. Please make sure the Elder Sense backend is running."
        );
      } finally {
        setLoading(false);
      }
    },
    [clearMessages]
  );

  const loadHistory = useCallback(
    async () => {
      try {
        const response =
          await axios.get(
            `${API_BASE_URL}/medications/history`,
            {
              ...getAuthConfig(),
              params: {
                days: 30,
              },
            }
          );

        const data =
          response?.data;

        const items =
          Array.isArray(data)
            ? data
            : Array.isArray(data?.history)
              ? data.history
              : [];

        setHistory(
          items.map(normalizeHistoryItem)
        );
      } catch (err) {
        console.error(
          "Medication history error:",
          err
        );
      }
    },
    []
  );

  useEffect(() => {
    loadData();
    loadHistory();
  }, [loadData, loadHistory]);

  useEffect(() => {
    const firstMedicine =
      medications.find(
        (medicine) =>
          medicine?.elder_name ||
          medicine?.user_name ||
          medicine?.full_name
      );

    if (firstMedicine) {
      setElderName(
        firstMedicine.elder_name ||
          firstMedicine.user_name ||
          firstMedicine.full_name ||
          "there"
      );
    }
  }, [medications]);

  useEffect(() => {
    return () => {
      Object.values(
        reminderTimersRef.current
      ).forEach((timer) => {
        window.clearTimeout(timer);
      });

      if (alarmStopRef.current) {
        alarmStopRef.current();
      }

      voiceTimersRef.current.forEach((timer) => {
        window.clearTimeout(timer);
      });
      voiceTimersRef.current = [];

      if (
        typeof window !== "undefined" &&
        window.speechSynthesis
      ) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const activeMedications = useMemo(
    () =>
      medications.filter(
        (medicine) =>
          medicine?.is_active !== false
      ),
    [medications]
  );

  const allSchedules = useMemo(() => {
    const result = [];

    activeMedications.forEach(
      (medicine, medicineIndex) => {
        getSchedules(medicine).forEach(
          (schedule) => {
            result.push({
              medicine,
              schedule,
              medicineIndex,
            });
          }
        );
      }
    );

    return result.sort((a, b) => {
      return String(
        getScheduleTime(a.schedule)
      ).localeCompare(
        String(getScheduleTime(b.schedule))
      );
    });
  }, [activeMedications]);

  const nextMedicine = useMemo(() => {
    const now = new Date();

    const upcoming = allSchedules
      .map((item) => ({
        ...item,
        dateTime:
          getScheduleDateTime(
            item.schedule,
            now
          ),
      }))
      .filter(
        (item) =>
          item.dateTime &&
          item.dateTime >= now &&
          item.schedule?.is_active !== false
      )
      .sort(
        (a, b) =>
          a.dateTime - b.dateTime
      );

    if (upcoming.length > 0) {
      return upcoming[0];
    }

    return null;
  }, [allSchedules]);

  const timeline = useMemo(() => {
    const groups = {
      Morning: [],
      Afternoon: [],
      Evening: [],
      Night: [],
    };

    allSchedules.forEach((item) => {
      const time = getScheduleTime(
        item.schedule
      );

      if (!time) return;

      const hour = Number(
        String(time).split(":")[0]
      );

      if (hour < 12) {
        groups.Morning.push(item);
      } else if (hour < 17) {
        groups.Afternoon.push(item);
      } else if (hour < 21) {
        groups.Evening.push(item);
      } else {
        groups.Night.push(item);
      }
    });

    return groups;
  }, [allSchedules]);

  // Strictly accurate counts calculated from true history state
  const takenCount = useMemo(
    () =>
      history.filter(
        (item) =>
          String(item.status).toUpperCase() ===
          "TAKEN"
      ).length,
    [history]
  );

  const missedCount = useMemo(
    () =>
      history.filter(
        (item) =>
          String(item.status).toUpperCase() ===
          "MISSED"
      ).length,
    [history]
  );

  const pendingCount = useMemo(
    () =>
      history.filter(
        (item) =>
          String(item.status).toUpperCase() ===
          "PENDING"
      ).length,
    [history]
  );

  // Strictly true adherence percentage calculation
  const adherencePercentage = useMemo(() => {
    const totalRecorded = takenCount + missedCount;
    if (totalRecorded === 0) {
      if (adherence && typeof adherence === "number") return Math.round(adherence);
      if (adherence && typeof adherence === "object") {
        const val = adherence.percentage ?? adherence.adherence ?? adherence.rate;
        if (val !== undefined) return Math.round(Number(val) || 0);
      }
      return 0;
    }
    return Math.round((takenCount / totalRecorded) * 100);
  }, [adherence, takenCount, missedCount]);

  // Strictly calculated consecutive streak based on true taken days history
  const streak = useMemo(() => {
    if (
      adherence &&
      typeof adherence === "object" &&
      (adherence.streak !== undefined || adherence.current_streak !== undefined)
    ) {
      return adherence.streak ?? adherence.current_streak ?? 0;
    }

    const takenDates = new Set(
      history
        .filter(
          (item) =>
            String(item.status).toUpperCase() ===
            "TAKEN"
        )
        .map((item) => {
          const value =
            item.actual_taken_at ||
            item.scheduled_at;

          if (!value) return null;

          const date = new Date(value);

          if (Number.isNaN(date.getTime())) {
            return null;
          }

          return getLocalDateKey(date);
        })
        .filter(Boolean)
    );

    let count = 0;
    const today = new Date();

    for (let i = 0; i < 30; i += 1) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);

      if (
        takenDates.has(
          getLocalDateKey(date)
        )
      ) {
        count += 1;
      } else {
        // If today has no record yet, don't break streak immediately, check yesterday onwards
        if (i === 0 && takenDates.size > 0) continue;
        break;
      }
    }

    return count;
  }, [adherence, history]);

  const weeklyData = useMemo(() => {
    const days = [];
    const sunday = getWeekSunday();

    for (let i = 0; i < 7; i += 1) {
      const date = new Date(sunday);
      date.setDate(sunday.getDate() + i);

      const key = getLocalDateKey(date);

      const dayItems = history.filter((item) => {
        const value =
          item.scheduled_at || item.actual_taken_at;

        if (!value) return false;

        const itemDate = new Date(value);

        if (Number.isNaN(itemDate.getTime())) {
          return false;
        }

        return getLocalDateKey(itemDate) === key;
      });

      const taken = dayItems.filter(
        (item) =>
          String(item.status).toUpperCase() ===
          "TAKEN"
      ).length;

      const total = dayItems.length;

      days.push({
        key,
        label: date.toLocaleDateString("en-IN", {
          weekday: "short",
        }),
        dateLabel: date.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
        }),
        fullDateLabel: date.toLocaleDateString("en-IN", {
          weekday: "long",
          day: "numeric",
          month: "short",
        }),
        percentage:
          total > 0
            ? Math.round((taken / total) * 100)
            : 0,
        taken,
        total,
      });
    }

    return days;
  }, [history]);

  const triggerReminder = useCallback(
    (medicine, schedule, isFollowUp = false) => {
      const medicationId =
        getMedicationId(medicine);

      const scheduleId =
        getScheduleId(schedule);

      const reminderKey =
        `${medicationId}-${scheduleId}`;

      const name =
        getMedicineName(medicine);

      const dosage =
        getMedicineDosage(medicine);

      const time =
        formatTime(
          getScheduleTime(schedule)
        );

      const greeting =
        elderName &&
        elderName !== "there"
          ? elderName
          : "there";

      let voiceText = "";

      if (language === "Kannada") {
        voiceText = isFollowUp
          ? `${greeting}, ${name} ಔಷಧಿಯನ್ನು ಇನ್ನೂ ತೆಗೆದುಕೊಂಡಂತೆ ಗುರುತಿಸಲಾಗಿಲ್ಲ. ನೀವು ಔಷಧಿಯನ್ನು ತೆಗೆದುಕೊಂಡಿದ್ದರೆ ದಯವಿಟ್ಟು ಅದನ್ನು ಗುರುತಿಸಿ.`
          : `${greeting}, ಈಗ ${name} ಔಷಧಿಯನ್ನು ತೆಗೆದುಕೊಳ್ಳುವ ಸಮಯ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ಆರೋಗ್ಯದ ಬಗ್ಗೆ ಕಾಳಜಿ ವಹಿಸಿ. ಈಗಾಗಲೇ ತೆಗೆದುಕೊಂಡಿದ್ದರೆ Elder Sense ನಲ್ಲಿ ಗುರುತಿಸಿ.`;
      } else if (language === "Tamil") {
        voiceText = isFollowUp
          ? `${greeting}, ${name} மருந்து இன்னும் எடுத்ததாக பதிவு செய்யப்படவில்லை. நீங்கள் மருந்தை எடுத்திருந்தால் தயவுசெய்து பதிவு செய்யுங்கள்.`
          : `${greeting}, இப்போது ${name} மருந்தை எடுத்துக்கொள்ளும் நேரம். உங்கள் ஆரோக்கியத்தை கவனமாக பார்த்துக்கொள்ளுங்கள். ஏற்கனவே எடுத்திருந்தால் Elder Sense இல் பதிவு செய்யுங்கள்.`;
      } else if (language === "Telugu") {
        voiceText = isFollowUp
          ? `${greeting}, ${name} మందు ఇంకా తీసుకున్నట్లు గుర్తించబడలేదు. మీరు మందు తీసుకుని ఉంటే దయచేసి నమోదు చేయండి.`
          : `${greeting}, ఇప్పుడు ${name} మందు తీసుకునే సమయం.`;
      } else if (language === "Hindi") {
        voiceText = isFollowUp
          ? `${greeting}, ${name} दवा अभी तक ली हुई दर्ज नहीं हुई है। अगर आपने दवा ले ली है तो कृपया उसे दर्ज करें।`
          : `${greeting}, अब ${name} दवा लेने का समय है। कृपया अपनी सेहत का ध्यान रखें। दवा ले ली है तो Elder Sense में दर्ज करें।`;
      } else if (language === "Malayalam") {
        voiceText = isFollowUp
          ? `${greeting}, ${name} മരുന്ന് ഇതുവരെ എടുത്തതായി രേഖപ്പെടുത്തിയിട്ടില്ല. മരുന്ന് എടുത്തിട്ടുണ്ടെങ്കിൽ ദയവായി രേഖപ്പെടുത്തുക.`
          : `${greeting}, ഇപ്പോൾ ${name} മരുന്ന് കഴിക്കാനുള്ള സമയമാണ്.`;
      } else {
        voiceText = isFollowUp
          ? `${greeting}, please take your ${name} medicine now. It has not been marked as taken yet.`
          : `Hello ${greeting}. It is time to take your ${name}, ${dosage || "as prescribed"}. Please follow your prescription and take your health seriously. If you have already taken it, please tap I Took It in Elder Sense.`;
      }

      setActiveReminder({
        key: reminderKey,
        medicine,
        schedule,
        medicationId,
        scheduleId,
        dosage,
        time,
        isFollowUp,
        voiceText,
      });

      if (alarmStopRef.current) {
        alarmStopRef.current();
      }

      alarmStopRef.current =
        playAlarmSound(5000);

      voiceTimersRef.current.forEach((timer) => {
        window.clearTimeout(timer);
      });
      voiceTimersRef.current = [];

      const firstVoiceTimer = window.setTimeout(() => {
        speakText(voiceText, language);
      }, 5000);

      voiceTimersRef.current = [firstVoiceTimer];

      if (!isFollowUp) {
        const timer =
          window.setTimeout(() => {
            triggerReminder(
              medicine,
              schedule,
              true
            );
          }, 5 * 60 * 1000);

        reminderTimersRef.current[
          reminderKey
        ] = timer;

        setSecondReminderTimers(
          (current) => ({
            ...current,
            [reminderKey]: true,
          })
        );
      }
    },
    [elderName, language]
  );

  const checkScheduledReminders =
    useCallback(() => {
      const now = new Date();

      const currentKey =
        `${getLocalDateKey(now)}-${now.getHours()}-${now.getMinutes()}`;

      if (
        reminderCheckRef.value ===
        currentKey
      ) {
        return;
      }

      reminderCheckRef.value =
        currentKey;

      allSchedules.forEach(
        (item) => {
          const {
            medicine,
            schedule,
          } = item;

          if (
            schedule?.reminder_enabled ===
              false ||
            schedule?.is_active === false
          ) {
            return;
          }

          if (
            medicine?.is_active === false
          ) {
            return;
          }

          const scheduleTime =
            getScheduleTime(schedule);

          if (!scheduleTime) {
            return;
          }

          const [hour, minute] =
            String(scheduleTime)
              .split(":")
              .map(Number);

          if (
            Number.isNaN(hour) ||
            Number.isNaN(minute)
          ) {
            return;
          }

          if (
            hour !== now.getHours() ||
            minute !== now.getMinutes()
          ) {
            return;
          }

          const key =
            `${getMedicationId(medicine)}-${getScheduleId(schedule)}`;

          if (
            activeReminder?.key === key
          ) {
            return;
          }

          triggerReminder(
            medicine,
            schedule,
            false
          );
        }
      );
    }, [
      allSchedules,
      activeReminder,
      triggerReminder,
      reminderCheckRef,
    ]);

  useEffect(() => {
    const interval =
      window.setInterval(
        checkScheduledReminders,
        1000
      );

    return () => {
      window.clearInterval(interval);
    };
  }, [checkScheduledReminders]);

  const closeReminder = () => {
    if (alarmStopRef.current) {
      alarmStopRef.current();
      alarmStopRef.current = null;
    }

    voiceTimersRef.current.forEach((timer) => {
      window.clearTimeout(timer);
    });
    voiceTimersRef.current = [];

    if (
      typeof window !== "undefined" &&
      window.speechSynthesis
    ) {
      window.speechSynthesis.cancel();
    }

    setActiveReminder(null);
    setShowMissedReason(false);
    setMissedReason("");
  };

  const logMedication = async (
    status,
    reason = ""
  ) => {
    if (!activeReminder) {
      return;
    }

    const {
      medicationId,
      scheduleId,
      schedule,
    } = activeReminder;

    try {
      clearMessages();

      const response =
        await axios.post(
          `${API_BASE_URL}/medications/${medicationId}/log`,
          {
            schedule_id: scheduleId,
            status,
            scheduled_at:
              getLocalDateTimeString(
                getScheduleDateTime(
                  schedule
                ) || new Date()
              ),
            missed_reason:
              reason || undefined,
          },
          getAuthConfig()
        );

      if (alarmStopRef.current) {
        alarmStopRef.current();
        alarmStopRef.current = null;
      }

      const key =
        `${medicationId}-${scheduleId}`;

      if (
        reminderTimersRef.current[key]
      ) {
        window.clearTimeout(
          reminderTimersRef.current[key]
        );

        delete reminderTimersRef.current[
          key
        ];
      }

      setSecondReminderTimers(
        (current) => {
          const copy = {
            ...current,
          };

          delete copy[key];

          return copy;
        }
      );

      const loggedScheduledDate =
        getScheduleDateTime(schedule) ||
        new Date();

      const loggedDateKey =
        getLocalDateKey(loggedScheduledDate);

      const loggedItem =
        normalizeHistoryItem({
          id:
            response?.data?.id ??
            response?.data?.log?.id ??
            `local-${medicationId}-${scheduleId}-${Date.now()}`,
          medication_id: medicationId,
          schedule_id: scheduleId,
          medication_name:
            getMedicineName(
              activeReminder.medicine
            ),
          scheduled_at:
            getLocalDateTimeString(
              loggedScheduledDate
            ),
          actual_taken_at:
            status === "TAKEN"
              ? getLocalDateTimeString()
              : null,
          status,
          missed_reason:
            reason || null,
        });

      setHistory((current) => [
        loggedItem,
        ...current.filter(
          (item) =>
            !historyMatchesDose(
              item,
              medicationId,
              scheduleId,
              getScheduleTime(schedule),
              loggedDateKey
            )
        ),
      ]);

      await Promise.all([
        loadData(),
        loadHistory(),
      ]);

      if (
        response?.data?.message
      ) {
        setMessage(
          response.data.message
        );
      } else if (status === "TAKEN") {
        setMessage(
          `🎉 ${getMedicineName(
            activeReminder.medicine
          )} marked as taken.`
        );
      } else {
        setMessage(
          `${getMedicineName(
            activeReminder.medicine
          )} marked as missed.`
        );
      }

      closeReminder();
    } catch (err) {
      console.error(
        "Medication log error:",
        err
      );

      setError(
        err?.response?.data?.message ||
          "Unable to update the medication status."
      );
    }
  };

  const handleReminderTaken = () => {
    logMedication("TAKEN");
  };

  const handleReminderMissed = () => {
    setShowMissedReason(true);
  };

  const confirmMissed = () => {
    logMedication(
      "MISSED",
      missedReason || "Other"
    );
  };

  const openAddForm = () => {
    clearMessages();

    setEditingMedication(null);
    setForm(EMPTY_FORM);
    setScheduleRows([
      {
        ...EMPTY_SCHEDULE,
      },
    ]);

    setSelectedPhoto(null);
    setPhotoPreview("");
    setShowForm(true);
  };

  const openEditForm = (medicine) => {
    clearMessages();

    setEditingMedication(medicine);

    setForm({
      name:
        medicine?.name ||
        "",
      dosage:
        medicine?.dosage ||
        "",
      form:
        medicine?.form ||
        "Tablet",
      purpose:
        medicine?.purpose ||
        "",
      instructions:
        medicine?.instructions ||
        "",
      start_date:
        medicine?.start_date ||
        "",
      end_date:
        medicine?.end_date ||
        "",
    });

    const schedules =
      getSchedules(medicine);

    setScheduleRows(
      schedules.length > 0
        ? schedules.map(
            (schedule) => ({
              time:
                getScheduleTime(
                  schedule
                ) || "08:00",
              reminder_enabled:
                schedule?.reminder_enabled !==
                false,
              time_format:
                schedule?.time_format === "24h"
                  ? "24h"
                  : "12h",
              id:
                getScheduleId(
                  schedule
                ),
            })
          )
        : [
            {
              ...EMPTY_SCHEDULE,
            },
          ]
    );

    setSelectedPhoto(null);
    setPhotoPreview(
      medicine?.photo_url ||
        medicine?.photo_path ||
        ""
    );

    setShowForm(true);
  };

  const updateFormField = (
    field,
    value
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const updateSchedule = (
    index,
    field,
    value
  ) => {
    setScheduleRows((current) =>
      current.map(
        (row, rowIndex) =>
          rowIndex === index
            ? {
                ...row,
                [field]: value,
              }
            : row
      )
    );
  };

  const addScheduleRow = () => {
    setScheduleRows((current) => [
      ...current,
      {
        ...EMPTY_SCHEDULE,
      },
    ]);
  };

  const removeScheduleRow = (
    index
  ) => {
    setScheduleRows((current) => {
      if (current.length <= 1) {
        return current;
      }

      return current.filter(
        (_, rowIndex) =>
          rowIndex !== index
      );
    });
  };

  const handlePhotoChange = (event) => {
    const file =
      event.target.files?.[0];

    if (!file) return;

    if (
      !file.type.startsWith("image/")
    ) {
      setError(
        "Please select an image file."
      );

      return;
    }

    if (
      file.size >
      5 * 1024 * 1024
    ) {
      setError(
        "Medicine photo must be smaller than 5 MB."
      );

      return;
    }

    setSelectedPhoto(file);

    const reader =
      new FileReader();

    reader.onload = () => {
      setPhotoPreview(
        String(reader.result || "")
      );
    };

    reader.readAsDataURL(file);
  };

  const uploadPhotoIfNeeded = async (
    medicationId
  ) => {
    if (
      !selectedPhoto ||
      !medicationId
    ) {
      return;
    }

    const formData =
      new FormData();

    formData.append(
      "photo",
      selectedPhoto
    );

    await axios.post(
      `${API_BASE_URL}/medications/${medicationId}/photo`,
      formData,
      {
        ...getAuthConfig(),
        headers: {
          ...getAuthConfig().headers,
          "Content-Type":
            "multipart/form-data",
        },
      }
    );
  };

  const saveMedication = async (
    event
  ) => {
    event.preventDefault();

    clearMessages();

    if (!form.name.trim()) {
      setError(
        "Please enter the medicine name."
      );

      return;
    }

    if (!form.dosage.trim()) {
      setError(
        "Please enter the dosage."
      );

      return;
    }

    const validSchedules =
      scheduleRows.filter(
        (row) =>
          row.time &&
          /^\d{2}:\d{2}$/.test(
            row.time
          )
      );

    if (
      validSchedules.length ===
      0
    ) {
      setError(
        "Please add at least one valid medicine time."
      );

      return;
    }

    setSaving(true);

    try {
      const config =
        getAuthConfig();

      let medicationId =
        getMedicationId(
          editingMedication
        );

      if (editingMedication) {
        await axios.put(
          `${API_BASE_URL}/medications/${medicationId}`,
          {
            name:
              form.name.trim(),
            dosage:
              form.dosage.trim(),
            form:
              form.form,
            purpose:
              form.purpose.trim(),
            instructions:
              form.instructions.trim(),
            start_date:
              form.start_date ||
              null,
            end_date:
              form.end_date ||
              null,
          },
          config
        );

        const existingSchedules =
          getSchedules(
            editingMedication
          );

        const keptIds =
          validSchedules
            .map(
              (row) =>
                row.id
            )
            .filter(Boolean);

        for (
          const oldSchedule of existingSchedules
        ) {
          const oldId =
            getScheduleId(
              oldSchedule
            );

          if (
            oldId &&
            !keptIds.includes(oldId)
          ) {
            try {
              await axios.delete(
                `${API_BASE_URL}/medications/${medicationId}/schedules/${oldId}`,
                config
              );
            } catch {
              try {
                await axios.delete(
                  `${API_BASE_URL}/medications/${medicationId}/schedule/${oldId}`,
                  config
                );
              } catch {}
            }
          }
        }

        for (
          const row of validSchedules
        ) {
          const payload = {
            time: row.time,
            reminder_enabled:
              row.reminder_enabled !==
              false,
          };

          if (row.id) {
            try {
              await axios.put(
                `${API_BASE_URL}/medications/${medicationId}/schedules/${row.id}`,
                payload,
                config
              );
            } catch {
              await axios.patch(
                `${API_BASE_URL}/medications/${medicationId}/schedules/${row.id}`,
                payload,
                config
              );
            }
          } else {
            await axios.post(
              `${API_BASE_URL}/medications/${medicationId}/schedule`,
              payload,
              config
            );
          }
        }
      } else {
        const response =
          await axios.post(
            `${API_BASE_URL}/medications`,
            {
              name:
                form.name.trim(),
              dosage:
                form.dosage.trim(),
              form:
                form.form,
              purpose:
                form.purpose.trim(),
              instructions:
                form.instructions.trim(),
              start_date:
                form.start_date ||
                null,
              end_date:
                form.end_date ||
                null,
              schedules:
                validSchedules.map(
                  (row) => ({
                    time: row.time,
                    reminder_enabled:
                      row.reminder_enabled !==
                      false,
                  })
                ),
            },
            config
          );

        medicationId =
          response?.data?.id ??
          response?.data
            ?.medication?.id ??
          response?.data
            ?.medication_id;
      }

      await uploadPhotoIfNeeded(
        medicationId
      );

      setMessage(
        editingMedication
          ? "✅ Medicine updated successfully."
          : "✅ Medicine added successfully."
      );

      setShowForm(false);
      setEditingMedication(null);
      setSelectedPhoto(null);
      setPhotoPreview("");

      await Promise.all([
        loadData(),
        loadHistory(),
      ]);
    } catch (err) {
      console.error(
        "Save medication error:",
        err
      );

      setError(
        err?.response?.data?.message ||
          "Unable to save the medicine."
      );
    } finally {
      setSaving(false);
    }
  };

  const removeMedication = async (
    medicine
  ) => {
    const medicationId =
      getMedicationId(medicine);

    if (!medicationId) return;

    const confirmed =
      window.confirm(
        `Remove ${getMedicineName(
          medicine
        )} from your active medicines?`
      );

    if (!confirmed) return;

    try {
      clearMessages();

      await axios.delete(
        `${API_BASE_URL}/medications/${medicationId}`,
        getAuthConfig()
      );

      setMessage(
        `🗑️ ${getMedicineName(
          medicine
        )} removed successfully.`
      );

      await Promise.all([
        loadData(),
        loadHistory(),
      ]);
    } catch (err) {
      console.error(
        "Remove medication error:",
        err
      );

      setError(
        err?.response?.data?.message ||
          "Unable to remove the medicine."
      );
    }
  };

  const toggleReminder = async (
    medicine,
    schedule
  ) => {
    const medicationId =
      getMedicationId(medicine);

    const scheduleId =
      getScheduleId(schedule);

    if (
      !medicationId ||
      !scheduleId
    ) {
      return;
    }

    const enabled =
      schedule?.reminder_enabled !==
      false;

    try {
      await axios.patch(
        `${API_BASE_URL}/medications/${medicationId}/schedule/${scheduleId}/reminder`,
        {
          reminder_enabled:
            !enabled,
        },
        getAuthConfig()
      );

      setMedications(
        (current) =>
          current.map(
            (item) => {
              if (
                getMedicationId(
                  item
                ) !==
                medicationId
              ) {
                return item;
              }

              return {
                ...item,
                schedules:
                  getSchedules(
                    item
                  ).map(
                    (row) =>
                      getScheduleId(
                        row
                      ) ===
                      scheduleId
                        ? {
                            ...row,
                            reminder_enabled:
                              !enabled,
                          }
                        : row
                  ),
              };
            }
          )
      );
    } catch (err) {
      console.error(
        "Reminder toggle error:",
        err
      );

      setError(
        err?.response?.data?.message ||
          "Unable to change reminder status."
      );
    }
  };

  const saveLanguage = async (
    value
  ) => {
    try {
      await axios.put(
        `${API_BASE_URL}/medications/language`,
        {
          language: value,
        },
        getAuthConfig()
      );

      setLanguage(value);
      setShowLanguage(false);

      setMessage(
        `🔊 Reminder language changed to ${value}.`
      );
    } catch (err) {
      console.error(
        "Language update error:",
        err
      );

      setError(
        err?.response?.data?.message ||
          "Unable to update reminder language."
      );
    }
  };

  const testVoice = () => {
    setIsTestingVoice(true);

    const selected =
      LANGUAGES.find(
        (item) =>
          item.value === language
      );

    const greeting =
      elderName &&
      elderName !== "there"
        ? elderName
        : "there";

    let text = "";

    if (language === "Kannada") {
      text = `ನಮಸ್ಕಾರ ${greeting}, ಇದು Elder Sense ಔಷಧಿ ನೆನಪಿನ ಪರೀಕ್ಷೆ.`;
    } else if (
      language === "Tamil"
    ) {
      text = `வணக்கம் ${greeting}, இது Elder Sense மருந்து நினைவூட்டல் சோதனை.`;
    } else if (
      language === "Telugu"
    ) {
      text = `నమస్కారం ${greeting}, ఇది Elder Sense మందుల రిమైండర్ పరీక్ష.`;
    } else if (
      language === "Hindi"
    ) {
      text = `नमस्ते ${greeting}, यह Elder Sense दवा रिमाइंडर का परीक्षण है।`;
    } else if (
      language === "Malayalam"
    ) {
      text = `നമസ്കാരം ${greeting}, ഇത് Elder Sense മരുന്ന് ഓർമ്മപ്പെടുത്തൽ പരിശോധനയാണ്.`;
    } else {
      text = `Hello ${greeting}, this is your Elder Sense medicine reminder voice test.`;
    }

    speakText(
      text,
      selected?.value ||
        "English"
    );

    window.setTimeout(() => {
      setIsTestingVoice(false);
    }, 3000);
  };

  // Fixed real-time deletion: calls backend API and updates local history state immediately without refresh
  const removeHistoryItem = async (item) => {
    const historyId = item?.id;

    if (historyId === undefined || historyId === null) {
      setMessage(
        "This history record cannot be removed because it has no record ID."
      );
      return;
    }

    const confirmed = window.confirm(
      `Remove this ${item.medication_name || "medicine"} history record permanently?`
    );

    if (!confirmed) return;

    try {
      clearMessages();
      
      // Send delete request to backend endpoint for history logs
      await axios.delete(
        `${API_BASE_URL}/medications/history/${historyId}`,
        getAuthConfig()
      ).catch(async () => {
        // Fallback endpoint shape if path differs
        await axios.delete(
          `${API_BASE_URL}/medications/logs/${historyId}`,
          getAuthConfig()
        );
      });

      // Update state instantly so it disappears without a page refresh
      setHistory((current) => current.filter((h) => h.id !== historyId));
      setRemovedHistoryIds((current) => [...current, historyId]);

      setMessage("🗑️ History record successfully deleted.");
    } catch (err) {
      console.error("Delete history error:", err);
      // Fallback UI-only filter if backend route isn't strictly defined yet
      setHistory((current) => current.filter((h) => h.id !== historyId));
      setMessage("🗑️ History record removed from view.");
    }
  };

  const visibleHistory = useMemo(
    () =>
      history.filter(
        (item) =>
          !removedHistoryIds.includes(item?.id)
      ),
    [history, removedHistoryIds]
  );

  const downloadReport = async () => {
    try {
      setShowReportMenu(false);

      const response =
        await axios.get(
          `${API_BASE_URL}/medications/report`,
          {
            ...getAuthConfig(),
            responseType: "blob",
          }
        );

      const blob =
        new Blob(
          [response.data],
          {
            type:
              "text/csv;charset=utf-8;",
          }
        );

      const url =
        window.URL.createObjectURL(
          blob
        );

      const link =
        document.createElement(
          "a"
        );

      link.href = url;
      link.download =
        `elder-sense-medication-report-${getLocalDateKey()}.csv`;

      document.body.appendChild(
        link
      );

      link.click();
      link.remove();

      window.URL.revokeObjectURL(
        url
      );

      setMessage(
        "📄 Medication report downloaded."
      );
    } catch (err) {
      console.error(
        "Report download error:",
        err
      );

      setError(
        err?.response?.data?.message ||
          "Unable to download the medication report."
      );
    }
  };

  const todayTimeline =
    useMemo(() => {
      const today =
        getLocalDateKey();

      return Object.entries(
        timeline
      ).map(
        ([
          period,
          items,
        ]) => ({
          period,
          items: items.filter(
            ({
              schedule,
            }) => {
              const date =
                getScheduleDateTime(
                  schedule
                );

              if (!date) return false;

              return (
                getLocalDateKey(
                  date
                ) === today
              );
            }
          ),
        })
      );
    }, [timeline]);

  const pageClass =
    nightMode
      ? "min-h-screen bg-slate-950 text-slate-100"
      : "min-h-screen bg-[#f4fbfa] text-slate-800";

  const surfaceClass =
    nightMode
      ? "border-slate-800 bg-slate-900"
      : "border-slate-100 bg-white";

  const secondaryTextClass =
    nightMode
      ? "text-slate-400"
      : "text-slate-500";

  return (
    <div
      className={`${pageClass} ${
        elderMode
          ? "text-[1.08rem]"
          : ""
      }`}
    >
      {/* Header */}
      <header
        className={`sticky top-0 z-30 border-b backdrop-blur-xl ${
          nightMode
            ? "border-slate-800 bg-slate-950/90"
            : "border-slate-200/70 bg-white/90"
        }`}
      >
        <div className="mx-auto flex min-h-20 max-w-[1500px] flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                navigate("/dashboard")
              }
              className={`flex h-11 w-11 items-center justify-center rounded-xl transition ${
                nightMode
                  ? "bg-slate-900 text-slate-300 hover:bg-slate-800"
                  : "bg-slate-50 text-slate-600 hover:bg-cyan-50 hover:text-cyan-600"
              }`}
              aria-label="Back to dashboard"
            >
              ←
            </button>

            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 via-teal-500 to-emerald-500 text-2xl shadow-lg shadow-cyan-100">
              💊
            </div>

            <div>
              <h1
                className={`font-bold ${
                  elderMode
                    ? "text-xl"
                    : "text-lg"
                } ${
                  nightMode
                    ? "text-white"
                    : "text-slate-800"
                }`}
              >
                Medication Reminders
              </h1>

              <p
                className={`hidden text-xs sm:block ${secondaryTextClass}`}
              >
                Stay on track with your medicines
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setElderMode(
                  (value) => !value
                )
              }
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                elderMode
                  ? "bg-cyan-500 text-white"
                  : nightMode
                    ? "bg-slate-900 text-slate-300"
                    : "bg-cyan-50 text-cyan-700"
              }`}
            >
              🧓 Elder Mode
            </button>

            <button
              type="button"
              onClick={() =>
                setNightMode(
                  (value) => !value
                )
              }
              className={`flex h-11 w-11 items-center justify-center rounded-xl transition ${
                nightMode
                  ? "bg-slate-800 text-amber-300"
                  : "bg-slate-50 text-slate-600 hover:bg-amber-50 hover:text-amber-600"
              }`}
              aria-label="Toggle night mode"
            >
              {nightMode ? (
                <Sun size={19} />
              ) : (
                <Moon size={19} />
              )}
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() =>
                  setShowLanguage(
                    (value) => !value
                  )
                }
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold ${
                  nightMode
                    ? "bg-slate-900 text-slate-300"
                    : "bg-slate-50 text-slate-700"
                }`}
              >
                <Languages size={17} />
                {language}
                <ChevronDown size={15} />
              </button>

              {showLanguage && (
                <div
                  className={`absolute right-0 top-14 z-50 w-52 rounded-2xl border p-2 shadow-xl ${
                    nightMode
                      ? "border-slate-700 bg-slate-900"
                      : "border-slate-100 bg-white"
                  }`}
                >
                  {LANGUAGES.map(
                    (item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() =>
                          saveLanguage(
                            item.value
                          )
                        }
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm transition ${
                          language ===
                          item.value
                            ? "bg-cyan-50 font-semibold text-cyan-700"
                            : nightMode
                              ? "text-slate-300 hover:bg-slate-800"
                              : "text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {item.label}

                        {language ===
                          item.value && (
                          <Check
                            size={16}
                          />
                        )}
                      </button>
                    )
                  )}

                  <div className="mt-2 border-t border-slate-100 pt-2">
                    <button
                      type="button"
                      onClick={testVoice}
                      disabled={
                        isTestingVoice
                      }
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-3 py-3 text-sm font-semibold text-white transition hover:bg-cyan-600 disabled:opacity-60"
                    >
                      <Volume2
                        size={16}
                      />
                      {isTestingVoice
                        ? "Playing..."
                        : "Test Voice"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={openAddForm}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-cyan-100 transition hover:from-cyan-600 hover:to-teal-600"
            >
              <Plus size={18} />
              Add Medicine
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-5 py-7 sm:px-8">
        {/* Messages */}
        {message && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-emerald-800">
            <CheckCircle2
              size={20}
              className="mt-0.5 shrink-0"
            />

            <p className="text-sm font-semibold">
              {message}
            </p>

            <button
              type="button"
              onClick={() =>
                setMessage("")
              }
              className="ml-auto"
            >
              <X size={17} />
            </button>
          </div>
        )}

        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-rose-800">
            <AlertCircle
              size={20}
              className="mt-0.5 shrink-0"
            />

            <p className="text-sm font-semibold">
              {error}
            </p>

            <button
              type="button"
              onClick={() =>
                setError("")
              }
              className="ml-auto"
            >
              <X size={17} />
            </button>
          </div>
        )}

        {/* Hero */}
        <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-cyan-500 via-teal-500 to-emerald-500 p-7 text-white shadow-xl shadow-cyan-100 sm:p-10">
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/10" />

          <div className="absolute -bottom-28 right-28 h-80 w-80 rounded-full bg-white/10" />

          <div className="relative z-10 grid gap-8 lg:grid-cols-[1fr_360px] lg:items-center">
            <div>
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-3xl backdrop-blur-sm">
                💊
              </div>

              <p className="text-sm font-semibold text-cyan-50">
                Elder Sense Medication Care
              </p>

              <h2
                className={`mt-2 font-bold ${
                  elderMode
                    ? "text-4xl"
                    : "text-3xl sm:text-4xl"
                }`}
              >
                Never miss an important medicine.
              </h2>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-cyan-50 sm:text-base">
                Manage your medicine schedule, receive voice
                reminders, track adherence, and keep your caregiver
                informed when a dose is missed.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold backdrop-blur-sm">
                  <Bell size={16} />
                  Smart reminders
                </span>

                <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold backdrop-blur-sm">
                  <Volume2 size={16} />
                  Voice enabled
                </span>

                <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold backdrop-blur-sm">
                  <ShieldCheck size={16} />
                  Caregiver support
                </span>
              </div>
            </div>

            <div className="rounded-[2rem] bg-white/15 p-6 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-2xl">
                  ⏰
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-cyan-50">
                    Next medicine
                  </p>

                  <p className="text-lg font-bold">
                    {nextMedicine
                      ? getMedicineName(
                          nextMedicine.medicine
                        )
                      : "No medicines scheduled"}
                  </p>
                </div>
              </div>

              {nextMedicine && (
                <>
                  <div className="mt-5 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-3xl font-bold">
                        {formatTime(
                          getScheduleTime(
                            nextMedicine.schedule
                          )
                        )}
                      </p>

                      <p className="mt-1 text-sm text-cyan-50">
                        {getMedicineDosage(
                          nextMedicine.medicine
                        )}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-white/15 px-4 py-3 text-right">
                      <p className="text-xs text-cyan-50">
                        Reminder
                      </p>

                      <p className="font-bold">
                        {nextMedicine.schedule
                          ?.reminder_enabled !==
                        false
                          ? "ON"
                          : "OFF"}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={<TrendingUp size={22} />}
            title="7-Day Adherence"
            value={`${adherencePercentage}%`}
            subtitle="Medication consistency"
            tone="cyan"
            nightMode={nightMode}
          />

          <StatCard
            icon={<Flame size={22} />}
            title="Medication Streak"
            value={`${streak} ${
              streak === 1
                ? "day"
                : "days"
            }`}
            subtitle={
              streak > 0
                ? "Keep going! 🔥"
                : "Start your streak today"
            }
            tone="amber"
            nightMode={nightMode}
          />

          <StatCard
            icon={<CheckCircle2 size={22} />}
            title="Taken"
            value={takenCount}
            subtitle="Recorded doses"
            tone="emerald"
            nightMode={nightMode}
          />

          <StatCard
            icon={<AlertCircle size={22} />}
            title="Missed"
            value={missedCount}
            subtitle={
              pendingCount > 0
                ? `${pendingCount} pending`
                : "No pending doses"
            }
            tone="rose"
            nightMode={nightMode}
          />
        </section>

        {/* Main content */}
        <div className="mt-6 grid gap-6 xl:grid-cols-[1.55fr_0.95fr]">
          {/* Medicines */}
          <section
            className={`overflow-hidden rounded-[2rem] border shadow-sm ${surfaceClass}`}
          >
            <div className="flex flex-col gap-4 border-b border-slate-100 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
                    <Pill size={21} />
                  </div>

                  <div>
                    <h3
                      className={`text-xl font-bold ${
                        nightMode
                          ? "text-white"
                          : "text-slate-800"
                      }`}
                    >
                      My Medicines
                    </h3>

                    <p
                      className={`text-sm ${secondaryTextClass}`}
                    >
                      {activeMedications.length} active{" "}
                      {activeMedications.length ===
                      1
                        ? "medicine"
                        : "medicines"}
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={openAddForm}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-cyan-600"
              >
                <Plus size={17} />
                Add Medicine
              </button>
            </div>

            <div className="p-5 sm:p-6">
              {loading ? (
                <LoadingState />
              ) : activeMedications.length ===
                0 ? (
                <EmptyMedicines
                  onAdd={
                    openAddForm
                  }
                  nightMode={
                    nightMode
                  }
                />
              ) : (
                <div className="grid gap-4">
                  {activeMedications.map(
                    (
                      medicine,
                      index
                    ) => (
                      <MedicineCard
                        key={
                          getMedicationId(
                            medicine
                          ) ??
                          index
                        }
                        medicine={
                          medicine
                        }
                        history={history}
                        todayKey={todayKey}
                        index={
                          index
                        }
                        nightMode={
                          nightMode
                        }
                        onEdit={() =>
                          openEditForm(
                            medicine
                          )
                        }
                        onDelete={() =>
                          removeMedication(
                            medicine
                          )
                        }
                        onToggleReminder={
                          toggleReminder
                        }
                      />
                    )
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Timeline */}
          <section
            className={`overflow-hidden rounded-[2rem] border shadow-sm ${surfaceClass}`}
          >
            <div className="border-b border-slate-100 p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <CalendarDays size={21} />
                </div>

                <div>
                  <h3
                    className={`text-xl font-bold ${
                      nightMode
                        ? "text-white"
                        : "text-slate-800"
                    }`}
                  >
                    Today's Timeline
                  </h3>

                  <p
                    className={`text-sm ${secondaryTextClass}`}
                  >
                    Your medicine schedule at a glance
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              <div className="space-y-5">
                {todayTimeline.map(
                  ({
                    period,
                    items,
                  }) => (
                    <TimelineGroup
                      key={period}
                      period={period}
                      items={items}
                      nightMode={
                        nightMode
                      }
                    />
                  )
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Weekly adherence */}
        <section
          className={`mt-6 rounded-[2rem] border p-6 shadow-sm ${surfaceClass} sm:p-7`}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                  <Activity size={21} />
                </div>

                <div>
                  <h3
                    className={`text-xl font-bold ${
                      nightMode
                        ? "text-white"
                        : "text-slate-800"
                    }`}
                  >
                    7-Day Medication Adherence
                  </h3>

                  <p
                    className={`text-sm ${secondaryTextClass}`}
                  >
                    See how consistently your medicines are being
                    recorded.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-violet-50 px-5 py-3 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-500">
                Overall
              </p>

              <p className="text-2xl font-bold text-violet-700">
                {adherencePercentage}%
              </p>
            </div>
          </div>

          <div className="mt-7 grid grid-cols-7 gap-2 sm:gap-4">
            {weeklyData.map(
              (day) => (
                <div
                  key={day.key}
                  className="text-center"
                >
                  <p
                    className={`text-xs font-semibold ${
                      nightMode
                        ? "text-slate-400"
                        : "text-slate-500"
                    }`}
                  >
                    {day.label}
                  </p>

                  <p
                    className={`mt-0.5 text-[11px] font-semibold ${
                      nightMode
                        ? "text-slate-500"
                        : "text-slate-400"
                    }`}
                  >
                    {day.dateLabel}
                  </p>

                  <div className="mx-auto mt-2 flex h-28 max-w-12 items-end rounded-xl bg-slate-100 p-1">
                    <div
                      className="w-full rounded-lg bg-gradient-to-t from-cyan-500 to-emerald-400 transition-all"
                      style={{
                        height: `${
                          Math.max(
                            day.percentage,
                            day.total > 0
                              ? 8
                              : 2
                          )
                        }%`,
                      }}
                    />
                  </div>

                  <p
                    className={`mt-2 text-sm font-bold ${
                      nightMode
                        ? "text-white"
                        : "text-slate-700"
                    }`}
                  >
                    {day.percentage}%
                  </p>

                  <p
                    className={`text-[11px] ${secondaryTextClass}`}
                  >
                    {day.taken}/
                    {day.total}
                  </p>
                </div>
              )
            )}
          </div>
        </section>

        {/* History */}
        <section
          className={`mt-6 overflow-hidden rounded-[2rem] border shadow-sm ${surfaceClass}`}
        >
          <button
            type="button"
            onClick={() =>
              setShowHistory(
                (value) => !value
              )
            }
            className="flex w-full items-center justify-between p-6 text-left"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                <History size={21} />
              </div>

              <div>
                <h3
                  className={`text-xl font-bold ${
                    nightMode
                      ? "text-white"
                      : "text-slate-800"
                  }`}
                >
                  Medication History
                </h3>

                <p
                  className={`text-sm ${secondaryTextClass}`}
                >
                  Recent medication activity
                </p>
              </div>
            </div>

            <ChevronDown
              size={21}
              className={`transition-transform ${
                showHistory
                  ? "rotate-180"
                  : ""
              }`}
            />
          </button>

          {showHistory && (
            <div className="border-t border-slate-100 p-5 sm:p-6">
              {visibleHistory.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 p-7 text-center">
                  <History
                    size={30}
                    className="mx-auto text-slate-300"
                  />

                  <p className="mt-3 font-semibold text-slate-600">
                    No medication history yet.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left">
                    <thead>
                      <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                        <th className="px-3 py-3">
                          Medicine
                        </th>

                        <th className="px-3 py-3">
                          Scheduled
                        </th>

                        <th className="px-3 py-3">
                          Marked
                        </th>

                        <th className="px-3 py-3">
                          Status
                        </th>

                        <th className="px-3 py-3">
                          Reason
                        </th>

                        <th className="px-3 py-3 text-right">
                          Action
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {visibleHistory
                        .slice(0, 30)
                        .map(
                          (
                            item,
                            index
                          ) => (
                            <tr
                              key={
                                item.id ??
                                index
                              }
                              className="border-b border-slate-50 last:border-0"
                            >
                              <td className="px-3 py-4">
                                <p className="font-semibold text-slate-700">
                                  {
                                    item.medication_name
                                  }
                                </p>
                              </td>

                              <td className="px-3 py-4 text-sm text-slate-500">
                                {formatDateTime(
                                  item.scheduled_at
                                )}
                              </td>

                              <td className="px-3 py-4 text-sm text-slate-500">
                                {item.actual_taken_at
                                  ? `Marked as taken at ${formatTime(
                                      new Date(
                                        item.actual_taken_at
                                      )
                                        .toTimeString()
                                        .slice(
                                          0,
                                          5
                                        )
                                    )}`
                                  : "—"}
                              </td>

                              <td className="px-3 py-4">
                                <StatusBadge
                                  status={
                                    item.status
                                  }
                                />
                              </td>

                              <td className="px-3 py-4 text-sm text-slate-500">
                                {item.missed_reason ||
                                  "—"}
                              </td>

                              <td className="px-3 py-4 text-right">
                                <button
                                  type="button"
                                  onClick={() =>
                                    removeHistoryItem(item)
                                  }
                                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100"
                                  title="Remove this record from the history view"
                                >
                                  <Trash2 size={14} />
                                  Remove
                                </button>
                              </td>
                            </tr>
                          )
                        )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Reports + safety */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section
            className={`rounded-[2rem] border p-6 shadow-sm ${surfaceClass}`}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
                <Download size={21} />
              </div>

              <div>
                <h3
                  className={`text-xl font-bold ${
                    nightMode
                      ? "text-white"
                      : "text-slate-800"
                  }`}
                >
                  Medication Report
                </h3>

                <p
                  className={`text-sm ${secondaryTextClass}`}
                >
                  Share medication activity with your caregiver or
                  doctor.
                </p>
              </div>
            </div>

            <div className="relative mt-5">
              <button
                type="button"
                onClick={() =>
                  setShowReportMenu(
                    (value) => !value
                  )
                }
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-teal-500 px-5 py-4 font-bold text-white shadow-lg shadow-cyan-100 transition hover:from-cyan-600 hover:to-teal-600"
              >
                <Download size={19} />
                Download Medication Report
                <ChevronDown size={17} />
              </button>

              {showReportMenu && (
                <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl">
                  <button
                    type="button"
                    onClick={
                      downloadReport
                    }
                    className="flex w-full items-center gap-3 px-4 py-4 text-left text-sm font-semibold text-slate-700 hover:bg-cyan-50 hover:text-cyan-700"
                  >
                    <Download
                      size={17}
                    />
                    Download CSV Report
                  </button>
                </div>
              )}
            </div>
          </section>

          <section
            className={`rounded-[2rem] border border-amber-100 bg-amber-50 p-6 shadow-sm`}
          >
            <div className="flex gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-amber-600">
                <ShieldCheck size={21} />
              </div>

              <div>
                <h3 className="font-bold text-amber-900">
                  Medication safety
                </h3>

                <p className="mt-2 text-sm leading-6 text-amber-800">
                  Elder Sense records when a dose is marked as
                  taken. It cannot verify that the medicine was
                  physically swallowed. Always follow your doctor's
                  prescription and contact a healthcare professional
                  if you have concerns.
                </p>

                <p className="mt-3 text-xs font-semibold text-amber-700">
                  Keep this page open for browser-based alarm and
                  voice reminders to work reliably.
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Add/Edit Medicine Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="mx-auto my-6 max-w-3xl overflow-hidden rounded-[2rem] bg-white shadow-2xl">
            <div className="bg-gradient-to-br from-cyan-500 via-teal-500 to-emerald-500 p-6 text-white sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-cyan-50">
                    Elder Sense
                  </p>

                  <h2 className="mt-1 text-2xl font-bold">
                    {editingMedication
                      ? "Edit Medicine"
                      : "Add Medicine"}
                  </h2>

                  <p className="mt-2 text-sm text-cyan-50">
                    Add the medicine details and the times you want
                    Elder Sense to remind you.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowForm(false)
                  }
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 transition hover:bg-white/25"
                >
                  <X size={19} />
                </button>
              </div>
            </div>

            <form
              onSubmit={saveMedication}
              className="p-6 sm:p-7"
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <FormInput
                  label="Medicine Name"
                  value={form.name}
                  onChange={(value) =>
                    updateFormField(
                      "name",
                      value
                    )
                  }
                  placeholder="Example: Metformin"
                  required
                />

                <FormInput
                  label="Dosage"
                  value={form.dosage}
                  onChange={(value) =>
                    updateFormField(
                      "dosage",
                      value
                    )
                  }
                  placeholder="Example: 500 mg"
                  required
                />

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Medicine Form
                  </label>

                  <select
                    value={form.form}
                    onChange={(event) =>
                      updateFormField(
                        "form",
                        event.target.value
                      )
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-800 outline-none focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                  >
                    <option>
                      Tablet
                    </option>
                    <option>
                      Capsule
                    </option>
                    <option>
                      Syrup
                    </option>
                    <option>
                      Injection
                    </option>
                    <option>
                      Drops
                    </option>
                    <option>
                      Other
                    </option>
                  </select>
                </div>

                <FormInput
                  label="Purpose"
                  value={form.purpose}
                  onChange={(value) =>
                    updateFormField(
                      "purpose",
                      value
                    )
                  }
                  placeholder="Example: Diabetes"
                />

                <FormInput
                  label="Start Date"
                  type="date"
                  value={form.start_date}
                  onChange={(value) =>
                    updateFormField(
                      "start_date",
                      value
                    )
                  }
                />

                <FormInput
                  label="End Date"
                  type="date"
                  value={form.end_date}
                  onChange={(value) =>
                    updateFormField(
                      "end_date",
                      value
                    )
                  }
                />
              </div>

              <div className="mt-5">
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Instructions
                </label>

                <textarea
                  value={
                    form.instructions
                  }
                  onChange={(event) =>
                    updateFormField(
                      "instructions",
                      event.target.value
                    )
                  }
                  rows={3}
                  placeholder="Example: Take after breakfast."
                  className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-800 outline-none focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                />
              </div>

              {/* Schedules */}
              <div className="mt-7 rounded-3xl border border-cyan-100 bg-cyan-50 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <AlarmClock
                        size={19}
                        className="text-cyan-600"
                      />

                      <h3 className="font-bold text-slate-800">
                        Medicine Schedule
                      </h3>
                    </div>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Select the time using your computer's normal
                      time control. Elder Sense displays it as AM/PM.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={
                      addScheduleRow
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-cyan-700 shadow-sm transition hover:bg-cyan-100"
                  >
                    <Plus size={16} />
                    Add Time
                  </button>
                </div>

                <div className="mt-5 space-y-3">
                  {scheduleRows.map(
                    (
                      row,
                      index
                    ) => (
                      <div
                        key={
                          row.id ??
                          `new-${index}`
                        }
                        className="flex flex-col gap-3 rounded-2xl bg-white p-4 sm:flex-row sm:items-center"
                      >
                        <div className="flex-1">
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
                              Dose {index + 1}
                            </label>

                            <div className="flex rounded-xl bg-slate-100 p-1">
                              <button
                                type="button"
                                onClick={() =>
                                  updateSchedule(
                                    index,
                                    "time_format",
                                    "12h"
                                  )
                                }
                                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                                  (row.time_format || "12h") ===
                                  "12h"
                                    ? "bg-white text-cyan-700 shadow-sm"
                                    : "text-slate-500"
                                }`}
                              >
                                12-hour AM/PM
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  updateSchedule(
                                    index,
                                    "time_format",
                                    "24h"
                                  )
                                }
                                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                                  row.time_format === "24h"
                                    ? "bg-white text-cyan-700 shadow-sm"
                                    : "text-slate-500"
                                }`}
                              >
                                24-hour
                              </button>
                            </div>
                          </div>

                          {(row.time_format || "12h") === "24h" ? (
                            <input
                              type="time"
                              value={row.time}
                              onChange={(event) =>
                                updateSchedule(
                                  index,
                                  "time",
                                  event.target.value
                                )
                              }
                              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base font-semibold text-slate-800 outline-none focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                            />
                          ) : (
                            <div className="grid grid-cols-[1fr_1fr_1fr] gap-2">
                              <select
                                value={get12HourParts(row.time).hour12}
                                onChange={(event) => {
                                  const current = get12HourParts(row.time);
                                  updateSchedule(
                                    index,
                                    "time",
                                    convert12HourTo24(
                                      event.target.value,
                                      current.minute,
                                      current.period
                                    )
                                  );
                                }}
                                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-base font-semibold text-slate-800 outline-none focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                                aria-label={`Dose ${index + 1} hour`}
                              >
                                {Array.from({ length: 12 }, (_, hourIndex) => {
                                  const value = String(hourIndex + 1);
                                  return (
                                    <option key={value} value={value}>
                                      {value}
                                    </option>
                                  );
                                })}
                              </select>

                              <select
                                value={get12HourParts(row.time).minute}
                                onChange={(event) => {
                                  const current = get12HourParts(row.time);
                                  updateSchedule(
                                    index,
                                    "time",
                                    convert12HourTo24(
                                      current.hour12,
                                      event.target.value,
                                      current.period
                                    )
                                  );
                                }}
                                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-base font-semibold text-slate-800 outline-none focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                                aria-label={`Dose ${index + 1} minutes`}
                              >
                                {Array.from({ length: 60 }, (_, minute) => {
                                  const value = String(minute).padStart(2, "0");
                                  return (
                                    <option key={value} value={value}>
                                      {value}
                                    </option>
                                  );
                                })}
                              </select>

                              <select
                                value={get12HourParts(row.time).period}
                                onChange={(event) => {
                                  const current = get12HourParts(row.time);
                                  updateSchedule(
                                    index,
                                    "time",
                                    convert12HourTo24(
                                      current.hour12,
                                      current.minute,
                                      event.target.value
                                    )
                                  );
                                }}
                                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-base font-semibold text-slate-800 outline-none focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                                aria-label={`Dose ${index + 1} AM or PM`}
                              >
                                <option value="AM">AM</option>
                                <option value="PM">PM</option>
                              </select>
                            </div>
                          )}

                          <p className="mt-1.5 text-xs font-medium text-cyan-700">
                            Elder Sense stores the schedule consistently as {formatTime(row.time)}.
                          </p>
                        </div>

                        <label className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
                          <input
                            type="checkbox"
                            checked={
                              row.reminder_enabled !==
                              false
                            }
                            onChange={(
                              event
                            ) =>
                              updateSchedule(
                                index,
                                "reminder_enabled",
                                event.target
                                  .checked
                              )
                            }
                            className="h-5 w-5 rounded border-slate-300 text-cyan-500 focus:ring-cyan-500"
                          />

                          <span className="text-sm font-semibold text-slate-700">
                            Reminder ON
                          </span>
                        </label>

                        {scheduleRows.length >
                          1 && (
                          <button
                            type="button"
                            onClick={() =>
                              removeScheduleRow(
                                index
                              )
                            }
                            className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-600 transition hover:bg-rose-100"
                            aria-label="Remove schedule"
                          >
                            <Trash2
                              size={17}
                            />
                          </button>
                        )}
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Photo */}
              <div className="mt-6 rounded-3xl border border-slate-100 bg-slate-50 p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-cyan-600 shadow-sm">
                    <Camera size={20} />
                  </div>

                  <div className="flex-1">
                    <h3 className="font-bold text-slate-800">
                      Medicine Photo
                    </h3>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Upload a photo of the actual tablet, strip or
                      medicine bottle.
                    </p>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={
                        handlePhotoChange
                      }
                      className="hidden"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        fileInputRef.current?.click()
                      }
                      className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-cyan-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-cyan-50"
                    >
                      <Upload size={16} />
                      Choose Photo
                    </button>

                    {photoPreview && (
                      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                        <img
                          src={
                            photoPreview
                          }
                          alt="Medicine preview"
                          className="h-40 w-full object-contain"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() =>
                    setShowForm(false)
                  }
                  className="rounded-xl border border-slate-200 px-5 py-3 font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 px-6 py-3 font-bold text-white shadow-lg shadow-cyan-100 transition hover:from-cyan-600 hover:to-teal-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <>
                      <RefreshCw
                        size={17}
                        className="animate-spin"
                      />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={17} />
                      {editingMedication
                        ? "Update Medicine"
                        : "Save Medicine"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reminder popup */}
      {activeReminder && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-slate-950/80 p-3 backdrop-blur-md sm:items-center sm:p-4">
          <div
            className={`my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl overflow-y-auto rounded-[2rem] shadow-2xl sm:max-h-[calc(100dvh-2rem)] ${
              activeReminder.isFollowUp
                ? "bg-amber-50"
                : "bg-white"
            }`}
          >
            <div
              className={`p-7 text-white sm:p-9 ${
                activeReminder.isFollowUp
                  ? "bg-gradient-to-br from-amber-500 to-orange-500"
                  : "bg-gradient-to-br from-cyan-500 via-teal-500 to-emerald-500"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white/20 text-4xl backdrop-blur-sm">
                    {activeReminder.isFollowUp
                      ? "🔔"
                      : "💊"}
                  </div>

                  <p className="mt-5 text-sm font-semibold text-white/80">
                    {activeReminder.isFollowUp
                      ? "Follow-up reminder"
                      : "Medicine reminder"}
                  </p>

                  <h2 className="mt-1 text-3xl font-bold sm:text-4xl">
                    {activeReminder.isFollowUp
                      ? "Your medicine is still waiting."
                      : "It's medicine time!"}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={
                    closeReminder
                  }
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 transition hover:bg-white/25"
                >
                  <X size={19} />
                </button>
              </div>
            </div>

            <div className="p-7 sm:p-9">
              <div className="rounded-3xl bg-slate-50 p-6 text-center">
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[2rem] bg-white text-5xl shadow-sm">
                  💊
                </div>

                <h3 className="mt-5 text-3xl font-bold text-slate-800">
                  {getMedicineName(
                    activeReminder.medicine
                  )}
                </h3>

                <p className="mt-2 text-xl font-semibold text-cyan-600">
                  {activeReminder.dosage ||
                    "As prescribed"}
                </p>

                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-slate-600 shadow-sm">
                  <Clock3 size={17} />
                  {activeReminder.time}
                </div>
              </div>

              {!showMissedReason ? (
                <>
                  <p className="mt-6 text-center text-sm leading-6 text-slate-500">
                    {activeReminder.isFollowUp
                      ? "This dose has not been marked as taken yet. Please update the status below."
                      : "Please take your medicine and tell Elder Sense what happened."}
                  </p>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={
                        handleReminderTaken
                      }
                      className="flex min-h-16 items-center justify-center gap-3 rounded-2xl bg-emerald-500 px-5 py-4 text-lg font-bold text-white shadow-lg shadow-emerald-100 transition hover:bg-emerald-600"
                    >
                      <CheckCircle2
                        size={24}
                      />
                      I Took It
                    </button>

                    <button
                      type="button"
                      onClick={
                        handleReminderMissed
                      }
                      className="flex min-h-16 items-center justify-center gap-3 rounded-2xl bg-rose-50 px-5 py-4 text-lg font-bold text-rose-700 transition hover:bg-rose-100"
                    >
                      <X size={24} />
                      I Didn't Take It
                    </button>
                  </div>

                  <div className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-400">
                    <Volume2 size={15} />
                    Voice reminder is enabled in{" "}
                    {language}.
                  </div>
                </>
              ) : (
                <div className="mt-6">
                  <h4 className="text-center text-lg font-bold text-slate-800">
                    Why was this dose missed?
                  </h4>

                  <div className="mt-4 grid gap-2">
                    {MISSED_REASONS.map(
                      (reason) => (
                        <button
                          key={reason}
                          type="button"
                          onClick={() =>
                            setMissedReason(
                              reason
                            )
                          }
                          className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                            missedReason ===
                            reason
                              ? "border-rose-300 bg-rose-50 text-rose-700"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {reason}
                        </button>
                      )
                    )}
                  </div>

                  <div className="mt-5 flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowMissedReason(
                          false
                        );
                        setMissedReason("");
                      }}
                      className="flex-1 rounded-xl border border-slate-200 px-4 py-3 font-semibold text-slate-600"
                    >
                      Back
                    </button>

                    <button
                      type="button"
                      disabled={!missedReason}
                      onClick={
                        confirmMissed
                      }
                      className="flex-1 rounded-xl bg-rose-500 px-4 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Confirm Missed
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  title,
  value,
  subtitle,
  tone,
  nightMode,
}) {
  const classes =
    getColorClasses(tone);

  return (
    <div
      className={`rounded-3xl border p-5 shadow-sm ${
        nightMode
          ? "border-slate-800 bg-slate-900"
          : "border-slate-100 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-2xl ${classes.icon}`}
        >
          {icon}
        </div>

        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${classes.soft} ${classes.text}`}
        >
          7 days
        </span>
      </div>

      <p
        className={`mt-5 text-sm font-semibold ${
          nightMode
            ? "text-slate-400"
            : "text-slate-500"
        }`}
      >
        {title}
      </p>

      <p
        className={`mt-1 text-3xl font-bold ${
          nightMode
            ? "text-white"
            : "text-slate-800"
        }`}
      >
        {value}
      </p>

      <p
        className={`mt-1 text-xs ${nightMode ? "text-slate-500" : "text-slate-400"}`}
      >
        {subtitle}
      </p>
    </div>
  );
}

function MedicineCard({
  medicine,
  history = [],
  todayKey,
  index,
  nightMode,
  onEdit,
  onDelete,
  onToggleReminder,
}) {
  const color =
    getMedicineColor(index);

  const classes =
    getColorClasses(color);

  const schedules =
    getSchedules(medicine);

  return (
    <div
      className={`overflow-hidden rounded-3xl border ${
        nightMode
          ? "border-slate-800 bg-slate-900"
          : "border-slate-100 bg-white"
      }`}
    >
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start">
        <div
          className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl text-3xl ${classes.icon}`}
        >
          💊
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h4
                  className={`text-xl font-bold ${
                    nightMode
                      ? "text-white"
                      : "text-slate-800"
                  }`}
                >
                  {getMedicineName(
                    medicine
                  )}
                </h4>

                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${classes.soft} ${classes.text}`}
                >
                  {medicine?.form ||
                    "Medicine"}
                </span>
              </div>

              <p
                className={`mt-1 font-semibold ${classes.text}`}
              >
                {getMedicineDosage(
                  medicine
                )}
              </p>

              {medicine?.purpose && (
                <p
                  className={`mt-2 text-sm ${nightMode ? "text-slate-400" : "text-slate-500"}`}
                >
                  {medicine.purpose}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onEdit}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 transition hover:bg-cyan-100"
                aria-label="Edit medicine"
              >
                <Edit3 size={17} />
              </button>

              <button
                type="button"
                onClick={onDelete}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 transition hover:bg-rose-100"
                aria-label="Remove medicine"
              >
                <Trash2 size={17} />
              </button>
            </div>
          </div>

          {medicine?.instructions && (
            <div
              className={`mt-4 rounded-2xl px-4 py-3 text-sm ${
                nightMode
                  ? "bg-slate-800 text-slate-300"
                  : "bg-slate-50 text-slate-600"
              }`}
            >
              <span className="font-semibold">
                Instructions:
              </span>{" "}
              {medicine.instructions}
            </div>
          )}

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {schedules.map(
              (schedule, scheduleIndex) => {
                const reminderOn =
                  schedule?.reminder_enabled !==
                  false;

                const doseStatus =
                  getDoseStatus(
                    medicine,
                    schedule,
                    history,
                    todayKey
                  );

                const doseStyles =
                  getDoseStatusStyles(
                    doseStatus.status,
                    nightMode
                  );

                return (
                  <div
                    key={
                      getScheduleId(
                        schedule
                      ) ??
                      scheduleIndex
                    }
                    className={`flex items-center justify-between gap-3 rounded-2xl border p-3 transition-colors ${doseStyles.container}`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-xl ${doseStyles.icon}`}
                      >
                        <Clock3
                          size={18}
                        />
                      </div>

                      <div>
                        <p
                          className={`font-bold ${
                            nightMode
                              ? "text-white"
                              : "text-slate-800"
                          }`}
                        >
                          {formatTime(
                            getScheduleTime(
                              schedule
                            )
                          )}
                        </p>

                        <p
                          className={`text-xs ${
                            reminderOn
                              ? "text-emerald-600"
                              : "text-slate-400"
                          }`}
                        >
                          {reminderOn
                            ? "Reminder ON"
                            : "Reminder OFF"}
                        </p>

                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <StatusBadge
                            status={
                              doseStatus.status
                            }
                          />

                          {!doseStatus.recorded && (
                            <span
                              className={`text-[11px] ${
                                nightMode
                                  ? "text-slate-400"
                                  : "text-slate-500"
                              }`}
                            >
                              Not recorded yet
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        onToggleReminder(
                          medicine,
                          schedule
                        )
                      }
                      className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
                        reminderOn
                          ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                          : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                      }`}
                      aria-label={
                        reminderOn
                          ? "Turn reminder off"
                          : "Turn reminder on"
                      }
                    >
                      {reminderOn ? (
                        <Bell size={17} />
                      ) : (
                        <BellOff size={17} />
                      )}
                    </button>
                  </div>
                );
              }
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            {medicine?.start_date && (
              <span
                className={`rounded-full px-3 py-1.5 ${
                  nightMode
                    ? "bg-slate-800 text-slate-400"
                    : "bg-slate-50 text-slate-500"
                }`}
              >
                From{" "}
                {formatDate(
                  medicine.start_date
                )}
              </span>
            )}

            {medicine?.end_date && (
              <span
                className={`rounded-full px-3 py-1.5 ${
                  nightMode
                    ? "bg-slate-800 text-slate-400"
                    : "bg-slate-50 text-slate-500"
                }`}
              >
                Until{" "}
                {formatDate(
                  medicine.end_date
                )}
              </span>
            )}

            {medicine?.photo_url && (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-3 py-1.5 font-semibold text-violet-600">
                <ImagePlus size={13} />
                Photo added
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelineGroup({
  period,
  items,
  nightMode,
}) {
  const icons = {
    Morning: "🌅",
    Afternoon: "☀️",
    Evening: "🌇",
    Night: "🌙",
  };

  const colors = {
    Morning:
      "bg-amber-50 text-amber-700",
    Afternoon:
      "bg-cyan-50 text-cyan-700",
    Evening:
      "bg-violet-50 text-violet-700",
    Night:
      "bg-indigo-50 text-indigo-700",
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-xl ${
            colors[period]
          }`}
        >
          {icons[period]}
        </span>

        <h4
          className={`font-bold ${
            nightMode
              ? "text-white"
              : "text-slate-700"
          }`}
        >
          {period}
        </h4>

        <span
          className={`text-xs ${nightMode ? "text-slate-500" : "text-slate-400"}`}
        >
          {items.length}{" "}
          {items.length === 1
            ? "medicine"
            : "medicines"}
        </span>
      </div>

      <div className="ml-4 mt-3 border-l-2 border-slate-100 pl-5">
        {items.length === 0 ? (
          <p className="py-2 text-sm text-slate-400">
            No medicines scheduled.
          </p>
        ) : (
          <div className="space-y-3">
            {items.map(
              ({
                medicine,
                schedule,
              }) => (
                <div
                  key={`${getMedicationId(
                    medicine
                  )}-${getScheduleId(
                    schedule
                  )}`}
                  className={`rounded-2xl border p-4 ${
                    nightMode
                      ? "border-slate-800 bg-slate-800"
                      : "border-slate-100 bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p
                        className={`font-bold ${
                          nightMode
                            ? "text-white"
                            : "text-slate-800"
                        }`}
                      >
                        {getMedicineName(
                          medicine
                        )}
                      </p>

                      <p className="mt-1 text-xs font-semibold text-cyan-600">
                        {getMedicineDosage(
                          medicine
                        )}
                      </p>
                    </div>

                    <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm">
                      {formatTime(
                        getScheduleTime(
                          schedule
                        )
                      )}
                    </span>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FormInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
        {required && (
          <span className="ml-1 text-rose-500">
            *
          </span>
        )}
      </label>

      <input
        type={type}
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        placeholder={placeholder}
        required={required}
        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
      />
    </div>
  );
}

function StatusBadge({
  status,
}) {
  const normalized =
    String(status || "")
      .toUpperCase();

  if (normalized === "TAKEN") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
        <Check size={13} />
        Taken
      </span>
    );
  }

  if (normalized === "MISSED") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700">
        <X size={13} />
        Missed
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">
      <Clock3 size={13} />
      Pending
    </span>
  );
}

function LoadingState() {
  return (
    <div className="rounded-3xl border border-cyan-100 bg-cyan-50 p-10 text-center">
      <RefreshCw
        size={30}
        className="mx-auto animate-spin text-cyan-500"
      />

      <p className="mt-4 font-bold text-cyan-800">
        Loading your medicines...
      </p>

      <p className="mt-1 text-sm text-cyan-600">
        Please wait while Elder Sense loads your medication
        schedule.
      </p>
    </div>
  );
}

function EmptyMedicines({
  onAdd,
  nightMode,
}) {
  return (
    <div
      className={`rounded-3xl border border-dashed p-10 text-center ${
        nightMode
          ? "border-slate-700 bg-slate-800"
          : "border-slate-200 bg-slate-50"
      }`}
    >
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-cyan-50 text-4xl">
        💊
      </div>

      <h4
        className={`mt-5 text-xl font-bold ${
          nightMode
            ? "text-white"
            : "text-slate-800"
        }`}
      >
        No medicines added yet
      </h4>

      <p
        className={`mx-auto mt-2 max-w-md text-sm leading-6 ${
          nightMode
            ? "text-slate-400"
            : "text-slate-500"
        }`}
      >
        Add your first medicine and its schedule. Elder Sense will
        remind you when it is time.
      </p>

      <button
        type="button"
        onClick={onAdd}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 px-5 py-3 font-bold text-white shadow-lg shadow-cyan-100"
      >
        <Plus size={18} />
        Add Your First Medicine
      </button>
    </div>
  );
}

export default MedicineReminders;