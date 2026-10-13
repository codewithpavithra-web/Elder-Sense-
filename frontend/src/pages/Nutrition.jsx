
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  ArrowLeft,
  Utensils,
  Plus,
  Apple,
  Flame,
  HeartPulse,
  CheckCircle,
  Clock,
  Camera,
  X,
  ScanLine,
  LoaderCircle,
  Sparkles,
  Pill,
  AlertTriangle,
  Download,
  ShieldCheck,
  RefreshCw,
  Trash2,
} from "lucide-react";

const API = import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:5000/api`;

function Nutrition() {
  const navigate = useNavigate();

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [message, setMessage] = useState("");

  const [cameraOpen, setCameraOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [cameraError, setCameraError] = useState("");
  const [cameraFacingMode, setCameraFacingMode] =
    useState("environment");

  const [guidance, setGuidance] = useState(null);
  const [guidanceLoading, setGuidanceLoading] = useState(false);
  const [guidanceError, setGuidanceError] = useState("");

  const [mealSuggestions, setMealSuggestions] = useState(null);
  const [mealSuggestionsLoading, setMealSuggestionsLoading] =
    useState(false);
  const [mealSuggestionsError, setMealSuggestionsError] =
    useState("");

  const [form, setForm] = useState({
    meal_type: "Breakfast",
    food_items: "",
    calories: "",
    nutrition_score: "",
    notes: "",
  });

  const getToken = () => {
    return localStorage.getItem("access_token");
  };

  // ==========================================================
  // FETCH NUTRITION RECORDS
  // ==========================================================

  const fetchRecords = async () => {
    try {
      const token = getToken();

      if (!token) {
        navigate("/login");
        return;
      }

      const response = await axios.get(`${API}/nutrition`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = response.data;

      if (Array.isArray(data)) {
        setRecords(data);
      } else {
        setRecords(data?.records || []);
      }
    } catch (error) {
      console.error("Nutrition fetch error:", error);

      if (error.response?.status === 401) {
        navigate("/login");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
        });

        streamRef.current = null;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.onloadedmetadata = null;
        videoRef.current.onloadeddata = null;
      }
    };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setMessage("");
  };

  // ==========================================================
  // MEDICATION FOOD GUIDANCE
  // ==========================================================

  const loadMedicationGuidance = async () => {
    try {
      setGuidanceLoading(true);
      setGuidanceError("");

      const token = getToken();

      if (!token) {
        navigate("/login");
        return;
      }

      const response = await axios.get(
        `${API}/nutrition/medication-guidance`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          timeout: 120000,
        }
      );

      const data = response.data;

      setGuidance({
        ...data,
        has_medications:
          data?.has_medications ??
          data?.has_active_medications ??
          false,

        recommendations:
          data?.recommendations || {
            recommended_foods:
              data?.foods_to_consider || [],

            foods_to_limit:
              data?.foods_to_limit || [],

            summary:
              data?.summary || "",

            safety_note:
              data?.safety_note || "",
          },
      });
    } catch (error) {
      console.error("Medication guidance error:", error);

      if (error.response?.status === 401) {
        navigate("/login");
        return;
      }

      setGuidanceError(
        error.response?.data?.message ||
          error.message ||
          "Unable to generate food guidance."
      );
    } finally {
      setGuidanceLoading(false);
    }
  };

  // ==========================================================
  // AI MEAL SUGGESTIONS
  // ==========================================================

  const loadMealSuggestions = async () => {
    try {
      setMealSuggestionsLoading(true);
      setMealSuggestionsError("");

      const token = getToken();

      if (!token) {
        navigate("/login");
        return;
      }

      const response = await axios.get(
        `${API}/nutrition/meal-suggestions`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          timeout: 120000,
        }
      );

      setMealSuggestions(response.data || null);
    } catch (error) {
      console.error("Meal suggestions error:", error);

      if (error.response?.status === 401) {
        navigate("/login");
        return;
      }

      setMealSuggestionsError(
        error.response?.data?.message ||
          error.message ||
          "Unable to generate meal suggestions."
      );
    } finally {
      setMealSuggestionsLoading(false);
    }
  };

  // ==========================================================
  // MANUAL FOOD AI ESTIMATION
  // ==========================================================

  const estimateManualNutrition = async () => {
    if (!form.food_items.trim()) {
      setMessage("Please enter the food items first.");
      return;
    }

    try {
      setEstimating(true);
      setMessage("");
      setScanResult(null);

      const token = getToken();

      if (!token) {
        navigate("/login");
        return;
      }

      const response = await axios.post(
        `${API}/nutrition/estimate`,
        {
          meal_type: form.meal_type,
          food_items: form.food_items,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          timeout: 120000,
        }
      );

      const data = response.data;
      const analysis = data?.analysis || data;

      if (!analysis) {
        throw new Error(
          data?.message ||
            "Nutrition estimation failed."
        );
      }

      setScanResult({
        ...analysis,
        source: "manual",
        disclaimer:
          data?.disclaimer ||
          analysis?.disclaimer ||
          "Calories and macronutrients are AI estimates based on the entered foods and assumed serving sizes. They are not exact measurements.",
      });

      const foodText =
        analysis.food_items ||
        analysis.identified_foods
          ?.map((food) => food.name)
          .join(", ") ||
        form.food_items;

      setForm((previous) => ({
        ...previous,

        food_items: foodText,

        calories:
          analysis.total_estimated_calories !==
          undefined
            ? String(
                analysis.total_estimated_calories
              )
            : "",

        nutrition_score:
          analysis.nutrition_score !==
          undefined
            ? String(
                analysis.nutrition_score
              )
            : "",
      }));

      setMessage(
        "AI nutrition estimate generated. Please review it before saving."
      );
    } catch (error) {
      console.error(
        "Manual nutrition estimation error:",
        error
      );

      if (error.response?.status === 401) {
        navigate("/login");
        return;
      }

      setMessage(
        error.response?.data?.message ||
          error.message ||
          "Unable to estimate nutrition. Please try again."
      );
    } finally {
      setEstimating(false);
    }
  };

  // ==========================================================
  // CAMERA HELPERS
  // ==========================================================

  const stopCurrentStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });

      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.onloadedmetadata = null;
      videoRef.current.onloadeddata = null;
    }
  };

  const attachCameraStream = (stream) => {
    streamRef.current = stream;

    setCameraOpen(true);

    requestAnimationFrame(() => {
      if (!videoRef.current) {
        return;
      }

      const video = videoRef.current;

      video.srcObject = stream;

      const handleReady = async () => {
        try {
          await video.play();
        } catch (error) {
          console.error(
            "Video playback error:",
            error
          );
        }
      };

      if (video.readyState >= 2) {
        handleReady();
      } else {
        video.onloadedmetadata = handleReady;
      }
    });
  };

  const getCameraStream = async (facingMode) => {
    return navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: {
          ideal: facingMode,
        },
        width: {
          ideal: 1280,
        },
        height: {
          ideal: 720,
        },
      },
      audio: false,
    });
  };

  // ==========================================================
  // START CAMERA
  // ==========================================================

  const startCamera = async (
    requestedFacingMode = cameraFacingMode
  ) => {
    setCameraError("");
    setScanResult(null);
    setMessage("");

    try {
      if (
        !navigator.mediaDevices?.getUserMedia
      ) {
        setCameraError(
          "Camera access is not supported by this browser."
        );
        return;
      }

      stopCurrentStream();

      const stream = await getCameraStream(
        requestedFacingMode
      );

      setCameraFacingMode(
        requestedFacingMode
      );

      attachCameraStream(stream);
    } catch (error) {
      console.error(
        "Camera error:",
        error
      );

      if (
        error.name ===
        "NotAllowedError"
      ) {
        setCameraError(
          "Camera permission was denied. Please allow camera access and try again."
        );
      } else if (
        error.name ===
        "NotFoundError"
      ) {
        setCameraError(
          "No camera was found on this device."
        );
      } else if (
        error.name ===
          "OverconstrainedError" ||
        error.name ===
          "NotReadableError"
      ) {
        setCameraError(
          "This camera is not available right now. Please try the other camera or close other apps using the camera."
        );
      } else {
        setCameraError(
          "Unable to access the camera. Please try again."
        );
      }
    }
  };

  // ==========================================================
  // SWITCH CAMERA
  // ==========================================================

  const switchCamera = async () => {
    if (scanning) {
      return;
    }

    setCameraError("");

    const nextFacingMode =
      cameraFacingMode === "environment"
        ? "user"
        : "environment";

    try {
      if (
        !navigator.mediaDevices?.getUserMedia
      ) {
        setCameraError(
          "Camera switching is not supported by this browser."
        );
        return;
      }

      const newStream =
        await getCameraStream(
          nextFacingMode
        );

      stopCurrentStream();

      setCameraFacingMode(
        nextFacingMode
      );

      attachCameraStream(newStream);
    } catch (error) {
      console.error(
        "Camera switch error:",
        error
      );

      if (
        error.name ===
        "NotFoundError"
      ) {
        setCameraError(
          "The other camera was not found on this device."
        );
      } else if (
        error.name ===
          "OverconstrainedError" ||
        error.name ===
          "NotReadableError"
      ) {
        setCameraError(
          "The other camera is not available right now."
        );
      } else if (
        error.name ===
        "NotAllowedError"
      ) {
        setCameraError(
          "Camera permission is required to switch cameras."
        );
      } else {
        setCameraError(
          "Unable to switch camera. Your device may have only one available camera."
        );
      }
    }
  };

  const stopCamera = () => {
    stopCurrentStream();
    setCameraOpen(false);
    setScanning(false);
  };

  // ==========================================================
  // CAMERA FOOD ANALYSIS
  // ==========================================================

  const captureFoodImage = async () => {
    if (!videoRef.current || scanning) {
      return;
    }

    setScanning(true);
    setCameraError("");
    setMessage("");

    try {
      const video = videoRef.current;

      if (
        video.readyState < 2 ||
        !video.videoWidth ||
        !video.videoHeight
      ) {
        await new Promise((resolve) => {
          const timeout = setTimeout(
            resolve,
            3000
          );

          video.onloadeddata = () => {
            clearTimeout(timeout);
            resolve();
          };
        });
      }

      if (
        !video.videoWidth ||
        !video.videoHeight
      ) {
        throw new Error(
          "Camera is not ready yet. Please wait a moment and try again."
        );
      }

      const canvas =
        document.createElement("canvas");

      const maxWidth = 1280;

      const scale =
        video.videoWidth > maxWidth
          ? maxWidth /
            video.videoWidth
          : 1;

      canvas.width = Math.round(
        video.videoWidth * scale
      );

      canvas.height = Math.round(
        video.videoHeight * scale
      );

      const context =
        canvas.getContext("2d");

      if (!context) {
        throw new Error(
          "Unable to capture the camera image."
        );
      }

      context.drawImage(
        video,
        0,
        0,
        canvas.width,
        canvas.height
      );

      const imageData =
        canvas.toDataURL(
          "image/jpeg",
          0.82
        );

      const token = getToken();

      if (!token) {
        navigate("/login");
        return;
      }

      const response = await axios.post(
        `${API}/nutrition/scan`,
        {
          image: imageData,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          timeout: 120000,
        }
      );

      const data = response.data;
      const analysis =
        data?.analysis || data;

      if (!analysis) {
        throw new Error(
          data?.message ||
            "Food analysis failed."
        );
      }

      setScanResult({
        ...analysis,
        source: "camera",
        disclaimer:
          data?.disclaimer ||
          analysis?.disclaimer ||
          "Calories and macronutrients are AI estimates based on the photograph and estimated portion size. They are not exact measurements.",
      });

      const foodText =
        analysis.food_items ||
        analysis.identified_foods
          ?.map((food) => food.name)
          .join(", ") ||
        "";

      setForm((previous) => ({
        ...previous,

        food_items: foodText,

        calories:
          analysis.total_estimated_calories !==
          undefined
            ? String(
                analysis.total_estimated_calories
              )
            : "",

        nutrition_score:
          analysis.nutrition_score !==
          undefined
            ? String(
                analysis.nutrition_score
              )
            : "",
      }));

      stopCamera();

      setMessage(
        "Meal analyzed successfully. Please review the AI estimate before saving."
      );
    } catch (error) {
      console.error(
        "Food scan error:",
        error
      );

      if (error.response?.status === 401) {
        navigate("/login");
        return;
      }

      setCameraError(
        error.response?.data?.message ||
          error.message ||
          "Unable to analyze the food image. Please try again."
      );
    } finally {
      setScanning(false);
    }
  };

  // ==========================================================
  // CLEAR ESTIMATE
  // ==========================================================

  const clearEstimate = () => {
    setScanResult(null);

    setForm((previous) => ({
      ...previous,
      calories: "",
      nutrition_score: "",
    }));

    setMessage("");
  };

  // ==========================================================
  // SAVE NUTRITION RECORD
  // ==========================================================

  const addNutritionRecord = async (e) => {
    e.preventDefault();

    if (!form.food_items.trim()) {
      setMessage(
        "Please enter the food items or scan your meal."
      );
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const token = getToken();

      if (!token) {
        navigate("/login");
        return;
      }

      await axios.post(
        `${API}/nutrition`,
        {
          meal_type: form.meal_type,
          food_items: form.food_items,

          calories: form.calories
            ? Number(form.calories)
            : null,

          nutrition_score:
            form.nutrition_score
              ? Number(
                  form.nutrition_score
                )
              : null,

          notes: form.notes,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setMessage(
        "Nutrition record added successfully!"
      );

      setForm({
        meal_type: "Breakfast",
        food_items: "",
        calories: "",
        nutrition_score: "",
        notes: "",
      });

      setScanResult(null);

      await fetchRecords();

      setMealSuggestions(null);
    } catch (error) {
      console.error(
        "Nutrition save error:",
        error
      );

      setMessage(
        error.response?.data?.message ||
          "Unable to save nutrition record."
      );
    } finally {
      setSaving(false);
    }
  };

  // ==========================================================
  // DELETE NUTRITION RECORD
  // ==========================================================

  const deleteNutritionRecord = async (recordId) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this nutrition record?"
    );

    if (!confirmed) {
      return;
    }

    try {
      const token = getToken();

      if (!token) {
        navigate("/login");
        return;
      }

      await axios.delete(
        `${API}/nutrition/${recordId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setRecords((previous) =>
        previous.filter(
          (record) => record.id !== recordId
        )
      );

      setMessage(
        "Nutrition record deleted successfully."
      );

      setMealSuggestions(null);
    } catch (error) {
      console.error(
        "Nutrition delete error:",
        error
      );

      if (error.response?.status === 401) {
        navigate("/login");
        return;
      }

      setMessage(
        error.response?.data?.message ||
          "Unable to delete nutrition record."
      );
    }
  };

  // ==========================================================
  // DOWNLOAD HISTORY
  // ==========================================================

  const downloadNutritionHistory = () => {
    if (!records.length) {
      setMessage(
        "There are no nutrition records to download."
      );
      return;
    }

    const headers = [
      "Date",
      "Time",
      "Meal Type",
      "Food Items",
      "Estimated Calories",
      "Nutrition Score",
      "Notes",
    ];

    const rows = records.map((record) => {
      let date = "";
      let time = "";

      if (record.recorded_at) {
        const rawDate =
          String(record.recorded_at);

        const parsedDate = new Date(
          rawDate.endsWith("Z")
            ? rawDate
            : `${rawDate}Z`
        );

        if (
          !Number.isNaN(
            parsedDate.getTime()
          )
        ) {
          date =
            parsedDate.toLocaleDateString(
              "en-IN",
              {
                timeZone:
                  "Asia/Kolkata",
              }
            );

          time =
            parsedDate.toLocaleTimeString(
              "en-IN",
              {
                timeZone:
                  "Asia/Kolkata",
                hour: "2-digit",
                minute: "2-digit",
              }
            );
        }
      }

      return [
        date,
        time,
        record.meal_type || "",
        record.food_items || "",
        record.calories ?? "",
        record.nutrition_score ?? "",
        record.notes || "",
      ];
    });

    const escapeCsv = (value) => {
      const text = String(
        value ?? ""
      );

      return `"${text.replace(
        /"/g,
        '""'
      )}"`;
    };

    const csvContent = [
      headers,
      ...rows,
    ]
      .map((row) =>
        row
          .map(escapeCsv)
          .join(",")
      )
      .join("\n");

    const blob = new Blob(
      [csvContent],
      {
        type: "text/csv;charset=utf-8;",
      }
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;

    link.download =
      `elder-sense-nutrition-history-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);

    setMessage(
      "Nutrition history downloaded successfully."
    );
  };

  // ==========================================================
  // TODAY'S NUTRITION SUMMARY
  // ==========================================================

  const todayIndiaKey = new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(new Date());

  const getRecordIndiaDateKey = (record) => {
    if (!record?.recorded_at) {
      return "";
    }

    const rawDate = String(record.recorded_at);

    const parsedDate = new Date(
      rawDate.endsWith("Z")
        ? rawDate
        : `${rawDate}Z`
    );

    if (Number.isNaN(parsedDate.getTime())) {
      return "";
    }

    return new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    ).format(parsedDate);
  };

  const todayRecords = records.filter(
    (record) =>
      getRecordIndiaDateKey(record) ===
      todayIndiaKey
  );

  const todayAverageScore =
    todayRecords.length > 0
      ? Math.round(
          todayRecords.reduce(
            (sum, record) =>
              sum +
              Number(
                record.nutrition_score || 0
              ),
            0
          ) / todayRecords.length
        )
      : 0;

  const todayCalories =
    todayRecords.reduce(
      (sum, record) =>
        sum +
        Number(
          record.calories || 0
        ),
      0
    );

  // ==========================================================
  // ELDER-FRIENDLY NUTRITION STATUS
  // ==========================================================

  const getTodayNutritionStatus = () => {
    if (todayRecords.length === 0) {
      return {
        title: "No meals today",
        message:
          "Record your meals today to see how your eating is going.",
        textClass: "text-slate-600",
        borderClass: "border-slate-200",
        iconBgClass: "bg-slate-100",
        iconClass: "text-slate-500",
        dotClass: "bg-slate-400",
      };
    }

    if (todayAverageScore >= 80) {
      return {
        title: "Healthy eating today!",
        message:
          "Great job! Your meals today have a good overall nutrition score.",
        textClass: "text-emerald-600",
        borderClass: "border-emerald-200",
        iconBgClass: "bg-emerald-100",
        iconClass: "text-emerald-600",
        dotClass: "bg-emerald-500",
      };
    }

    if (todayAverageScore >= 60) {
      return {
        title: "Good choices today",
        message:
          "Your meals are doing well. Try adding more vegetables and protein when possible.",
        textClass: "text-emerald-600",
        borderClass: "border-emerald-200",
        iconBgClass: "bg-emerald-100",
        iconClass: "text-emerald-600",
        dotClass: "bg-emerald-500",
      };
    }

    if (todayAverageScore >= 40) {
      return {
        title: "Needs more balance",
        message:
          "Try to make your next meal more balanced with vegetables, protein and a suitable staple food.",
        textClass: "text-orange-600",
        borderClass: "border-orange-200",
        iconBgClass: "bg-orange-100",
        iconClass: "text-orange-600",
        dotClass: "bg-orange-500",
      };
    }

    return {
      title: "Needs attention",
      message:
        "Today's meals may need more balance. Consider healthier and more varied food choices.",
      textClass: "text-red-600",
      borderClass: "border-red-200",
      iconBgClass: "bg-red-100",
      iconClass: "text-red-600",
      dotClass: "bg-red-500",
    };
  };

  const todayNutritionStatus =
    getTodayNutritionStatus();

  // ==========================================================
  // HISTORY DATE HELPERS
  // ==========================================================

  const getYesterdayIndiaKey = () => {
    const now = new Date();

    const indiaParts = new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    ).formatToParts(now);

    const year = Number(
      indiaParts.find(
        (part) => part.type === "year"
      )?.value
    );

    const month = Number(
      indiaParts.find(
        (part) => part.type === "month"
      )?.value
    );

    const day = Number(
      indiaParts.find(
        (part) => part.type === "day"
      )?.value
    );

    const yesterday = new Date(
      Date.UTC(
        year,
        month - 1,
        day - 1
      )
    );

    return new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: "UTC",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    ).format(yesterday);
  };

  const yesterdayIndiaKey =
    getYesterdayIndiaKey();

  const getHistoryScoreStyle = (score) => {
    const numericScore = Number(score);

    if (Number.isNaN(numericScore)) {
      return {
        badge:
          "bg-slate-100 text-slate-600 border border-slate-200",
        dot: "bg-slate-400",
        label: "No score",
      };
    }

    if (numericScore >= 80) {
      return {
        badge:
          "bg-emerald-100 text-emerald-700 border border-emerald-200",
        dot: "bg-emerald-500",
        label: "Excellent choice",
      };
    }

    if (numericScore >= 60) {
      return {
        badge:
          "bg-green-100 text-green-700 border border-green-200",
        dot: "bg-green-500",
        label: "Good choice",
      };
    }

    if (numericScore >= 40) {
      return {
        badge:
          "bg-orange-100 text-orange-700 border border-orange-200",
        dot: "bg-orange-500",
        label: "Needs more balance",
      };
    }

    if (numericScore >= 1) {
      return {
        badge:
          "bg-red-100 text-red-700 border border-red-200",
        dot: "bg-red-500",
        label: "Needs attention",
      };
    }

    return {
      badge:
        "bg-slate-100 text-slate-600 border border-slate-200",
      dot: "bg-slate-400",
      label: "No score",
    };
  };

  const formatHistoryDate = (dateKey) => {
    if (!dateKey) {
      return "Date unavailable";
    }

    const [year, month, day] =
      dateKey.split("-").map(Number);

    const date = new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

    return date.toLocaleDateString(
      "en-IN",
      {
        timeZone: "UTC",
        day: "numeric",
        month: "long",
        year: "numeric",
      }
    );
  };

  const groupedHistory = records.reduce(
    (groups, record) => {
      const dateKey =
        getRecordIndiaDateKey(record) ||
        "unknown";

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }

      groups[dateKey].push(record);

      return groups;
    },
    {}
  );

  const sortedHistoryGroups = Object.entries(
    groupedHistory
  ).sort(([dateA], [dateB]) => {
    if (dateA === "unknown") return 1;
    if (dateB === "unknown") return -1;

    return dateB.localeCompare(dateA);
  });

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-emerald-50 via-white to-teal-50 text-slate-800">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <header className="sticky top-0 z-20 border-b border-emerald-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">

          <div className="flex min-w-0 items-center gap-2 sm:gap-3">

            <button
              onClick={() =>
                navigate("/dashboard")
              }
              className="shrink-0 rounded-xl p-2 transition hover:bg-emerald-50"
            >
              <ArrowLeft size={22} />
            </button>

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg sm:h-11 sm:w-11">
              <Utensils size={20} />
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold sm:text-xl">
                Nutrition
              </h1>

              <p className="truncate text-xs text-slate-500 sm:text-sm">
                Healthy eating made simple
              </p>
            </div>

          </div>

          <div className="hidden items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 md:flex">
            <Apple size={16} />
            Elder Sense
          </div>

        </div>
      </header>

      {/* ======================================================
          MAIN
      ====================================================== */}

      <main className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-8">

        {/* HERO */}

        <div className="mb-6 rounded-3xl bg-gradient-to-r from-emerald-600 to-teal-500 p-5 text-white shadow-xl sm:mb-8 sm:p-7">

          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">

            <div>

              <p className="mb-2 text-sm font-medium text-emerald-100">
                🍎 Nutrition Tracker
              </p>

              <h2 className="text-2xl font-bold sm:text-3xl">
                Eat well, stay well.
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50 sm:text-base">
                Record your meals manually or use the camera
                to get an AI-based food, calorie and
                macronutrient estimate.
              </p>

            </div>

            <div className="hidden h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-white/15 sm:flex">
              <Apple size={42} />
            </div>

          </div>
        </div>

        {/* ======================================================
            TODAY'S SUMMARY CARDS
        ====================================================== */}

        <div className="mb-6 grid gap-4 sm:mb-8 sm:gap-5 sm:grid-cols-2 lg:grid-cols-4">

          <div className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5">

            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 sm:mb-4 sm:h-11 sm:w-11">
              <Utensils size={20} />
            </div>

            <p className="text-sm text-slate-500">
              Today's Meals
            </p>

            <p className="mt-1 text-3xl font-bold">
              {todayRecords.length}
            </p>

          </div>

          <div className="rounded-3xl border border-orange-100 bg-white p-4 shadow-sm sm:p-5">

            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-100 text-orange-600 sm:mb-4 sm:h-11 sm:w-11">
              <Flame size={20} />
            </div>

            <p className="text-sm text-slate-500">
              Today's Calories
            </p>

            <p className="mt-1 text-3xl font-bold">
              {todayCalories}
            </p>

            <p className="mt-1 text-xs text-slate-400">
              From meals recorded today
            </p>

          </div>

          <div className="rounded-3xl border border-teal-100 bg-white p-4 shadow-sm sm:p-5">

            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-100 text-teal-600 sm:mb-4 sm:h-11 sm:w-11">
              <HeartPulse size={20} />
            </div>

            <p className="text-sm text-slate-500">
              Today's Nutrition Score
            </p>

            <p className="mt-1 text-3xl font-bold">
              {todayAverageScore}

              <span className="text-base font-medium text-slate-400">
                /100
              </span>
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Higher score means better overall meal balance
            </p>

          </div>

          {/* ELDER-FRIENDLY STATUS CARD */}

          <div
            className={`rounded-3xl border bg-white p-4 shadow-sm sm:p-5 ${todayNutritionStatus.borderClass}`}
          >

            <div
              className={`mb-3 flex h-10 w-10 items-center justify-center rounded-2xl sm:mb-4 sm:h-11 sm:w-11 ${todayNutritionStatus.iconBgClass} ${todayNutritionStatus.iconClass}`}
            >
              <CheckCircle size={20} />
            </div>

            <p className="text-sm text-slate-500">
              Today's Nutrition Status
            </p>

            <div className="mt-2 flex items-start gap-2">

              <span
                className={`mt-2 h-3 w-3 shrink-0 rounded-full ${todayNutritionStatus.dotClass}`}
              />

              <p
                className={`text-lg font-bold leading-6 sm:text-xl ${todayNutritionStatus.textClass}`}
              >
                {todayNutritionStatus.title}
              </p>

            </div>

            <p className="mt-2 text-xs leading-5 text-slate-500">
              {todayNutritionStatus.message}
            </p>

          </div>

        </div>

        {/* ======================================================
            NUTRITION SCORE GUIDE
        ====================================================== */}

        <section className="mb-6 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:mb-8 sm:p-6">

          <div className="mb-4 flex items-center gap-3">

            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
              <HeartPulse size={21} />
            </div>

            <div>
              <h3 className="text-lg font-bold">
                🌈 Nutrition Score Guide
              </h3>

              <p className="text-sm text-slate-500">
                This guide explains what each score and color means.
              </p>
            </div>

          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">

            {/* 80-100 */}

            <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">

              <span className="h-4 w-4 shrink-0 rounded-full bg-emerald-500" />

              <div>
                <p className="text-base font-bold text-emerald-700">
                  80–100
                </p>

                <p className="text-sm font-semibold text-slate-700">
                  Excellent choice
                </p>
              </div>

            </div>

            {/* 60-79 */}

            <div className="flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 p-4">

              <span className="h-4 w-4 shrink-0 rounded-full bg-green-500" />

              <div>
                <p className="text-base font-bold text-green-700">
                  60–79
                </p>

                <p className="text-sm font-semibold text-slate-700">
                  Good choice
                </p>
              </div>

            </div>

            {/* 40-59 */}

            <div className="flex items-center gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-4">

              <span className="h-4 w-4 shrink-0 rounded-full bg-orange-500" />

              <div>
                <p className="text-base font-bold text-orange-700">
                  40–59
                </p>

                <p className="text-sm font-semibold text-slate-700">
                  Needs more balance
                </p>
              </div>

            </div>

            {/* 1-39 */}

            <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">

              <span className="h-4 w-4 shrink-0 rounded-full bg-red-500" />

              <div>
                <p className="text-base font-bold text-red-700">
                  1–39
                </p>

                <p className="text-sm font-semibold text-slate-700">
                  Needs attention
                </p>
              </div>

            </div>

            {/* NO MEALS */}

            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">

              <span className="h-4 w-4 shrink-0 rounded-full bg-slate-400" />

              <div>
                <p className="text-base font-bold text-slate-600">
                  No meals
                </p>

                <p className="text-sm font-semibold text-slate-700">
                  No meals today
                </p>
              </div>

            </div>

          </div>

        </section>

        {/* ======================================================
            RECORD + HISTORY
        ====================================================== */}

        <div className="grid gap-6 lg:grid-cols-[420px_1fr] lg:gap-8">

          {/* RECORD MEAL */}

          <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">

            <div className="mb-6 flex items-center gap-3">

              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                <Plus size={21} />
              </div>

              <div>
                <h3 className="text-lg font-bold">
                  Record a Meal
                </h3>

                <p className="text-sm text-slate-500">
                  Add food details or scan your meal
                </p>
              </div>

            </div>

            <form
              onSubmit={addNutritionRecord}
              className="space-y-4"
            >

              {/* MEAL TYPE */}

              <div>

                <label className="mb-1.5 block text-sm font-semibold">
                  Meal Type
                </label>

                <select
                  name="meal_type"
                  value={form.meal_type}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                >

                  <option>Breakfast</option>
                  <option>Lunch</option>
                  <option>Dinner</option>
                  <option>Snack</option>

                </select>

              </div>

              {/* FOOD ITEMS */}

              <div>

                <label className="mb-1.5 block text-sm font-semibold">
                  Food Items
                </label>

                <textarea
                  name="food_items"
                  value={form.food_items}
                  onChange={handleChange}
                  placeholder="Example: rice, sambar, egg"
                  rows="3"
                  className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />

              </div>

              {/* AI ESTIMATE */}

              <button
                type="button"
                onClick={estimateManualNutrition}
                disabled={estimating}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-5 py-3.5 font-semibold text-white shadow-lg shadow-teal-100 transition hover:bg-teal-700 disabled:opacity-60"
              >

                {estimating ? (
                  <>
                    <LoaderCircle
                      size={19}
                      className="animate-spin"
                    />
                    Estimating...
                  </>
                ) : (
                  <>
                    <Sparkles size={19} />
                    Estimate Nutrition
                  </>
                )}

              </button>

              {/* CAMERA BUTTON */}

              <button
                type="button"
                onClick={() => startCamera()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3.5 font-semibold text-emerald-700 transition hover:bg-emerald-100"
              >
                <Camera size={19} />
                Scan Meal With Camera
              </button>

              {cameraError && !cameraOpen && (
                <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  ⚠️ {cameraError}
                </div>
              )}

              {/* AI RESULT */}

              {scanResult && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">

                  <div className="mb-3 flex items-center justify-between">

                    <div className="flex items-center gap-2">

                      {scanResult.source === "camera" ? (
                        <Camera
                          size={18}
                          className="text-emerald-600"
                        />
                      ) : (
                        <Sparkles
                          size={18}
                          className="text-emerald-600"
                        />
                      )}

                      <p className="font-bold text-emerald-800">
                        {scanResult.source === "camera"
                          ? "AI Food Analysis"
                          : "AI Nutrition Estimate"}
                      </p>

                    </div>

                    <button
                      type="button"
                      onClick={clearEstimate}
                      className="rounded-lg p-1 text-slate-500 hover:bg-white"
                    >
                      <X size={17} />
                    </button>

                  </div>

                  {/* INDIVIDUAL FOODS */}

                  <div className="space-y-2">

                    {scanResult.identified_foods?.length > 0 ? (
                      scanResult.identified_foods.map(
                        (food, index) => (
                          <div
                            key={index}
                            className="rounded-xl bg-white p-3"
                          >

                            <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-3">

                              <span className="font-semibold capitalize">
                                {food.name}
                              </span>

                              <span className="font-semibold text-orange-600">
                                ~{food.estimated_calories} kcal
                              </span>

                            </div>

                            <div className="mt-1 flex flex-col gap-1 text-xs text-slate-500 sm:flex-row sm:justify-between sm:gap-2">

                              <span>
                                Portion:{" "}
                                {food.portion ||
                                  "Estimated serving"}
                              </span>

                              <span className="capitalize">
                                {food.confidence ||
                                  "Estimated"}{" "}
                                confidence
                              </span>

                            </div>

                            {/* FOOD MACROS */}

                            <div className="mt-2 grid grid-cols-3 gap-2 text-xs">

                              <div className="rounded-lg bg-emerald-50 p-2">
                                <span className="block text-slate-500">
                                  Protein
                                </span>

                                <strong className="text-emerald-700">
                                  {food.estimated_protein_grams ??
                                    0}
                                  g
                                </strong>
                              </div>

                              <div className="rounded-lg bg-blue-50 p-2">
                                <span className="block text-slate-500">
                                  Carbs
                                </span>

                                <strong className="text-blue-700">
                                  {food.estimated_carbohydrates_grams ??
                                    0}
                                  g
                                </strong>
                              </div>

                              <div className="rounded-lg bg-amber-50 p-2">
                                <span className="block text-slate-500">
                                  Fat
                                </span>

                                <strong className="text-amber-700">
                                  {food.estimated_fat_grams ??
                                    0}
                                  g
                                </strong>
                              </div>

                            </div>

                          </div>
                        )
                      )
                    ) : (
                      <p className="text-sm text-slate-600">
                        No food details were returned.
                      </p>
                    )}

                  </div>

                  {/* TOTAL NUTRITION */}

                  <div className="mt-4 border-t border-emerald-200 pt-3">

                    <div className="flex flex-col gap-1 font-bold text-emerald-800 sm:flex-row sm:justify-between">

                      <span>
                        Estimated Calories
                      </span>

                      <span>
                        ~
                        {scanResult.total_estimated_calories ??
                          0}{" "}
                        kcal
                      </span>

                    </div>

                    {/* MACRONUTRIENTS */}

                    <div className="mt-3 grid grid-cols-3 gap-2">

                      <div className="rounded-xl bg-white p-3 text-center">

                        <p className="text-xs text-slate-500">
                          Protein
                        </p>

                        <p className="mt-1 font-bold text-emerald-700">
                          {scanResult.protein_grams ??
                            0}
                          g
                        </p>

                      </div>

                      <div className="rounded-xl bg-white p-3 text-center">

                        <p className="text-xs text-slate-500">
                          Carbs
                        </p>

                        <p className="mt-1 font-bold text-blue-700">
                          {scanResult.carbohydrates_grams ??
                            0}
                          g
                        </p>

                      </div>

                      <div className="rounded-xl bg-white p-3 text-center">

                        <p className="text-xs text-slate-500">
                          Fat
                        </p>

                        <p className="mt-1 font-bold text-amber-700">
                          {scanResult.fat_grams ??
                            0}
                          g
                        </p>

                      </div>

                    </div>

                    {/* SCORE */}

                    <div className="mt-3 flex flex-col gap-1 text-sm font-semibold text-emerald-700 sm:flex-row sm:justify-between">

                      <span>
                        Nutrition Score
                      </span>

                      <span>
                        {scanResult.nutrition_score ??
                          0}
                        /100
                      </span>

                    </div>

                    {/* DISCLAIMER */}

                    <p className="mt-3 text-xs leading-5 text-amber-700">
                      ⚠️ {scanResult.disclaimer}
                    </p>

                    {scanResult.notes && (
                      <p className="mt-2 text-xs leading-5 text-slate-600">
                        {scanResult.notes}
                      </p>
                    )}

                  </div>

                </div>
              )}

              {/* CALORIES + SCORE */}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

                <div>

                  <label className="mb-1.5 block text-sm font-semibold">
                    Estimated Calories
                  </label>

                  <input
                    type="number"
                    name="calories"
                    value={form.calories}
                    onChange={handleChange}
                    placeholder="AI estimate"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />

                </div>

                <div>

                  <label className="mb-1.5 block text-sm font-semibold">
                    Nutrition Score
                  </label>

                  <input
                    type="number"
                    name="nutrition_score"
                    value={form.nutrition_score}
                    onChange={handleChange}
                    placeholder="0–100"
                    min="0"
                    max="100"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />

                </div>

              </div>

              {/* NOTES */}

              <div>

                <label className="mb-1.5 block text-sm font-semibold">
                  Notes
                </label>

                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  placeholder="Optional notes..."
                  rows="2"
                  className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />

              </div>

              {/* MESSAGE */}

              {message && (
                <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                  {message}
                </div>
              )}

              {/* SAVE */}

              <button
                type="submit"
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3.5 font-semibold text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700 disabled:opacity-60"
              >

                <Plus size={19} />

                {saving
                  ? "Saving..."
                  : "Save Nutrition Record"}

              </button>

            </form>

          </section>

          {/* ==================================================
              NUTRITION HISTORY
          ================================================== */}

          <section className="min-w-0 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">

            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

              <div>
                <h3 className="text-lg font-bold">
                  Nutrition History
                </h3>

                <p className="text-sm text-slate-500">
                  Your recent meal records
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">

                <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                  {records.length} records
                </div>

                <button
                  type="button"
                  onClick={downloadNutritionHistory}
                  disabled={records.length === 0}
                  className="flex items-center gap-2 rounded-xl bg-slate-800 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Download size={16} />
                  Download
                </button>

              </div>

            </div>

            {loading ? (
              <div className="flex min-h-60 items-center justify-center text-center text-slate-500">
                Loading nutrition records...
              </div>
            ) : records.length === 0 ? (
              <div className="flex min-h-60 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 px-4 text-center">

                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
                  <Apple size={30} />
                </div>

                <h4 className="font-semibold">
                  No meals recorded yet
                </h4>

                <p className="mt-1 max-w-sm text-sm text-slate-500">
                  Add your first meal using the form to start
                  tracking nutrition.
                </p>

              </div>
            ) : (
              <div className="space-y-6">

                {sortedHistoryGroups.map(
                  ([dateKey, groupRecords]) => {
                    const isToday =
                      dateKey === todayIndiaKey;

                    const isYesterday =
                      dateKey ===
                      yesterdayIndiaKey;

                    const groupContainerClass =
                      isToday
                        ? "border-emerald-200 bg-emerald-50/60"
                        : isYesterday
                        ? "border-blue-200 bg-blue-50/50"
                        : "border-slate-200 bg-slate-50/50";

                    const groupIconClass =
                      isToday
                        ? "bg-emerald-100 text-emerald-600"
                        : isYesterday
                        ? "bg-blue-100 text-blue-600"
                        : "bg-white text-slate-500";

                    const groupTitleClass =
                      isToday
                        ? "text-emerald-800"
                        : isYesterday
                        ? "text-blue-800"
                        : "text-slate-800";

                    return (
                      <div
                        key={dateKey}
                        className={`rounded-3xl border p-3 sm:p-5 ${groupContainerClass}`}
                      >

                        {/* DATE GROUP HEADER */}

                        <div className="mb-4 flex items-start justify-between gap-3">

                          <div className="flex min-w-0 items-start gap-3">

                            <div
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${groupIconClass}`}
                            >
                              <Clock size={19} />
                            </div>

                            <div className="min-w-0">

                              <div className="flex flex-wrap items-center gap-2">

                                <h4
                                  className={`font-bold ${groupTitleClass}`}
                                >
                                  {isToday
                                    ? "TODAY"
                                    : isYesterday
                                    ? "YESTERDAY"
                                    : formatHistoryDate(
                                        dateKey
                                      )}
                                </h4>

                                {isToday && (
                                  <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white">
                                    Today's Meals
                                  </span>
                                )}

                                {isYesterday && (
                                  <span className="rounded-full bg-blue-600 px-2.5 py-1 text-xs font-bold text-white">
                                    Yesterday's Meals
                                  </span>
                                )}

                              </div>

                              <p className="text-xs text-slate-500">
                                {isToday ||
                                isYesterday
                                  ? formatHistoryDate(
                                      dateKey
                                    )
                                  : `${groupRecords.length} meal${
                                      groupRecords.length ===
                                      1
                                        ? ""
                                        : "s"
                                    } recorded`}
                              </p>

                            </div>

                          </div>

                          <span
                            className={`hidden shrink-0 rounded-full px-3 py-1 text-xs font-semibold sm:inline-flex ${
                              isToday
                                ? "bg-white text-emerald-700"
                                : isYesterday
                                ? "bg-white text-blue-700"
                                : "bg-white text-slate-500"
                            }`}
                          >
                            {groupRecords.length}{" "}
                            {groupRecords.length ===
                            1
                              ? "meal"
                              : "meals"}
                          </span>

                        </div>

                        {/* MEALS FOR THIS DATE */}

                        <div className="space-y-3">

                          {groupRecords.map(
                            (record) => {
                              const scoreStyle =
                                getHistoryScoreStyle(
                                  record.nutrition_score
                                );

                              return (
                                <div
                                  key={record.id}
                                  className={`rounded-2xl border p-4 transition sm:p-5 ${
                                    isToday
                                      ? "border-emerald-100 bg-white hover:border-emerald-300"
                                      : isYesterday
                                      ? "border-blue-100 bg-white hover:border-blue-300"
                                      : "border-slate-100 bg-white hover:border-emerald-200"
                                  }`}
                                >

                                  <div className="flex gap-3 sm:gap-4">

                                    <div
                                      className={`hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl sm:flex ${
                                        isToday
                                          ? "bg-emerald-100 text-emerald-600"
                                          : isYesterday
                                          ? "bg-blue-100 text-blue-600"
                                          : "bg-slate-100 text-slate-500"
                                      }`}
                                    >
                                      <Utensils size={20} />
                                    </div>

                                    <div className="min-w-0 flex-1">

                                      <div className="flex flex-wrap items-center gap-2">

                                        <h4 className="font-bold">
                                          {record.meal_type}
                                        </h4>

                                        <span
                                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${scoreStyle.badge}`}
                                        >

                                          <span
                                            className={`h-2 w-2 rounded-full ${scoreStyle.dot}`}
                                          />

                                          {scoreStyle.label}

                                          <span className="hidden sm:inline">
                                            •
                                          </span>

                                          Score{" "}
                                          {record.nutrition_score ??
                                            "N/A"}

                                        </span>

                                      </div>

                                      <p className="mt-1 break-words text-sm text-slate-700">
                                        {record.food_items}
                                      </p>

                                      {record.notes && (
                                        <p className="mt-2 break-words text-sm text-slate-500">
                                          {record.notes}
                                        </p>
                                      )}

                                      <div className="mt-3 flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:flex-wrap sm:gap-4">

                                        <span className="flex items-center gap-1">
                                          <Flame size={14} />

                                          {record.calories ??
                                            0}{" "}
                                          kcal
                                        </span>

                                        <span className="flex items-center gap-1">
                                          <Clock size={14} />

                                          {record.recorded_at
                                            ? new Date(
                                                record.recorded_at.endsWith(
                                                  "Z"
                                                )
                                                  ? record.recorded_at
                                                  : `${record.recorded_at}Z`
                                              ).toLocaleString(
                                                "en-IN",
                                                {
                                                  timeZone:
                                                    "Asia/Kolkata",
                                                }
                                              )
                                            : "Recently"}
                                        </span>

                                      </div>

                                      {/* DELETE BUTTON */}

                                      <div className="mt-3 flex justify-end">

                                        <button
                                          type="button"
                                          onClick={() =>
                                            deleteNutritionRecord(
                                              record.id
                                            )
                                          }
                                          className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100"
                                        >
                                          <Trash2 size={15} />
                                          Delete
                                        </button>

                                      </div>

                                    </div>

                                  </div>

                                </div>
                              );
                            }
                          )}

                        </div>

                      </div>
                    );
                  }
                )}

              </div>
            )}

          </section>

        </div>

        {/* ======================================================
            MEDICATION FOOD GUIDANCE
        ====================================================== */}

        <section className="mt-6 rounded-3xl border border-violet-100 bg-white p-5 shadow-sm sm:mt-8 sm:p-6">

          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">

            <div className="flex gap-4">

              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-600">
                <Pill size={23} />
              </div>

              <div>
                <h3 className="text-lg font-bold">
                  Medication-Based Food Guidance
                </h3>

                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                  Get a small AI-generated food guide based
                  on the elder's currently active medicines.
                </p>
              </div>

            </div>

            <button
              type="button"
              onClick={loadMedicationGuidance}
              disabled={guidanceLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 font-semibold text-white transition hover:bg-violet-700 disabled:opacity-60 md:w-auto"
            >

              {guidanceLoading ? (
                <>
                  <LoaderCircle
                    size={18}
                    className="animate-spin"
                  />
                  Checking Medicines...
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  Get Food Guidance
                </>
              )}

            </button>

          </div>

          {guidanceError && (
            <div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
              ⚠️ {guidanceError}
            </div>
          )}

          {guidance &&
            guidance.has_medications && (
              <div className="mt-6 grid gap-5 md:grid-cols-2">

                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">

                  <div className="mb-4 flex items-center gap-2">

                    <ShieldCheck
                      size={20}
                      className="text-emerald-600"
                    />

                    <h4 className="font-bold text-emerald-800">
                      Foods to Consider
                    </h4>

                  </div>

                  <div className="space-y-3">

                    {guidance.recommendations
                      ?.recommended_foods
                      ?.length > 0 ? (
                      guidance.recommendations.recommended_foods.map(
                        (item, index) => (
                          <div
                            key={index}
                            className="rounded-xl bg-white p-3"
                          >

                            <p className="font-semibold text-slate-800">
                              🥗 {item.food}
                            </p>

                            {item.reason && (
                              <p className="mt-1 text-xs leading-5 text-slate-600">
                                {item.reason}
                              </p>
                            )}

                          </div>
                        )
                      )
                    ) : (
                      <p className="text-sm text-slate-600">
                        No specific food recommendations
                        were generated.
                      </p>
                    )}

                  </div>

                </div>

                <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5">

                  <div className="mb-4 flex items-center gap-2">

                    <AlertTriangle
                      size={20}
                      className="text-amber-600"
                    />

                    <h4 className="font-bold text-amber-800">
                      Foods to Limit / Check
                    </h4>

                  </div>

                  <div className="space-y-3">

                    {guidance.recommendations
                      ?.foods_to_limit
                      ?.length > 0 ? (
                      guidance.recommendations.foods_to_limit.map(
                        (item, index) => (
                          <div
                            key={index}
                            className="rounded-xl bg-white p-3"
                          >

                            <p className="font-semibold text-slate-800">
                              ⚠️ {item.food}
                            </p>

                            {item.reason && (
                              <p className="mt-1 text-xs leading-5 text-slate-600">
                                {item.reason}
                              </p>
                            )}

                          </div>
                        )
                      )
                    ) : (
                      <p className="text-sm text-slate-600">
                        No specific food restrictions
                        were identified.
                      </p>
                    )}

                  </div>

                </div>

                {guidance.recommendations
                  ?.summary && (
                  <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4 text-sm leading-6 text-violet-800 md:col-span-2">

                    <strong>
                      AI Summary:
                    </strong>{" "}

                    {guidance.recommendations.summary}

                  </div>
                )}

                {guidance.recommendations
                  ?.safety_note && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-600 md:col-span-2">

                    <div className="flex items-start gap-2">

                      <ShieldCheck
                        size={17}
                        className="mt-0.5 shrink-0 text-slate-500"
                      />

                      <p>

                        <strong>
                          Safety note:
                        </strong>{" "}

                        {
                          guidance.recommendations
                            .safety_note
                        }

                      </p>

                    </div>

                  </div>
                )}

              </div>
            )}

          {guidance &&
            !guidance.has_medications && (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">

                <div className="flex items-start gap-3">

                  <Pill
                    size={21}
                    className="mt-0.5 shrink-0 text-slate-500"
                  />

                  <div>

                    <h4 className="font-bold text-slate-800">
                      No Active Medications Found
                    </h4>

                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      There are no active medications
                      available for medication-based food
                      guidance right now.
                    </p>

                  </div>

                </div>

              </div>
            )}

        </section>

        {/* ======================================================
            AI MEAL SUGGESTIONS
        ====================================================== */}

        <section className="mt-6 rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm sm:mt-8 sm:p-6">

          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">

            <div className="flex gap-4">

              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                <Sparkles size={23} />
              </div>

              <div>

                <h3 className="text-lg font-bold">
                  AI Meal Suggestions
                </h3>

                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                  Get simple meal ideas based on the elder's
                  active medicines and recently recorded meals.
                </p>

              </div>

            </div>

            <button
              type="button"
              onClick={loadMealSuggestions}
              disabled={mealSuggestionsLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60 md:w-auto"
            >

              {mealSuggestionsLoading ? (
                <>
                  <LoaderCircle
                    size={18}
                    className="animate-spin"
                  />
                  Creating Suggestions...
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  Get Meal Suggestions
                </>
              )}

            </button>

          </div>

          {mealSuggestionsError && (
            <div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
              ⚠️ {mealSuggestionsError}
            </div>
          )}

          {mealSuggestions && (
            <div className="mt-6 space-y-5">

              {Array.isArray(
                mealSuggestions.suggestions
              ) &&
              mealSuggestions.suggestions.length > 0 ? (

                <div className="grid gap-5 md:grid-cols-2">

                  {mealSuggestions.suggestions.map(
                    (suggestion, index) => (

                      <div
                        key={index}
                        className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5"
                      >

                        <div className="flex items-start justify-between gap-3">

                          <div>

                            <span className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700">
                              {suggestion.meal_type ||
                                `Meal ${index + 1}`}
                            </span>

                            <h4 className="mt-2 text-lg font-bold text-slate-800">
                              {suggestion.meal ||
                                suggestion.name ||
                                "Suggested Meal"}
                            </h4>

                          </div>

                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-600">
                            <Utensils size={19} />
                          </div>

                        </div>

                        {Array.isArray(
                          suggestion.foods
                        ) &&
                          suggestion.foods.length > 0 && (
                            <div className="mt-4">

                              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                                Foods
                              </p>

                              <div className="flex flex-wrap gap-2">

                                {suggestion.foods.map(
                                  (food, foodIndex) => (

                                    <span
                                      key={foodIndex}
                                      className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-slate-700"
                                    >
                                      🍽️{" "}
                                      {typeof food ===
                                      "string"
                                        ? food
                                        : food?.food ||
                                          food?.name ||
                                          "Food"}
                                    </span>

                                  )
                                )}

                              </div>

                            </div>
                          )}

                        {suggestion.reason && (
                          <div className="mt-4 rounded-xl bg-white p-3">

                            <p className="text-xs font-bold text-emerald-700">
                              Why this may be suitable
                            </p>

                            <p className="mt-1 text-sm leading-5 text-slate-600">
                              {suggestion.reason}
                            </p>

                          </div>
                        )}

                        {suggestion.medication_note && (
                          <div className="mt-3 rounded-xl border border-violet-100 bg-violet-50 p-3">

                            <div className="flex items-start gap-2">

                              <Pill
                                size={16}
                                className="mt-0.5 shrink-0 text-violet-600"
                              />

                              <p className="text-xs leading-5 text-violet-800">

                                <strong>
                                  Medication note:
                                </strong>{" "}

                                {suggestion.medication_note}

                              </p>

                            </div>

                          </div>
                        )}

                      </div>

                    )
                  )}

                </div>

              ) : (

                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">

                  No specific meal suggestions were generated
                  right now. Try recording a few meals and make
                  sure the elder's active medications are up to
                  date.

                </div>

              )}

              {mealSuggestions.summary && (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">

                  <strong>
                    AI Summary:
                  </strong>{" "}

                  {mealSuggestions.summary}

                </div>
              )}

              {mealSuggestions.safety_note && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-600">

                  <div className="flex items-start gap-2">

                    <ShieldCheck
                      size={17}
                      className="mt-0.5 shrink-0 text-slate-500"
                    />

                    <p>

                      <strong>
                        Safety note:
                      </strong>{" "}

                      {mealSuggestions.safety_note}

                    </p>

                  </div>

                </div>
              )}

              {mealSuggestions.records_used !==
                undefined && (
                <p className="text-xs text-slate-400">

                  Suggestions were generated using{" "}
                  {mealSuggestions.records_used} recent
                  nutrition record
                  {mealSuggestions.records_used === 1
                    ? ""
                    : "s"}.

                </p>
              )}

            </div>
          )}

        </section>

        {/* ======================================================
            FINAL SAFETY NOTICE
        ====================================================== */}

        <section className="mt-6 rounded-3xl border border-amber-100 bg-amber-50 p-5 sm:mt-8 sm:p-6">

          <div className="flex items-start gap-4">

            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-amber-600">
              <ShieldCheck size={22} />
            </div>

            <div>

              <h3 className="font-bold text-amber-900">
                Nutrition Information Notice
              </h3>

              <p className="mt-1 text-sm leading-6 text-amber-800">
                AI nutrition values are estimates and may differ
                from actual portion sizes and nutritional values.
                Medication-related food guidance is informational
                only and should not replace advice from a doctor
                or pharmacist.
              </p>

            </div>

          </div>

        </section>

      </main>

      {/* ======================================================
          CAMERA MODAL
      ====================================================== */}

      {cameraOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/70 p-3 sm:p-4">

          <div className="my-auto w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">

            {/* CAMERA HEADER */}

            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">

              <div className="flex min-w-0 items-center gap-3">

                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                  <Camera size={20} />
                </div>

                <div className="min-w-0">

                  <h3 className="font-bold">
                    Scan Your Meal
                  </h3>

                  <p className="text-xs text-slate-500">
                    {cameraFacingMode ===
                    "environment"
                      ? "Rear camera"
                      : "Front camera"}
                  </p>

                </div>

              </div>

              <button
                type="button"
                onClick={stopCamera}
                disabled={scanning}
                className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 disabled:opacity-40"
              >
                <X size={21} />
              </button>

            </div>

            <div className="p-4 sm:p-5">

              {/* VIDEO */}

              <div className="relative overflow-hidden rounded-2xl bg-slate-900">

                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="aspect-video w-full object-cover"
                />

                {scanning && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 p-4">

                    <div className="rounded-2xl bg-white px-5 py-4 text-center shadow-xl">

                      <LoaderCircle
                        size={28}
                        className="mx-auto animate-spin text-emerald-600"
                      />

                      <p className="mt-2 font-semibold">
                        Analyzing meal...
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Please wait while AI estimates
                        the visible food.
                      </p>

                    </div>

                  </div>
                )}

              </div>

              {/* CAMERA ERROR */}

              {cameraError && (
                <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  ⚠️ {cameraError}
                </div>
              )}

              {/* CAMERA BUTTONS */}

              <div className="mt-4 grid gap-3 sm:grid-cols-2">

                <button
                  type="button"
                  onClick={switchCamera}
                  disabled={scanning}
                  className="flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 sm:px-5"
                >

                  <RefreshCw size={19} />

                  {cameraFacingMode ===
                  "environment"
                    ? "Switch to Front Camera"
                    : "Switch to Rear Camera"}

                </button>

                <button
                  type="button"
                  onClick={captureFoodImage}
                  disabled={scanning}
                  className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 sm:px-5"
                >

                  {scanning ? (
                    <>
                      <LoaderCircle
                        size={19}
                        className="animate-spin"
                      />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <ScanLine size={19} />
                      Analyze Meal
                    </>
                  )}

                </button>

              </div>

              <p className="mt-3 text-center text-xs leading-5 text-slate-500">
                Position the meal clearly inside the camera
                view. AI results are estimates and should be
                reviewed before saving.
              </p>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}

export default Nutrition;

