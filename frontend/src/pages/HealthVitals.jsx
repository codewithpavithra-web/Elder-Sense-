import { useEffect, useState } from "react";
import {
  Activity,
  ArrowLeft,
  Droplets,
  HeartPulse,
  Loader2,
  Save,
  Thermometer,
  Weight,
  Wind,
  Brain,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  CalendarDays,
  Clock3,
  Camera,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";

const API = import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:5000/api`;

function HealthVitals() {
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({
    blood_pressure: "",
    heart_rate: "",
    blood_sugar: "",
    temperature: "",
    oxygen_level: "",
    weight: "",
    notes: "",
  });

  const [vitals, setVitals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [assessment, setAssessment] = useState(null);
  const [assessmentLoading, setAssessmentLoading] = useState(false);

  const [deletingVitalId, setDeletingVitalId] = useState(null);

  const token = localStorage.getItem("access_token");

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }

    loadVitals();
  }, []);

  /*
    Restore any unsaved form data and/or camera heart-rate reading.

    Camera measurement DOES NOT save a database record.
    It only places the measured BPM into the Heart Rate field.
  */
  useEffect(() => {
    const savedDraft = localStorage.getItem("elderSenseVitalsDraft");
    const cameraHeartRate = localStorage.getItem(
      "elderSenseCameraHeartRate"
    );

    let restoredForm = null;

    if (savedDraft) {
      try {
        restoredForm = JSON.parse(savedDraft);

        if (
          restoredForm &&
          typeof restoredForm === "object"
        ) {
          setForm((currentForm) => ({
            ...currentForm,
            ...restoredForm,
          }));
        }
      } catch (err) {
        console.error("Unable to restore vitals draft:", err);
      }
    }

    if (cameraHeartRate) {
      const parsedHeartRate = Number(cameraHeartRate);

      if (
        Number.isFinite(parsedHeartRate) &&
        parsedHeartRate > 0
      ) {
        setForm((currentForm) => ({
          ...currentForm,
          ...(restoredForm || {}),
          heart_rate: String(Math.round(parsedHeartRate)),
        }));

        setMessage(
          `Camera estimated heart rate: ${Math.round(
            parsedHeartRate
          )} BPM. Review the reading and click Save Vitals when ready.`
        );
      }
    }

    localStorage.removeItem("elderSenseVitalsDraft");
    localStorage.removeItem("elderSenseCameraHeartRate");
  }, []);

  const loadVitals = async () => {
    try {
      setLoadingHistory(true);

      const response = await axios.get(`${API}/health/vitals`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setVitals(response.data.vitals || []);
    } catch (err) {
      console.error(err);

      if (err.response?.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user");
        navigate("/login");
      }
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleChange = (event) => {
    setForm({
      ...form,
      [event.target.name]: event.target.value,
    });
  };

  const saveVitals = async (event) => {
    event.preventDefault();

    setMessage("");
    setError("");

    if (
      !form.blood_pressure &&
      !form.heart_rate &&
      !form.blood_sugar &&
      !form.temperature &&
      !form.oxygen_level &&
      !form.weight
    ) {
      setError("Please enter at least one vital sign.");
      return;
    }

    try {
      setLoading(true);

      const response = await axios.post(
        `${API}/health/vitals`,
        {
          blood_pressure: form.blood_pressure || null,
          heart_rate: form.heart_rate
            ? Number(form.heart_rate)
            : null,
          blood_sugar: form.blood_sugar
            ? Number(form.blood_sugar)
            : null,
          temperature: form.temperature
            ? Number(form.temperature)
            : null,
          oxygen_level: form.oxygen_level
            ? Number(form.oxygen_level)
            : null,
          weight: form.weight
            ? Number(form.weight)
            : null,
          notes: form.notes || null,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      setMessage(
        response.data.message || "Vitals recorded successfully."
      );

      setForm({
        blood_pressure: "",
        heart_rate: "",
        blood_sugar: "",
        temperature: "",
        oxygen_level: "",
        weight: "",
        notes: "",
      });

      await loadVitals();
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message ||
          "Unable to save vitals. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const openCameraMeasurement = () => {
    setMessage("");
    setError("");

    /*
      Preserve anything the user has already entered.
      The camera page will only return a BPM value.
    */
    localStorage.setItem(
      "elderSenseVitalsDraft",
      JSON.stringify(form)
    );

    navigate("/heart-rate-test");
  };

  const runAssessment = async () => {
    setAssessmentLoading(true);
    setAssessment(null);
    setError("");

    try {
      const response = await axios.post(
        `${API}/health/assessment`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      setAssessment(response.data.assessment);
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message ||
          "Unable to generate health assessment."
      );
    } finally {
      setAssessmentLoading(false);
    }
  };

  const deleteVital = async (vitalId) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this vital record?"
    );

    if (!confirmed) {
      return;
    }

    setMessage("");
    setError("");
    setDeletingVitalId(vitalId);

    try {
      const response = await axios.delete(
        `${API}/health/vitals/${vitalId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setMessage(
        response.data.message ||
          "Vital record deleted successfully."
      );

      setVitals((currentVitals) =>
        currentVitals.filter(
          (vital) => vital.id !== vitalId
        )
      );

      setAssessment(null);
    } catch (err) {
      console.error(err);

      if (err.response?.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user");
        navigate("/login");
        return;
      }

      setError(
        err.response?.data?.message ||
          "Unable to delete vital record. Please try again."
      );
    } finally {
      setDeletingVitalId(null);
    }
  };

  /*
    Convert backend timestamps to Indian Standard Time.

    The backend timestamp is treated as UTC when it does not
    contain an explicit timezone marker.
  */
  const formatVitalDate = (recordedAt) => {
    if (!recordedAt) {
      return {
        day: "Date unavailable",
        date: "",
        time: "",
      };
    }

    let timestamp = String(recordedAt).trim();

    /*
      If the backend returns a timestamp without timezone information,
      explicitly treat it as UTC.
    */
    if (
      !timestamp.endsWith("Z") &&
      !/[+-]\d{2}:\d{2}$/.test(timestamp)
    ) {
      timestamp = `${timestamp}Z`;
    }

    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
      return {
        day: "Date unavailable",
        date: "",
        time: "",
      };
    }

    const formatterOptions = {
      timeZone: "Asia/Kolkata",
    };

    return {
      day: new Intl.DateTimeFormat("en-IN", {
        ...formatterOptions,
        weekday: "long",
      }).format(date),

      date: new Intl.DateTimeFormat("en-IN", {
        ...formatterOptions,
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(date),

      time: new Intl.DateTimeFormat("en-IN", {
        ...formatterOptions,
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(date),
    };
  };

  return (
    <div className="min-h-screen bg-[#f4fbfa] text-slate-800">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/90 backdrop-blur-xl">
        <div className="flex h-20 items-center px-5 sm:px-8 lg:px-10">
          <button
            onClick={() => navigate("/dashboard")}
            className="mr-4 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-600 transition hover:bg-cyan-50 hover:text-cyan-600"
          >
            <ArrowLeft size={20} />
          </button>

          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 text-white shadow-lg shadow-rose-100">
            <HeartPulse size={24} />
          </div>

          <div className="ml-3">
            <h1 className="text-xl font-bold tracking-tight">
              Health & Vitals
            </h1>

            <p className="hidden text-xs text-slate-400 sm:block">
              Monitor your health measurements
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-7 sm:px-8">
        {/* Intro */}
        <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-rose-500 via-pink-500 to-orange-400 p-7 text-white shadow-xl shadow-rose-100 sm:p-9">
          <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10" />

          <div className="relative z-10 flex items-center gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-white/15 text-3xl backdrop-blur-sm">
              ❤️
            </div>

            <div>
              <p className="text-sm text-rose-100">
                Personal health monitoring
              </p>

              <h2 className="mt-1 text-2xl font-bold sm:text-3xl">
                Keep track of your vital signs
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-rose-100">
                Record your latest measurements and monitor changes
                over time.
              </p>
            </div>
          </div>
        </section>

        {/* Form */}
        <section className="mt-6 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
              <Activity size={22} />
            </div>

            <div>
              <h3 className="text-xl font-bold">
                Record Vitals
              </h3>

              <p className="text-sm text-slate-400">
                Enter measurements manually or measure heart rate
                using the camera.
              </p>
            </div>
          </div>

          <form
            onSubmit={saveVitals}
            className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {/* Blood Pressure */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-600">
                Blood Pressure
              </label>

              <input
                name="blood_pressure"
                value={form.blood_pressure}
                onChange={handleChange}
                placeholder="e.g. 120/80"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-cyan-300 focus:ring-4 focus:ring-cyan-50"
              />
            </div>

            {/* Heart Rate */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-600">
                Heart Rate
              </label>

              <div className="relative">
                <HeartPulse
                  size={18}
                  className="absolute left-4 top-3.5 text-rose-400"
                />

                <input
                  name="heart_rate"
                  type="number"
                  value={form.heart_rate}
                  onChange={handleChange}
                  placeholder="e.g. 72"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 outline-none focus:border-cyan-300 focus:ring-4 focus:ring-cyan-50"
                />
              </div>

              <button
                type="button"
                onClick={openCameraMeasurement}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-100"
              >
                <Camera size={17} />
                Measure with Camera
              </button>

              <p className="mt-1 text-[11px] leading-4 text-slate-400">
                Experimental camera-based estimate.
              </p>
            </div>

            {/* Blood Sugar */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-600">
                Blood Sugar
              </label>

              <div className="relative">
                <Droplets
                  size={18}
                  className="absolute left-4 top-3.5 text-red-400"
                />

                <input
                  name="blood_sugar"
                  type="number"
                  step="0.1"
                  value={form.blood_sugar}
                  onChange={handleChange}
                  placeholder="e.g. 110"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 outline-none focus:border-cyan-300 focus:ring-4 focus:ring-cyan-50"
                />
              </div>
            </div>

            {/* Temperature */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-600">
                Temperature °C
              </label>

              <div className="relative">
                <Thermometer
                  size={18}
                  className="absolute left-4 top-3.5 text-orange-400"
                />

                <input
                  name="temperature"
                  type="number"
                  step="0.1"
                  value={form.temperature}
                  onChange={handleChange}
                  placeholder="e.g. 36.7"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 outline-none focus:border-cyan-300 focus:ring-4 focus:ring-cyan-50"
                />
              </div>
            </div>

            {/* Oxygen */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-600">
                Oxygen Level %
              </label>

              <div className="relative">
                <Wind
                  size={18}
                  className="absolute left-4 top-3.5 text-sky-400"
                />

                <input
                  name="oxygen_level"
                  type="number"
                  step="0.1"
                  value={form.oxygen_level}
                  onChange={handleChange}
                  placeholder="e.g. 98"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pl-11 outline-none focus:border-cyan-300 focus:ring-4 focus:ring-cyan-50"
                />
              </div>
            </div>

            {/* Weight */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-600">
                Weight (kg)
              </label>

              <div className="relative">
                <Weight
                  size={18}
                  className="absolute left-4 top-3.5 text-violet-400"
                />

                <input
                  name="weight"
                  type="number"
                  step="0.1"
                  value={form.weight}
                  onChange={handleChange}
                  placeholder="e.g. 65"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pl-11 outline-none focus:border-cyan-300 focus:ring-4 focus:ring-cyan-50"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="mb-2 block text-sm font-semibold text-slate-600">
                Notes
              </label>

              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows="3"
                placeholder="Add any notes about how you are feeling..."
                className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-cyan-300 focus:ring-4 focus:ring-cyan-50"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              {message && (
                <div className="mb-4 flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                  <CheckCircle2 size={18} />
                  {message}
                </div>
              )}

              {error && (
                <div className="mb-4 flex items-center gap-2 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                  <AlertTriangle size={18} />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-teal-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-cyan-100 transition hover:opacity-90 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 size={19} className="animate-spin" />
                ) : (
                  <Save size={19} />
                )}

                {loading ? "Saving..." : "Save Vitals"}
              </button>
            </div>
          </form>
        </section>

        {/* AI Health Assessment */}
        <section className="mt-6 rounded-3xl border border-violet-100 bg-gradient-to-br from-violet-50 to-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-600">
                <Brain size={23} />
              </div>

              <div>
                <h3 className="text-xl font-bold">
                  Predictive Health Assessment 🧠
                </h3>

                <p className="mt-1 text-sm text-slate-400">
                  Analyze your latest health information for a general
                  risk assessment.
                </p>
              </div>
            </div>

            <button
              onClick={runAssessment}
              disabled={assessmentLoading}
              className="flex items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
            >
              {assessmentLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Brain size={18} />
              )}

              {assessmentLoading
                ? "Analyzing..."
                : "Run Assessment"}
            </button>
          </div>

          {assessment && (
            <div className="mt-6 rounded-2xl border border-white bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Risk Level
                  </p>

                  <h4 className="mt-1 text-3xl font-bold text-violet-700">
                    {assessment.risk_level}
                  </h4>
                </div>

                <div className="rounded-2xl bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-700">
                  Score: {assessment.risk_score ?? "N/A"}
                </div>
              </div>

              <p className="mt-4 text-sm leading-6 text-slate-600">
                {assessment.prediction}
              </p>

              {assessment.recommendations && (
                <div className="mt-4 rounded-2xl bg-emerald-50 p-4">
                  <p className="text-sm font-semibold text-emerald-700">
                    Recommendations
                  </p>

                  <p className="mt-1 text-sm leading-6 text-emerald-700">
                    {assessment.recommendations}
                  </p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* History */}
        <section className="mt-6 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold">
                Vitals History 📈
              </h3>

              <p className="mt-1 text-sm text-slate-400">
                Your recently recorded measurements.
              </p>
            </div>

            <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-600">
              {vitals.length} records
            </span>
          </div>

          {loadingHistory ? (
            <div className="flex justify-center py-12">
              <Loader2
                size={26}
                className="animate-spin text-cyan-500"
              />
            </div>
          ) : vitals.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">
              No vitals recorded yet.
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {vitals.map((vital) => {
                const recordedDate = formatVitalDate(
                  vital.recorded_at
                );

                return (
                  <div
                    key={vital.id}
                    className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="rounded-2xl border border-cyan-100 bg-white px-4 py-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                          <CalendarDays
                            size={17}
                            className="text-cyan-500"
                          />

                          <span>
                            {recordedDate.day},{" "}
                            {recordedDate.date}
                          </span>
                        </div>

                        {recordedDate.time && (
                          <div className="mt-1 flex items-center gap-2 text-xs font-medium text-slate-400">
                            <Clock3
                              size={15}
                              className="text-slate-400"
                            />

                            <span>
                              Recorded at {recordedDate.time}
                            </span>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => deleteVital(vital.id)}
                        disabled={deletingVitalId === vital.id}
                        className="flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deletingVitalId === vital.id ? (
                          <Loader2
                            size={15}
                            className="animate-spin"
                          />
                        ) : (
                          <Trash2 size={15} />
                        )}

                        {deletingVitalId === vital.id
                          ? "Deleting..."
                          : "Delete"}
                      </button>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                      <Metric
                        label="BP"
                        value={vital.blood_pressure}
                      />

                      <Metric
                        label="Heart Rate"
                        value={
                          vital.heart_rate
                            ? `${vital.heart_rate} BPM`
                            : "—"
                        }
                      />

                      <Metric
                        label="Sugar"
                        value={
                          vital.blood_sugar
                            ? `${vital.blood_sugar}`
                            : "—"
                        }
                      />

                      <Metric
                        label="Temperature"
                        value={
                          vital.temperature
                            ? `${vital.temperature} °C`
                            : "—"
                        }
                      />

                      <Metric
                        label="Oxygen"
                        value={
                          vital.oxygen_level
                            ? `${vital.oxygen_level}%`
                            : "—"
                        }
                      />

                      <Metric
                        label="Weight"
                        value={
                          vital.weight
                            ? `${vital.weight} kg`
                            : "—"
                        }
                      />
                    </div>

                    {vital.notes && (
                      <p className="mt-3 text-sm text-slate-500">
                        📝 {vital.notes}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Safety */}
        <div className="mt-5 flex gap-3 rounded-2xl border border-amber-100 bg-amber-50 p-4">
          <AlertTriangle
            size={19}
            className="mt-0.5 shrink-0 text-amber-500"
          />

          <p className="text-xs leading-5 text-amber-700">
            Health assessments are for general informational purposes
            only and are not a medical diagnosis. Camera-based heart-rate
            readings are experimental and should not be used for medical
            decisions or emergencies.
          </p>
        </div>
      </main>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-xl bg-white p-3">
      <p className="text-xs text-slate-400">{label}</p>

      <p className="mt-1 text-sm font-bold text-slate-700">
        {value || "—"}
      </p>
    </div>
  );
}

export default HealthVitals;