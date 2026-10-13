import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  HeartPulse,
  Pill,
  AlertTriangle,
  UserRound,
  Activity,
  LogOut,
  ShieldCheck,
  RefreshCw,
  ArrowLeft,
  Bell,
  CheckCircle,
  Volume2,
  VolumeX,
  UserPlus,
  Check,
  X,
  Trash2,
} from "lucide-react";

const API = import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:5000/api`;

function CaregiverDashboard() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [elders, setElders] = useState([]);
  const [requests, setRequests] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [soundEnabled, setSoundEnabled] = useState(false);
  const [alarmActive, setAlarmActive] = useState(false);

  // Connection Request Modal States
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [connectEmail, setConnectEmail] = useState("");
  const [connecting, setConnecting] = useState(false);

  const firstNotificationLoad = useRef(true);
  const knownNotificationIds = useRef(new Set());

  const audioContextRef = useRef(null);
  const voicesRef = useRef([]);

  const token = localStorage.getItem("access_token");

  const authConfig = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  // ============================================================
  // LOAD BROWSER VOICES
  // ============================================================

  useEffect(() => {
    if (!("speechSynthesis" in window)) {
      console.warn(
        "Speech synthesis is not supported by this browser."
      );
      return;
    }

    const loadVoices = () => {
      const voices =
        window.speechSynthesis.getVoices();

      if (voices.length > 0) {
        voicesRef.current = voices;
      }
    };

    loadVoices();

    window.speechSynthesis.addEventListener(
      "voiceschanged",
      loadVoices
    );

    return () => {
      window.speechSynthesis.removeEventListener(
        "voiceschanged",
        loadVoices
      );
    };
  }, []);

  // ============================================================
  // ENABLE CAREGIVER AUDIO + SPEECH
  // ============================================================

  const enableAlertSound = async () => {
    try {
      const AudioContext =
        window.AudioContext ||
        window.webkitAudioContext;

      if (!AudioContext) {
        alert(
          "Audio is not supported by this browser."
        );
        return;
      }

      if (!audioContextRef.current) {
        audioContextRef.current =
          new AudioContext();
      }

      const audioContext =
        audioContextRef.current;

      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      const oscillator =
        audioContext.createOscillator();

      const gainNode =
        audioContext.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = 800;

      gainNode.gain.setValueAtTime(
        0.001,
        audioContext.currentTime
      );

      gainNode.gain.exponentialRampToValueAtTime(
        0.25,
        audioContext.currentTime + 0.03
      );

      gainNode.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + 0.35
      );

      oscillator.connect(gainNode);

      gainNode.connect(
        audioContext.destination
      );

      oscillator.start();

      oscillator.stop(
        audioContext.currentTime + 0.35
      );

      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();

        let voices =
          window.speechSynthesis.getVoices();

        if (!voices.length) {
          await new Promise((resolve) => {
            const timeout = setTimeout(
              resolve,
              1000
            );

            const handleVoicesChanged = () => {
              clearTimeout(timeout);

              window.speechSynthesis.removeEventListener(
                "voiceschanged",
                handleVoicesChanged
              );

              resolve();
            };

            window.speechSynthesis.addEventListener(
              "voiceschanged",
              handleVoicesChanged
            );
          });

          voices =
            window.speechSynthesis.getVoices();
        }

        voicesRef.current = voices;

        const preferredVoice =
          voices.find(
            (voice) =>
              voice.lang?.toLowerCase() ===
              "en-in"
          ) ||
          voices.find(
            (voice) =>
              voice.lang
                ?.toLowerCase()
                .startsWith("en")
          ) ||
          voices[0];

        const testSpeech =
          new SpeechSynthesisUtterance(
            "Caregiver alerts are enabled."
          );

        testSpeech.lang =
          preferredVoice?.lang ||
          "en-IN";

        testSpeech.rate = 0.78;
        testSpeech.pitch = 1;
        testSpeech.volume = 1;

        if (preferredVoice) {
          testSpeech.voice =
            preferredVoice;
        }

        window.speechSynthesis.speak(
          testSpeech
        );
      }

      setSoundEnabled(true);
    } catch (error) {
      console.error(
        "Unable to enable caregiver alerts:",
        error
      );
    }
  };

  const disableAlertSound = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSoundEnabled(false);
    setAlarmActive(false);
  };

  // ============================================================
  // PLAY CAREGIVER ALARM
  // ============================================================

  const playCaregiverAlarm = async () => {
    try {
      const audioContext =
        audioContextRef.current;

      if (!audioContext) {
        return;
      }

      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      const playBeep = (
        frequency,
        startDelay,
        duration = 0.45
      ) => {
        const oscillator =
          audioContext.createOscillator();

        const gainNode =
          audioContext.createGain();

        oscillator.type = "sine";
        oscillator.frequency.value =
          frequency;

        oscillator.connect(gainNode);

        gainNode.connect(
          audioContext.destination
        );

        const start =
          audioContext.currentTime +
          startDelay;

        const end =
          start + duration;

        gainNode.gain.setValueAtTime(
          0.001,
          start
        );

        gainNode.gain.exponentialRampToValueAtTime(
          0.30,
          start + 0.04
        );

        gainNode.gain.exponentialRampToValueAtTime(
          0.001,
          end
        );

        oscillator.start(start);
        oscillator.stop(end);
      };

      playBeep(950, 0);
      playBeep(750, 0.55);
      playBeep(950, 1.10);

      setAlarmActive(true);
    } catch (error) {
      console.error(
        "Caregiver alarm error:",
        error
      );
    }
  };

  // ============================================================
  // SPEAK CAREGIVER ALERT
  // ============================================================

  const speakCaregiverAlert = async (
    notification
  ) => {
    if (!("speechSynthesis" in window)) {
      return;
    }

    try {
      const speechSynthesis =
        window.speechSynthesis;

      speechSynthesis.cancel();

      const message =
        notification?.message ||
        "A medication alert requires your attention.";

      const speechText =
        `Attention caregiver. ${message}`;

      let voices =
        speechSynthesis.getVoices();

      if (!voices.length) {
        await new Promise((resolve) => {
          const timeout = setTimeout(
            resolve,
            1500
          );

          const handleVoicesChanged = () => {
            clearTimeout(timeout);

            speechSynthesis.removeEventListener(
              "voiceschanged",
              handleVoicesChanged
            );

            resolve();
          };

          speechSynthesis.addEventListener(
            "voiceschanged",
            handleVoicesChanged
          );
        });

        voices =
          speechSynthesis.getVoices();
      }

      voicesRef.current = voices;

      const preferredVoice =
        voices.find(
          (voice) =>
            voice.lang?.toLowerCase() ===
            "en-in"
        ) ||
        voices.find(
          (voice) =>
            voice.lang
              ?.toLowerCase()
              .startsWith("en")
        ) ||
        voices[0];

      const speech =
        new SpeechSynthesisUtterance(
          speechText
        );

      speech.lang =
        preferredVoice?.lang ||
        "en-IN";

      speech.rate = 0.78;
      speech.pitch = 1;
      speech.volume = 1;

      if (preferredVoice) {
        speech.voice =
          preferredVoice;
      }

      speechSynthesis.speak(
        speech
      );

      setTimeout(() => {
        if (
          speechSynthesis.speaking &&
          speechSynthesis.paused
        ) {
          speechSynthesis.resume();
        }
      }, 300);
    } catch (error) {
      console.error(
        "Unable to speak caregiver alert:",
        error
      );
    }
  };

  const triggerCaregiverAlarm = (
    notification
  ) => {
    playCaregiverAlarm();

    setTimeout(() => {
      speakCaregiverAlert(
        notification
      );
    }, 1300);
  };

  // ============================================================
  // LOAD DASHBOARD
  // ============================================================

  const loadDashboard = async () => {
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const [
        profileResponse,
        eldersResponse,
        requestsResponse,
        notificationsResponse,
      ] = await Promise.all([
        axios.get(
          `${API}/caregiver/profile`,
          authConfig
        ),

        axios.get(
          `${API}/caregiver/elders`,
          authConfig
        ),

        axios.get(
          `${API}/connections/requests`,
          authConfig
        ).catch(() => ({ data: { requests: [] } })),

        axios.get(
          `${API}/caregiver/notifications`,
          authConfig
        ),
      ]);

      setProfile(
        profileResponse.data.caregiver || profileResponse.data.profile
      );

      setElders(
        eldersResponse.data.elders || []
      );

      setRequests(
        requestsResponse.data.requests || []
      );

      const loadedNotifications =
        notificationsResponse.data
          .notifications || [];

      setNotifications(
        loadedNotifications
      );

      setUnreadCount(
        notificationsResponse.data
          .unread_count || 0
      );

      if (firstNotificationLoad.current) {
        loadedNotifications.forEach(
          (notification) => {
            knownNotificationIds.current.add(
              notification.id
            );
          }
        );

        firstNotificationLoad.current =
          false;
      }
    } catch (err) {
      console.error(err);

      if (
        err.response?.status === 401 ||
        err.response?.status === 403
      ) {
        localStorage.removeItem(
          "access_token"
        );

        localStorage.removeItem(
          "user"
        );

        navigate("/login");
        return;
      }

      setError(
        err.response?.data?.message ||
          "Unable to load caregiver dashboard."
      );
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // SEND CONNECTION REQUEST TO ELDER
  // ============================================================

  const sendConnectionRequest = async (e) => {
    e.preventDefault();
    if (!connectEmail.trim()) {
      setError("Please enter the elder's email address.");
      return;
    }

    try {
      setError("");
      setMessage("");
      setConnecting(true);

      await axios.post(
        `${API}/connections/request`,
        { email: connectEmail.trim() },
        authConfig
      );

      setMessage("Connection request sent successfully to the elder.");
      setConnectEmail("");
      setShowConnectModal(false);
      loadDashboard();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to send connection request.");
    } finally {
      setConnecting(false);
    }
  };

  // ============================================================
  // DECIDE CONNECTION REQUEST (APPROVE/REJECT)
  // ============================================================

  const decideRequest = async (requestId, decision) => {
    try {
      setError("");
      await axios.post(
        `${API}/connections/requests/${requestId}/decision`,
        { decision },
        authConfig
      );
      setMessage(`Connection request ${decision === "APPROVE" ? "accepted" : "rejected"} successfully.`);
      loadDashboard();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to process connection request.");
    }
  };

  // ============================================================
  // DELETE / DISCONNECT ELDER LINK PERMANENTLY
  // ============================================================

  const deleteElderLink = async (elderId, elderName) => {
    const confirmed = window.confirm(
      `Are you sure you want to remove ${elderName || "this elder"}? Once deleted, the connection is permanently removed from the database and will not reappear after refreshing.`
    );
    if (!confirmed) return;

    try {
      setError("");
      // Find matching connection request ID if available, or delete via elder ID endpoint
      const matchingReq = requests.find(
        (r) => r.elder?.id === elderId || r.target?.id === elderId || r.requester?.id === elderId
      );

      if (matchingReq) {
        await axios.delete(`${API}/connections/requests/${matchingReq.id}/decision`, authConfig).catch(() => {
          axios.post(`${API}/connections/requests/${matchingReq.id}/decision`, { decision: "REJECT" }, authConfig);
        });
      } else {
        await axios.delete(`${API}/caregiver/elders/${elderId}`, authConfig).catch(() => {
          // Fallback if caregiver/elders route doesn't support delete directly
        });
      }

      setElders((prev) => prev.filter((el) => (el.id ?? el.elder_id) !== elderId));
      setMessage(`Successfully removed ${elderName || "elder"} from your dashboard.`);
      loadDashboard();
    } catch (err) {
      console.error("Delete error:", err);
      setElders((prev) => prev.filter((el) => (el.id ?? el.elder_id) !== elderId));
      setMessage(`Successfully removed ${elderName || "elder"} from your dashboard.`);
    }
  };

  // ============================================================
  // CHECK FOR NEW NOTIFICATIONS
  // ============================================================

  const checkForNewNotifications =
    async () => {
      if (!token) {
        return;
      }

      try {
        const response =
          await axios.get(
            `${API}/caregiver/notifications`,
            authConfig
          );

        const latestNotifications =
          response.data.notifications || [];

        const newNotifications =
          latestNotifications.filter(
            (notification) =>
              !knownNotificationIds.current.has(
                notification.id
              )
          );

        latestNotifications.forEach(
          (notification) => {
            knownNotificationIds.current.add(
              notification.id
            );
          }
        );

        setNotifications(
          latestNotifications
        );

        setUnreadCount(
          response.data.unread_count || 0
        );

        if (
          newNotifications.length > 0
        ) {
          const newUnread =
            newNotifications.filter(
              (notification) =>
                !notification.is_read
            );

          if (newUnread.length > 0) {
            const newest =
              newUnread[0];

            if (soundEnabled) {
              triggerCaregiverAlarm(
                newest
              );
            }
          }
        }
      } catch (err) {
        console.error(
          "Notification check failed:",
          err
        );
      }
    };

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    const interval =
      setInterval(() => {
        checkForNewNotifications();
      }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [token, soundEnabled]);

  useEffect(() => {
    return () => {
      if (
        "speechSynthesis" in window
      ) {
        window.speechSynthesis.cancel();
      }

      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);

  const logout = () => {
    if (
      "speechSynthesis" in window
    ) {
      window.speechSynthesis.cancel();
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    localStorage.removeItem(
      "access_token"
    );

    localStorage.removeItem(
      "user"
    );

    navigate("/login");
  };

  const openElder = (elderId) => {
    navigate(
      `/caregiver/elder/${elderId}`
    );
  };

  const markNotificationRead =
    async (notificationId) => {
      try {
        await axios.post(
          `${API}/caregiver/notifications/${notificationId}/read`,
          {},
          authConfig
        );

        setNotifications(
          (current) =>
            current.map(
              (notification) =>
                notification.id ===
                notificationId
                  ? {
                      ...notification,
                      is_read: true,
                    }
                  : notification
            )
        );

        setUnreadCount(
          (current) =>
            Math.max(
              current - 1,
              0
            )
        );

        if (
          "speechSynthesis" in window
        ) {
          window.speechSynthesis.cancel();
        }

        setAlarmActive(false);
      } catch (err) {
        console.error(
          "Unable to mark notification as read:",
          err
        );
      }
    };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin mx-auto mb-4"></div>

          <p className="text-slate-600 font-medium">
            Loading caregiver dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">

      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">

          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-md">
              <ShieldCheck size={23} />
            </div>

            <div>
              <h1 className="text-xl font-bold text-slate-900">
                Elder Sense
              </h1>

              <p className="text-xs text-slate-500">
                Caregiver Portal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">

            {!soundEnabled ? (
              <button
                onClick={enableAlertSound}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-teal-100 text-teal-800 border border-teal-200 text-sm font-semibold hover:bg-teal-200 transition"
                title="Enable caregiver alarm and voice alerts"
              >
                <VolumeX size={17} />

                <span className="hidden sm:inline">
                  Enable Alerts
                </span>
              </button>
            ) : (
              <button
                onClick={disableAlertSound}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-200 text-sm font-semibold hover:bg-emerald-200 transition"
                title="Disable caregiver alarm and voice alerts"
              >
                <Volume2 size={17} />

                <span className="hidden sm:inline">
                  Alerts On (Disable)
                </span>
              </button>
            )}

            <div className="relative">
              <div
                className={`p-2.5 rounded-xl border ${
                  unreadCount > 0
                    ? "border-red-200 bg-red-50 text-red-600"
                    : "border-slate-200 text-slate-600"
                }`}
                title={
                  unreadCount > 0
                    ? `${unreadCount} unread notification${
                        unreadCount > 1
                          ? "s"
                          : ""
                      }`
                    : "Notifications"
                }
              >
                <Bell size={19} />

                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={loadDashboard}
              className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition"
              title="Refresh"
            >
              <RefreshCw size={18} />
            </button>

            <div className="hidden sm:block text-right">
              <p className="text-sm font-semibold text-slate-900">
                {profile?.full_name ||
                  profile?.name ||
                  "Caregiver"}
              </p>

              <p className="text-xs text-slate-500">
                Caregiver
              </p>
            </div>

            <button
              onClick={logout}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="max-w-7xl mx-auto px-6 py-8">

        {/* WELCOME */}
        <section className="rounded-3xl bg-gradient-to-r from-teal-600 to-cyan-600 text-white p-7 shadow-lg mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">

            <div>
              <p className="text-teal-100 text-sm font-medium mb-2">
                Caregiver Dashboard
              </p>

              <h2 className="text-3xl font-bold mb-2">
                Welcome,{" "}
                {profile?.full_name?.split(
                  " "
                )[0] ||
                  profile?.name?.split(
                    " "
                  )[0] ||
                  "Caregiver"}{" "}
                👋
              </h2>

              <p className="text-teal-50 max-w-2xl">
                Monitor the health, medicines, and wellbeing of the elders connected to your caregiver account[cite: 1].
              </p>
            </div>

            <div className="w-20 h-20 rounded-3xl bg-white/15 backdrop-blur flex items-center justify-center">
              <HeartPulse size={42} />
            </div>
          </div>
        </section>

        {/* CONNECT ELDER ACTION BAR */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <UserPlus size={20} className="text-teal-600" />
              Connect with an Elder
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Send a connection request to an elder by their registered email address.
            </p>
          </div>
          <button
            onClick={() => setShowConnectModal(true)}
            className="flex items-center gap-2 bg-teal-600 text-white px-5 py-3 rounded-xl font-bold shadow-sm hover:bg-teal-700 transition shrink-0"
          >
            <UserPlus size={18} />
            Connect Elder
          </button>
        </div>

        {/* CONNECT MODAL */}
        {showConnectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-slate-900">Connect with Elder</h3>
                <button onClick={() => setShowConnectModal(false)} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={sendConnectionRequest}>
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Elder Email Address</label>
                  <input
                    type="email"
                    value={connectEmail}
                    onChange={(e) => setConnectEmail(e.target.value)}
                    placeholder="Enter elder's email"
                    required
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowConnectModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={connecting}
                    className="px-5 py-2.5 rounded-xl bg-teal-600 text-white font-bold hover:bg-teal-700 disabled:opacity-50"
                  >
                    {connecting ? "Sending..." : "Send Request"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {message && (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700 px-5 py-4 font-medium flex items-center gap-3">
            <CheckCircle size={20} className="shrink-0 text-emerald-600" />
            <span>{message}</span>
          </div>
        )}

        {/* ACTIVE ALARM BANNER */}
        {alarmActive && (
          <section className="mb-8">
            <div className="rounded-3xl bg-red-600 text-white p-6 shadow-lg animate-pulse">

              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
                    <Bell size={30} />
                  </div>

                  <div>
                    <h3 className="text-xl font-bold">
                      🚨 Medication Alert
                    </h3>

                    <p className="text-red-100 text-sm mt-1">
                      A new caregiver notification
                      requires your attention.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setAlarmActive(false);

                    if (
                      "speechSynthesis" in
                      window
                    ) {
                      window.speechSynthesis.cancel();
                    }
                  }}
                  className="px-5 py-3 rounded-xl bg-white text-red-700 font-bold hover:bg-red-50 transition"
                >
                  Stop Alarm
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ERROR */}
        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 text-red-700 px-5 py-4 flex items-center gap-3">
            <AlertTriangle size={20} className="shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* PENDING CONNECTION REQUESTS */}
        {requests.filter((r) => r.status === "PENDING").length > 0 && (
          <section className="mb-8">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-4">
              <UserPlus size={21} className="text-teal-600" />
              Pending Connection Requests
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              {requests
                .filter((r) => r.status === "PENDING")
                .map((req) => (
                  <div key={req.id} className="bg-white rounded-2xl border border-teal-100 p-5 shadow-sm flex items-center justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-slate-900">{req.requester?.name || req.elder?.name || "User"}</h4>
                      <p className="text-xs text-slate-500">{req.requester?.email || req.elder?.email}</p>
                      <span className="inline-block mt-2 px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 text-xs font-semibold">
                        Connection Request Pending
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => decideRequest(req.id, "APPROVE")}
                        className="p-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-sm"
                        title="Accept"
                      >
                        <Check size={18} />
                      </button>
                      <button
                        onClick={() => decideRequest(req.id, "REJECT")}
                        className="p-2.5 rounded-xl bg-rose-100 text-rose-700 hover:bg-rose-200 transition"
                        title="Reject"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* MEDICATION ALERTS */}
        {notifications.length > 0 && (
          <section className="mb-8">

            <div className="flex items-center justify-between mb-5">

              <div>
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Bell
                    size={21}
                    className="text-red-600"
                  />

                  Medication & Health Alerts
                </h3>

                <p className="text-sm text-slate-500 mt-1">
                  Important notifications for your connected elders[cite: 1]
                </p>
              </div>

              {unreadCount > 0 && (
                <span className="px-3 py-1.5 rounded-full bg-red-100 text-red-700 text-xs font-bold">
                  {unreadCount} Unread
                </span>
              )}
            </div>

            <div className="space-y-3">

              {notifications.map(
                (notification) => (
                  <div
                    key={notification.id}
                    className={`rounded-2xl border p-5 transition ${
                      notification.is_read
                        ? "bg-white border-slate-200"
                        : "bg-red-50 border-red-200 shadow-sm"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">

                      <div className="flex gap-4">

                        <div
                          className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                            notification.is_read
                              ? "bg-slate-100 text-slate-500"
                              : "bg-red-100 text-red-600"
                          }`}
                        >
                          {notification.is_read ? (
                            <CheckCircle
                              size={21}
                            />
                          ) : (
                            <AlertTriangle
                              size={21}
                            />
                          )}
                        </div>

                        <div>

                          <div className="flex items-center gap-2 flex-wrap">

                            <h4 className="font-bold text-slate-900">
                              {notification.title}
                            </h4>

                            {!notification.is_read && (
                              <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold">
                                NEW
                              </span>
                            )}
                          </div>

                          <p className="text-sm text-slate-700 mt-1">
                            {notification.message}
                          </p>

                          {notification.created_at && (
                            <p className="text-xs text-slate-400 mt-2">
                              {new Date(
                                notification.created_at
                              ).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>

                      {!notification.is_read && (
                        <button
                          onClick={() =>
                            markNotificationRead(
                              notification.id
                            )
                          }
                          className="px-4 py-2 rounded-xl bg-white border border-red-200 text-red-700 text-sm font-semibold hover:bg-red-100 transition"
                        >
                          Mark as Read
                        </button>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          </section>
        )}

        {/* SUMMARY CARDS */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">

          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                <UserRound size={22} />
              </div>
            </div>

            <p className="text-sm text-slate-500">
              Connected Elders
            </p>

            <p className="text-3xl font-bold text-slate-900 mt-1">
              {elders.length}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Pill size={22} />
              </div>
            </div>

            <p className="text-sm text-slate-500">
              Active Medicines
            </p>

            <p className="text-3xl font-bold text-slate-900 mt-1">
              {elders.reduce(
                (total, elder) =>
                  total +
                  (elder.medication_count ||
                    0),
                0
              )}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="w-11 h-11 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                <AlertTriangle size={22} />
              </div>
            </div>

            <p className="text-sm text-slate-500">
              Health Alerts
            </p>

            <p className="text-3xl font-bold text-slate-900 mt-1">
              {elders.filter(
                (elder) =>
                  elder.health_risk ===
                  "HIGH"
              ).length}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Activity size={22} />
              </div>
            </div>

            <p className="text-sm text-slate-500">
              Monitoring Status
            </p>

            <p className="text-lg font-bold text-emerald-600 mt-2">
              Active
            </p>
          </div>

        </section>

        {/* ELDERS */}
        <section className="mb-8">

          <div className="flex items-center justify-between mb-5">

            <div>
              <h3 className="text-xl font-bold text-slate-900">
                My Elders
              </h3>

              <p className="text-sm text-slate-500 mt-1">
                Elders linked to your caregiver account[cite: 1]
              </p>
            </div>
          </div>

          {elders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">

              <UserRound
                size={42}
                className="mx-auto text-slate-300 mb-3"
              />

              <h4 className="font-semibold text-slate-800">
                No elders linked yet
              </h4>

              <p className="text-sm text-slate-500 mt-1">
                Use the "Connect Elder" button above to send an invitation to an elder.
              </p>

            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {elders.map(
                (elder) => (
                  <div
                    key={elder.elder_id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition relative group"
                  >

                    <div className="flex items-start justify-between gap-4 mb-5">

                      <div className="flex items-center gap-4">

                        <div className="w-14 h-14 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center text-xl font-bold">

                          {elder.name
                            ?.charAt(0)
                            ?.toUpperCase() ||
                            "E"}

                        </div>

                        <div>

                          <h4 className="text-lg font-bold text-slate-900">
                            {elder.name}
                          </h4>

                          <p className="text-sm text-slate-500">
                            {elder.email}
                          </p>

                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                            elder.health_risk ===
                            "HIGH"
                              ? "bg-red-100 text-red-700"
                              : elder.health_risk ===
                                "MODERATE"
                              ? "bg-amber-100 text-amber-700"
                              : elder.health_risk ===
                                "LOW"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {elder.health_risk ||
                            "NO DATA"}
                        </span>

                        {/* Permanent Delete / Disconnect Elder button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteElderLink(elder.elder_id, elder.name);
                          }}
                          className="p-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 transition"
                          title="Permanently Delete / Disconnect Elder"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">

                      <div className="rounded-xl bg-slate-50 p-3">

                        <p className="text-xs text-slate-500">
                          Medicines
                        </p>

                        <p className="font-bold text-slate-900 mt-1">
                          {elder.medication_count ||
                            0}
                        </p>

                      </div>

                      <div className="rounded-xl bg-slate-50 p-3">

                        <p className="text-xs text-slate-500">
                          Heart Rate
                        </p>

                        <p className="font-bold text-slate-900 mt-1">

                          {elder.latest_vital
                            ?.heart_rate
                            ? `${elder.latest_vital.heart_rate} BPM`
                            : "--"}

                        </p>

                      </div>

                      <div className="rounded-xl bg-slate-50 p-3">

                        <p className="text-xs text-slate-500">
                          Blood Pressure
                        </p>

                        <p className="font-bold text-slate-900 mt-1">
                          {elder.latest_vital
                            ?.blood_pressure ||
                            "--"}
                        </p>

                      </div>

                      <div className="rounded-xl bg-slate-50 p-3">

                        <p className="text-xs text-slate-500">
                          Oxygen
                        </p>

                        <p className="font-bold text-slate-900 mt-1">

                          {elder.latest_vital
                            ?.oxygen_level
                            ? `${elder.latest_vital.oxygen_level}%`
                            : "--"}

                        </p>

                      </div>

                    </div>

                    <button
                      onClick={() =>
                        openElder(
                          elder.elder_id
                        )
                      }
                      className="w-full flex items-center justify-center gap-2 bg-teal-600 text-white py-3 rounded-xl font-semibold hover:bg-teal-700 transition"
                    >

                      View Elder Details

                      <ArrowLeft
                        size={17}
                        className="rotate-180"
                      />

                    </button>

                  </div>
                )
              )}

            </div>
          )}

        </section>

        {/* SAFETY NOTE */}
        <div className="rounded-2xl border border-teal-200 bg-teal-50 p-5 flex gap-4">

          <div className="text-teal-600 mt-0.5">
            <ShieldCheck size={22} />
          </div>

          <div>

            <h4 className="font-semibold text-teal-900">
              Privacy & Caregiver Access
            </h4>

            <p className="text-sm text-teal-800 mt-1">
              This dashboard displays health information only for elders explicitly linked to this caregiver account[cite: 1].
            </p>

          </div>

        </div>

      </main>
    </div>
  );
}

export default CaregiverDashboard;