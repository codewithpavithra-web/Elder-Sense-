import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, Volume2, Globe, Lock, HelpCircle, Save, Sparkles } from "lucide-react";
import axios from "axios";

function Settings() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });

  const [settings, setSettings] = useState({
    medication_reminders: true,
    missed_medication_alerts: true,
    appointment_reminders: true,
    voice_reminders: false,
    speech_language: "en-IN",
    text_size: "normal",
    language: "en"
  });

  const [passwordData, setPasswordData] = useState({
    current_password: "",
    new_password: "",
    confirm_password: ""
  });

  const apiBase =
    import.meta.env.VITE_API_BASE_URL ||
    `${window.location.protocol}//${window.location.hostname}:5000/api`;

  useEffect(() => {
    const savedPrefs = localStorage.getItem("elder_sense_settings");
    if (savedPrefs) {
      try {
        const parsed = JSON.parse(savedPrefs);
        setSettings(parsed);
        applyTextSize(parsed.text_size);
      } catch (e) {
        console.error("Failed to parse settings", e);
      }
    }
  }, []);

  const applyTextSize = (size) => {
    const root = document.documentElement;
    if (size === "large") {
      root.style.fontSize = "18px";
    } else if (size === "extra-large") {
      root.style.fontSize = "20px";
    } else {
      root.style.fontSize = "16px";
    }
  };

  const handleToggle = async (key) => {
    const updatedValue = !settings[key];
    const newSettings = { ...settings, [key]: updatedValue };
    setSettings(newSettings);

    if (key === "medication_reminders" || key === "missed_medication_alerts" || key === "appointment_reminders") {
      if (updatedValue && "Notification" in window) {
        if (Notification.permission !== "granted") {
          await Notification.requestPermission();
        }
      }
    }
  };

  const handleSelectChange = (e) => {
    const { name, value } = e.target;
    const newSettings = { ...settings, [name]: value };
    setSettings(newSettings);
    if (name === "text_size") {
      applyTextSize(value);
    }
  };

  const testVoice = () => {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance("Elder Sense voice reminder test. Your medication is on schedule.");
      utterance.lang = settings.speech_language;
      window.speechSynthesis.speak(utterance);
    } else {
      alert("Speech synthesis is not supported in this browser.");
    }
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({ ...prev, [name]: value }));
  };

  const saveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ text: "", type: "" });

    try {
      const token = localStorage.getItem("access_token");
      await axios.put(
        `${apiBase}/auth/settings`,
        { settings },
        { headers: { Authorization: `Bearer ${token}` } }
      ).catch(() => {});

      localStorage.setItem("elder_sense_settings", JSON.stringify(settings));
      applyTextSize(settings.text_size);
      setMessage({ text: "Preferences saved persistently!", type: "success" });
    } catch (err) {
      setMessage({ text: "Failed to save preferences.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const updatePassword = async (e) => {
    e.preventDefault();
    if (passwordData.new_password !== passwordData.confirm_password) {
      setMessage({ text: "New passwords do not match.", type: "error" });
      return;
    }

    const token = localStorage.getItem("access_token");
    try {
      await axios.put(
        `${apiBase}/auth/change-password`,
        {
          current_password: passwordData.current_password,
          new_password: passwordData.new_password
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage({ text: "Password updated securely via authentication system!", type: "success" });
      setPasswordData({ current_password: "", new_password: "", confirm_password: "" });
    } catch (err) {
      setMessage({
        text: err.response?.data?.error || "Failed to update password. Check your current password.",
        type: "error"
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#f4fbfa] text-slate-800">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-5xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-600"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">
              System Settings
            </h1>
          </div>
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="text-sm font-semibold text-emerald-600 hover:text-emerald-700"
          >
            Back to Dashboard
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-8 sm:px-8 space-y-8">
        {message.text && (
          <div
            className={`rounded-2xl p-4 text-sm font-medium ${
              message.type === "success"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                : "bg-rose-50 text-rose-700 border border-rose-100"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* NOTIFICATIONS SECTION */}
        <div className="rounded-3xl border border-slate-200/70 bg-white p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Bell size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Notifications</h2>
              <p className="text-xs text-slate-400">Manage browser alerts and medication reminders</p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 cursor-pointer transition hover:bg-slate-100">
              <span className="text-sm font-medium text-slate-700">Medication reminders</span>
              <input
                type="checkbox"
                checked={settings.medication_reminders}
                onChange={() => handleToggle("medication_reminders")}
                className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 cursor-pointer transition hover:bg-slate-100">
              <span className="text-sm font-medium text-slate-700">Missed-medication alerts</span>
              <input
                type="checkbox"
                checked={settings.missed_medication_alerts}
                onChange={() => handleToggle("missed_medication_alerts")}
                className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 cursor-pointer transition hover:bg-slate-100">
              <span className="text-sm font-medium text-slate-700">Appointment reminders</span>
              <input
                type="checkbox"
                checked={settings.appointment_reminders}
                onChange={() => handleToggle("appointment_reminders")}
                className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
            </label>
          </div>
        </div>

        {/* ACCESSIBILITY SECTION */}
        <div className="rounded-3xl border border-slate-200/70 bg-white p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
              <Volume2 size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Accessibility</h2>
              <p className="text-xs text-slate-400">Audio speech support and typography options</p>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 cursor-pointer transition hover:bg-slate-100 sm:col-span-2">
              <span className="text-sm font-medium text-slate-700">Enable voice reminders</span>
              <div className="flex items-center gap-3">
                {settings.voice_reminders && (
                  <button
                    type="button"
                    onClick={testVoice}
                    className="rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-100"
                  >
                    Test Voice 🔊
                  </button>
                )}
                <input
                  type="checkbox"
                  checked={settings.voice_reminders}
                  onChange={() => handleToggle("voice_reminders")}
                  className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
              </div>
            </label>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Speech-Language Preference
              </label>
              <select
                name="speech_language"
                value={settings.speech_language}
                onChange={handleSelectChange}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none"
              >
                <option value="en-IN">English (India)</option>
                <option value="kn-IN">Kannada (ಕನ್ನಡ)</option>
                <option value="ta-IN">Tamil (தமிழ்)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Text-Size Preference
              </label>
              <select
                name="text_size"
                value={settings.text_size}
                onChange={handleSelectChange}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none"
              >
                <option value="normal">Normal (Default)</option>
                <option value="large">Large (Recommended for Elderly)</option>
                <option value="extra-large">Extra Large</option>
              </select>
            </div>
          </div>
        </div>

        {/* LANGUAGE SECTION */}
        <div className="rounded-3xl border border-slate-200/70 bg-white p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
              <Globe size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Language</h2>
              <p className="text-xs text-slate-400">Application interface display language</p>
            </div>
          </div>

          <div>
            <select
              name="language"
              value={settings.language}
              onChange={handleSelectChange}
              className="w-full sm:w-1/2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none"
            >
              <option value="en">English</option>
              <option value="kn">Kannada (ಕನ್ನಡ)</option>
              <option value="ta">Tamil (தமிழ்)</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={saveSettings}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-7 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
          >
            <Save size={18} />
            {saving ? "Saving Preferences..." : "Save Preferences"}
          </button>
        </div>

        {/* SECURITY SECTION */}
        <div className="rounded-3xl border border-slate-200/70 bg-white p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Lock size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Security & Password</h2>
              <p className="text-xs text-slate-400">Update your account password securely</p>
            </div>
          </div>

          <form onSubmit={updatePassword} className="space-y-4 max-w-xl">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Current Password
              </label>
              <input
                type="password"
                name="current_password"
                required
                value={passwordData.current_password}
                onChange={handlePasswordChange}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                New Password
              </label>
              <input
                type="password"
                name="new_password"
                required
                value={passwordData.new_password}
                onChange={handlePasswordChange}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                name="confirm_password"
                required
                value={passwordData.confirm_password}
                onChange={handlePasswordChange}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none"
              />
            </div>

            <button
              type="submit"
              className="rounded-2xl bg-slate-800 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-900"
            >
              Update Password
            </button>
          </form>
        </div>

        {/* HELP & SUPPORT SECTION */}
        <div className="rounded-3xl border border-slate-200/70 bg-white p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <HelpCircle size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Help & Support</h2>
              <p className="text-xs text-slate-400">Elder Sense user guide and assistance</p>
            </div>
          </div>

          <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
            <p>
              <strong>Getting Started:</strong> Use the dashboard to track today's medicines, monitor vital signs like heart rate, and consult the AI Care Assistant.
            </p>
            <p>
              <strong>Voice & Reminders:</strong> Enable voice reminders and use the "Test Voice" feature to verify audio feedback in your chosen speech language (English, Kannada, or Tamil).
            </p>
            <p>
              <strong>Support Contact:</strong> For technical assistance, reach out to your designated healthcare coordinator or system administrator.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Settings;