import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  ExternalLink,
  Globe,
  Heart,
  HeartPulse,
  Hospital,
  LoaderCircle,
  MapPin,
  Navigation,
  Phone,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Stethoscope,
  UserRound,
  X,
  Building2,
  Eye,
  Trash2,
  Check,
} from "lucide-react";
import api from "../services/api";

const DEFAULT_CITY = "Davangere";

const SPECIALITIES = [
  "Cardiologist",
  "Dermatologist",
  "Gynaecologist",
  "Paediatrician",
  "Neurologist",
  "Orthopaedic",
  "Ophthalmologist",
  "Dentist",
  "Psychiatrist",
  "ENT",
  "General physician",
  "Oncologist",
  "Urologist",
  "Endocrinologist",
  "Nephrologist",
  "Pulmonologist",
];

const inputClass =
  "min-h-12 w-full rounded-2xl border border-emerald-200 bg-emerald-50/40 px-3.5 py-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100";

const primaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-100 transition hover:from-emerald-700 hover:to-teal-700 disabled:cursor-not-allowed disabled:opacity-60";

const secondaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-bold text-emerald-900 transition hover:border-emerald-300 hover:bg-emerald-50 disabled:opacity-60";

function arr(data, keys = []) {
  if (Array.isArray(data)) return data;
  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  return [];
}

function errorText(error, fallback) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    fallback
  );
}

function doctorName(d) {
  return (
    d?.name ||
    d?.full_name ||
    d?.doctor_name ||
    d?.user?.full_name ||
    d?.user?.name ||
    "Registered Doctor"
  );
}

function doctorSpeciality(d) {
  return (
    d?.speciality ||
    d?.specialty ||
    d?.specialization ||
    d?.specialization_name ||
    "Speciality not listed"
  );
}

function doctorAvailability(d) {
  const value = d?.available ?? d?.is_available ?? d?.availability;

  if (value === true || value === 1 || value === "true") {
    return {
      label: "Available",
      cls: "bg-emerald-100 text-emerald-800 border border-emerald-200",
    };
  }

  if (value === false || value === 0 || value === "false") {
    return {
      label: "Unavailable",
      cls: "bg-rose-100 text-rose-800 border border-rose-200",
    };
  }

  return {
    label: "Available for consultation",
    cls: "bg-teal-100 text-teal-800 border border-teal-200",
  };
}

function placeName(p) {
  return p?.name || p?.display_name?.split(",")?.[0] || "Healthcare provider";
}

function placeCategory(p) {
  return String(
    p?.category || p?.type || p?.healthcare || "Healthcare provider"
  ).replaceAll("_", " ");
}

function placeAddress(p) {
  return (
    p?.address ||
    p?.display_name ||
    p?.formatted_address ||
    "Full address not listed"
  );
}

function placeSpeciality(p) {
  const value =
    p?.speciality ||
    p?.specialty ||
    p?.specialization ||
    p?.services ||
    p?.description;

  return Array.isArray(value) ? value.join(", ") : value || "";
}

function placeHours(p) {
  return (
    p?.opening_hours ||
    p?.openingHours ||
    p?.opening_hours_text ||
    p?.hours ||
    p?.operating_hours ||
    p?.opening_time ||
    ""
  );
}

function placePhone(p) {
  return p?.phone || p?.telephone || p?.contact_phone || "";
}

function placeWebsite(p) {
  const value = String(p?.website || p?.url || "").trim();

  if (!value) return "";

  if (/^https?:\/\//i.test(value)) return value;

  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(value)) {
    return `https://${value}`;
  }

  return "";
}

function mapsUrl(p, city) {
  if (p?.maps_url) return p.maps_url;

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${placeName(p)}, ${city}, India`
  )}`;
}

function directionsUrl(p, city) {
  if (p?.directions_url) return p.directions_url;

  const destination =
    p?.latitude != null && p?.longitude != null
      ? `${p.latitude},${p.longitude}`
      : `${placeName(p)}, ${city}, India`;

  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    destination
  )}`;
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupe(places) {
  const seen = new Set();

  return places.filter((p) => {
    const name = normalize(placeName(p));

    const coords =
      p?.latitude != null && p?.longitude != null
        ? `${Number(p.latitude).toFixed(4)},${Number(p.longitude).toFixed(4)}`
        : "";

    const address = normalize(placeAddress(p));
    const key = coords ? `${name}|${coords}` : `${name}|${address}`;

    if (!name || seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

function distanceKm(a, b, c, d) {
  if ([a, b, c, d].some((v) => v == null || !Number.isFinite(Number(v)))) {
    return null;
  }

  const rad = (n) => Number(n) * Math.PI / 180;
  const dLat = rad(c - a);
  const dLon = rad(d - b);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a)) *
      Math.cos(rad(c)) *
      Math.sin(dLon / 2) ** 2;

  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function appointmentDate(a) {
  const value = a?.appointment_date || a?.date || a?.scheduled_at;

  if (!value) return "Date not available";

  const d = new Date(value);

  return Number.isNaN(d.getTime())
    ? String(value)
    : d.toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short",
      });
}

function appointmentDoctor(a) {
  return (
    a?.doctor_name ||
    a?.doctor?.name ||
    a?.doctor?.full_name ||
    a?.doctor?.user?.name ||
    a?.doctor?.user?.full_name ||
    "Doctor"
  );
}

function statusClass(status) {
  const s = String(status || "Pending").toLowerCase();

  if (["confirmed", "approved", "completed"].includes(s)) {
    return "bg-emerald-100 text-emerald-800 border border-emerald-200";
  }

  if (["cancelled", "rejected"].includes(s)) {
    return "bg-rose-100 text-rose-800 border border-rose-200";
  }

  return "bg-amber-100 text-amber-800 border border-amber-200";
}

function informationScore(p) {
  const fields = [
    placePhone(p),
    p?.address || p?.display_name || p?.formatted_address,
    placeWebsite(p),
    placeHours(p),
    placeSpeciality(p),
    p?.qualifications || p?.qualification,
    p?.education,
    p?.email,
    p?.latitude,
    p?.longitude,
  ];

  let score = fields.filter(
    (value) =>
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ""
  ).length;

  if (p?.rating != null && Number.isFinite(Number(p.rating))) {
    score += 2;
  }

  const reviews =
    p?.review_count ?? p?.user_ratings_total ?? p?.reviews_count;

  if (reviews != null && Number.isFinite(Number(reviews))) {
    score += 1;
  }

  return score;
}

function Heading({ icon: Icon, title, subtitle, badge }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-teal-800 shadow-sm">
          <Icon size={22} />
        </span>

        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-slate-800">
            {title}
          </h2>

          {subtitle && (
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {badge && (
        <span className="w-fit rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-xs font-bold text-teal-800 shadow-sm">
          {badge}
        </span>
      )}
    </div>
  );
}

function Empty({ icon: Icon, title, description }) {
  return (
    <div className="rounded-3xl border border-dashed border-emerald-200 bg-emerald-50/40 px-5 py-9 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-teal-700 shadow-sm">
        <Icon size={26} />
      </span>

      <h3 className="mt-3 font-extrabold text-slate-800">{title}</h3>

      <p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-slate-500">
        {description}
      </p>
    </div>
  );
}

export default function Appointments() {
  const navigate = useNavigate();

  const [doctors, setDoctors] = useState([]);
  const [places, setPlaces] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [elders, setElders] = useState([]);
  const [role, setRole] = useState("");

  const [city, setCity] = useState(DEFAULT_CITY);
  const [searchedCity, setSearchedCity] = useState(DEFAULT_CITY);
  const [speciality, setSpeciality] = useState("");
  const [nameQuery, setNameQuery] = useState("");
  const [facilityType, setFacilityType] = useState("all");
  const [sortBy, setSortBy] = useState("information");
  const [minRating, setMinRating] = useState("any");
  const [phoneOnly, setPhoneOnly] = useState(false);
  const [openNowOnly, setOpenNowOnly] = useState(false);

  const [favourites, setFavourites] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("elder_sense_favourite_places") || "[]"
      );
    } catch {
      return [];
    }
  });

  const [recent, setRecent] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("elder_sense_recent_places") || "[]"
      );
    } catch {
      return [];
    }
  });

  const [showFavourites, setShowFavourites] = useState(false);
  const [detailsPlace, setDetailsPlace] = useState(null);

  const [source, setSource] = useState("OpenStreetMap");
  const [directoryMessage, setDirectoryMessage] = useState("");
  const [directoryError, setDirectoryError] = useState("");

  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [deletingDoctorId, setDeletingDoctorId] = useState(null);

  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedElder, setSelectedElder] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    setRole(
      String(
        localStorage.getItem("user_role") ||
        localStorage.getItem("role") ||
        ""
      ).toUpperCase()
    );
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "elder_sense_favourite_places",
      JSON.stringify(favourites)
    );
  }, [favourites]);

  useEffect(() => {
    localStorage.setItem(
      "elder_sense_recent_places",
      JSON.stringify(recent.slice(0, 8))
    );
  }, [recent]);

  const loadDirectory = useCallback(
    async (requestedCity, requestedSpeciality = speciality) => {
      const cleanCity = String(requestedCity || "").trim();

      if (!cleanCity) {
        setDirectoryError("Enter a city or location to search.");
        return;
      }

      setSearching(true);
      setDirectoryError("");
      setSuccess("");

      try {
        const [doctorResult, placeResult] = await Promise.allSettled([
          api.get("/appointments/doctors", {
            params: { city: cleanCity },
            timeout: 20000,
          }),

          api.get("/doctor-finder/search", {
            params: {
              city: cleanCity,
              speciality: requestedSpeciality || "",
            },
            timeout: 60000,
          }),
        ]);

        if (doctorResult.status === "fulfilled") {
          setDoctors(
            arr(doctorResult.value.data, [
              "doctors",
              "results",
              "items",
            ])
          );
        } else {
          setDoctors([]);
        }

        if (placeResult.status === "fulfilled") {
          const data = placeResult.value.data || {};

          const results = arr(data, [
            "results",
            "healthcare_places",
            "places",
            "hospitals",
          ]);

          setPlaces(dedupe(results));
          setSearchedCity(data.city || cleanCity);
          setSource(data.source || "OpenStreetMap");
          setDirectoryMessage(data.message || "");

          if (results.length === 0) {
            setDirectoryError(
              data.message ||
              "No healthcare listings were found. Try another spelling, nearby locality, or speciality."
            );
          }
        } else {
          setPlaces([]);
          setSearchedCity(cleanCity);
          setSource("Unavailable");

          setDirectoryError(
            errorText(
              placeResult.reason,
              "The healthcare directory could not be reached. Please try again."
            )
          );
        }
      } catch (e) {
        setDirectoryError(
          errorText(e, "Could not search healthcare providers.")
        );
      } finally {
        setSearching(false);
      }
    },
    [speciality]
  );

  const loadAppointments = useCallback(async () => {
    const results = await Promise.allSettled([
      api.get("/appointments", { timeout: 20000 }),

      ...(role === "CAREGIVER"
        ? [api.get("/caregiver/elders", { timeout: 20000 })]
        : []),
    ]);

    if (results[0].status === "fulfilled") {
      setAppointments(
        arr(results[0].value.data, [
          "appointments",
          "results",
          "items",
        ])
      );
    } else {
      setError(
        "Appointment history could not be loaded. Refresh or sign in again."
      );
    }

    if (role === "CAREGIVER") {
      if (results[1]?.status === "fulfilled") {
        setElders(
          arr(results[1].value.data, [
            "elders",
            "results",
            "items",
          ])
        );
      } else {
        setElders([]);
      }
    }
  }, [role]);

  const loadPage = useCallback(async () => {
    setLoading(true);

    try {
      await Promise.allSettled([
        loadAppointments(),
        loadDirectory(city, speciality),
      ]);
    } finally {
      setLoading(false);
    }
  }, [loadAppointments, loadDirectory, city, speciality]);

  useEffect(() => {
    if (role) loadPage();
  }, [role, loadPage]);

  const deleteConnectedDoctor = async (doctorId, linkId) => {
    const confirmed = window.confirm(
      "Are you sure you want to remove this registered doctor from your care network?"
    );
    if (!confirmed) return;

    setDeletingDoctorId(doctorId);
    setError("");
    setSuccess("");

    try {
      if (linkId) {
        await api.delete(`/connections/team/${linkId}`);
      } else {
        await api.delete(`/connections/team/${doctorId}`).catch(async () => {
          await api.delete(`/connections/requests/${doctorId}/decision`).catch(async () => {
            await api.post(`/connections/requests/${doctorId}/decision`, { decision: "REJECT" });
          });
        });
      }

      setDoctors((prev) => prev.filter((d) => (d.id ?? d.user_id) !== doctorId));
      setSuccess("Registered doctor successfully removed from your care network.");
      await loadDirectory(city, speciality);
    } catch (e) {
      setError(errorText(e, "Unable to remove this doctor connection."));
    } finally {
      setDeletingDoctorId(null);
    }
  };

  const filteredPlaces = useMemo(() => {
    let result = [...places];
    const q = normalize(nameQuery);

    if (q) {
      result = result.filter((p) =>
        normalize(
          [
            placeName(p),
            placeAddress(p),
            placeCategory(p),
            placeSpeciality(p),
          ].join(" ")
        ).includes(q)
      );
    }

    if (facilityType !== "all") {
      result = result.filter((p) =>
        normalize(placeCategory(p)).includes(facilityType)
      );
    }

    if (minRating !== "any") {
      result = result.filter((p) => {
        if (p?.rating == null || p.rating === "") return false;

        const rating = Number(p.rating);

        return (
          Number.isFinite(rating) &&
          rating >= Number(minRating)
        );
      });
    }

    if (phoneOnly) {
      result = result.filter((p) => Boolean(placePhone(p)));
    }

    if (openNowOnly) {
      result = result.filter(
        (p) => p.open_now === true || p.is_open === true
      );
    }

    if (showFavourites) {
      result = result.filter((p) =>
        favourites.includes(String(p.id || placeName(p)))
      );
    }

    const rating = (p) => {
      const value = Number(p?.rating);
      return Number.isFinite(value) ? value : 0;
    };

    const reviews = (p) => {
      const value = Number(
        p?.review_count ??
        p?.user_ratings_total ??
        p?.reviews_count ??
        0
      );

      return Number.isFinite(value) ? value : 0;
    };

    const dist = (p) =>
      userLocation
        ? distanceKm(
            userLocation.lat,
            userLocation.lon,
            p.latitude,
            p.longitude
          )
        : null;

    result.sort((a, b) => {
      if (sortBy === "information") {
        return (
          informationScore(b) - informationScore(a) ||
          rating(b) - rating(a) ||
          reviews(b) - reviews(a) ||
          placeName(a).localeCompare(placeName(b))
        );
      }

      if (sortBy === "rating") {
        return (
          rating(b) - rating(a) ||
          placeName(a).localeCompare(placeName(b))
        );
      }

      if (sortBy === "reviews") {
        return (
          reviews(b) - reviews(a) ||
          placeName(a).localeCompare(placeName(b))
        );
      }

      if (sortBy === "nearest") {
        return (
          (dist(a) ?? Infinity) -
            (dist(b) ?? Infinity) ||
          placeName(a).localeCompare(placeName(b))
        );
      }

      if (sortBy === "name-desc") {
        return placeName(b).localeCompare(placeName(a));
      }

      return placeName(a).localeCompare(placeName(b));
    });

    return result;
  }, [
    places,
    nameQuery,
    facilityType,
    minRating,
    phoneOnly,
    openNowOnly,
    showFavourites,
    favourites,
    sortBy,
    userLocation,
  ]);

  const toggleFavourite = (place) => {
    const key = String(place.id || placeName(place));

    setFavourites((old) =>
      old.includes(key)
        ? old.filter((x) => x !== key)
        : [...old, key]
    );
  };

  const viewDetails = (place) => {
    setDetailsPlace(place);

    const key = String(place.id || placeName(place));

    setRecent((old) =>
      [key, ...old.filter((x) => x !== key)].slice(0, 8)
    );
  };

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setDirectoryError(
        "Location is not supported by this browser."
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        });

        setSortBy("nearest");
        setDirectoryError("");
      },
      () => {
        setDirectoryError(
          "Location permission was not granted. You can still sort by information, name, or rating."
        );
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000,
      }
    );
  };

  const handleSearch = async (e) => {
    e.preventDefault();

    if (!city.trim()) {
      setDirectoryError("Enter a city or location to search.");
      return;
    }

    await loadDirectory(city, speciality);
  };

  const resetFilters = () => {
    setNameQuery("");
    setFacilityType("all");
    setSortBy("information");
    setMinRating("any");
    setPhoneOnly(false);
    setOpenNowOnly(false);
    setShowFavourites(false);
  };

  const bookAppointment = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!selectedDoctor?.id) {
      setError("Select a registered Elder Sense doctor first.");
      return;
    }

    if (!date || !time || !reason.trim()) {
      setError(
        "Enter the date, time, and reason for the appointment."
      );
      return;
    }

    if (role === "CAREGIVER" && !selectedElder) {
      setError("Select the elder for this appointment.");
      return;
    }

    const chosen = new Date(`${date}T${time}`);

    if (
      Number.isNaN(chosen.getTime()) ||
      chosen.getTime() <= Date.now()
    ) {
      setError("Choose a future date and time.");
      return;
    }

    const payload = {
      doctor_id: selectedDoctor.id,
      appointment_date: `${date}T${time}:00`,
      reason: reason.trim(),
      notes: notes.trim(),
    };

    if (role === "CAREGIVER") {
      payload.elder_id = selectedElder;
    }

    setBooking(true);

    try {
      await api.post("/appointments", payload);

      setSuccess(
        "Appointment request submitted. It is not confirmed until the provider or application confirms it."
      );

      setSelectedDoctor(null);
      setDate("");
      setTime("");
      setReason("");
      setNotes("");
      setSelectedElder("");

      await loadAppointments();
    } catch (e2) {
      setError(
        errorText(
          e2,
          "Unable to submit the appointment. Please try again."
        )
      );
    } finally {
      setBooking(false);
    }
  };

  const count = places.length;

  const ratingValue = (p) => {
    if (p?.rating == null || p.rating === "") return "";

    const value = Number(p.rating);

    return Number.isFinite(value) ? value.toFixed(1) : "";
  };

  const ratingCount = (p) =>
    p?.review_count ??
    p?.user_ratings_total ??
    p?.reviews_count ??
    null;

  const openStatus = (p) => {
    const value = p?.open_now ?? p?.is_open;

    if (value === true) {
      return {
        label: "Open now",
        cls: "bg-emerald-100 text-emerald-800 border border-emerald-200",
      };
    }

    if (value === false) {
      return {
        label: "Reported closed",
        cls: "bg-rose-100 text-rose-800 border border-rose-200",
      };
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-[#f4fbf7] text-slate-800">
      <main className="mx-auto max-w-[1500px] space-y-7 px-4 py-6 sm:px-7 lg:px-10">

        {/* PAGE HEADER */}
        <section className="relative overflow-hidden rounded-[2rem] border border-emerald-100 bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-800 p-6 text-white shadow-lg sm:p-9">
          <div className="pointer-events-none absolute -right-10 -top-16 h-64 w-64 rounded-full bg-white/5" />

          <div className="relative grid gap-7 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-2 text-sm font-semibold text-emerald-50">
                <Sparkles size={16} />
                Your healthcare companion
              </span>

              <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Doctor Finder &amp; Appointments
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-7 text-emerald-50 sm:text-base">
                Find healthcare providers in your chosen city, explore
                available details, and manage appointment requests in one
                place.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() =>
                    document
                      .getElementById("registered-doctors")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                  className={primaryButton}
                >
                  <CalendarDays size={17} />
                  Book appointment
                </button>

                <button
                  type="button"
                  onClick={() =>
                    document
                      .getElementById("healthcare-search")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                  className={secondaryButton}
                >
                  <Search size={17} />
                  Find healthcare
                </button>
              </div>
            </div>

            <div className="hidden h-36 w-36 items-center justify-center rounded-[2rem] border border-emerald-200/30 bg-white/10 text-emerald-50 shadow-sm backdrop-blur-md lg:flex">
              <Stethoscope size={68} strokeWidth={1.4} />
            </div>
          </div>

          <div className="relative mt-7 grid gap-3 border-t border-white/10 pt-5 sm:grid-cols-3">
            {[
              {
                icon: Hospital,
                value: searching ? "…" : count,
                label: "Healthcare listings",
              },
              {
                icon: UserRound,
                value: doctors.length,
                label: "Registered connected doctors",
              },
              {
                icon: CalendarDays,
                value: loading ? "…" : appointments.length,
                label: "Your appointments",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-md"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-white">
                  <item.icon size={23} />
                </span>

                <div>
                  <p className="text-2xl font-extrabold text-white">
                    {item.value}
                  </p>
                  <p className="text-xs text-emerald-100">
                    {item.label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SUCCESS AND ERROR MESSAGES */}
        {(success || error) && (
          <div
            role={error ? "alert" : "status"}
            className={`flex items-start gap-3 rounded-2xl border p-4 text-sm leading-6 ${
              error
                ? "border-rose-200 bg-rose-50 text-rose-900"
                : "border-emerald-200 bg-emerald-50 text-emerald-900"
            }`}
          >
            <span className="mt-0.5">
              {error ? (
                <AlertCircle size={20} className="text-rose-600" />
              ) : (
                <CheckCircle2 size={20} className="text-emerald-600" />
              )}
            </span>

            <p className="flex-1 font-medium">{error || success}</p>

            <button
              type="button"
              onClick={() => {
                setError("");
                setSuccess("");
              }}
              aria-label="Dismiss message"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {/* HEALTHCARE SEARCH */}
        <section
          id="healthcare-search"
          className="rounded-3xl border border-emerald-100 bg-emerald-50/70 p-5 shadow-sm sm:p-7"
        >
          <Heading
            icon={Search}
            title="Find care near you"
            subtitle="Search any city or locality and optionally narrow results by medical speciality."
          />

          <form
            onSubmit={handleSearch}
            className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"
          >
            <label className="relative">
              <MapPin
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-teal-700"
              />

              <input
                className={`${inputClass} pl-10`}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Enter any city or locality"
                aria-label="City or locality"
                required
              />
            </label>

            <label className="relative">
              <Stethoscope
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-teal-700"
              />

              <input
                className={`${inputClass} pl-10`}
                value={speciality}
                onChange={(e) => setSpeciality(e.target.value)}
                list="medical-specialities"
                placeholder="Speciality e.g. cardiologist"
                aria-label="Medical speciality"
              />

              <datalist id="medical-specialities">
                {SPECIALITIES.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </label>

            <button
              className={primaryButton}
              type="submit"
              disabled={searching}
            >
              {searching ? (
                <LoaderCircle size={18} className="animate-spin" />
              ) : (
                <Search size={18} />
              )}
              {searching ? "Searching…" : "Search care"}
            </button>
          </form>

          <div className="mt-3 flex flex-wrap gap-2">
            {SPECIALITIES.slice(0, 8).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSpeciality(s)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  normalize(speciality) === normalize(s)
                    ? "border-teal-700 bg-teal-700 text-white"
                    : "border-emerald-200 bg-white text-teal-800 hover:bg-emerald-100"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-600">
            <ShieldCheck
              size={16}
              className="mt-0.5 shrink-0 text-teal-700"
            />
            External directory listings are informational. Only registered Elder Sense doctors can be booked inside this application.
          </p>
        </section>

        {/* HEALTHCARE DIRECTORY */}
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <Heading
            icon={Hospital}
            title="Hospitals, clinics & healthcare providers"
            subtitle={`Results for ${searchedCity}. Ratings, reviews, phone numbers and hours appear only when the data source provides them.`}
            badge={`${count} listings`}
          />

          <div className="mb-5 flex flex-wrap gap-2">
            <button
              className={secondaryButton}
              type="button"
              onClick={() => loadDirectory(city, speciality)}
              disabled={searching}
            >
              <RefreshCw
                size={16}
                className={searching ? "animate-spin" : ""}
              />
              Refresh
            </button>

            <button
              className={secondaryButton}
              type="button"
              onClick={requestLocation}
            >
              <Navigation size={16} />
              Use my location
            </button>

            <button
              className={secondaryButton}
              type="button"
              onClick={() => setShowFavourites((v) => !v)}
            >
              <Heart
                size={16}
                className={showFavourites ? "fill-current text-rose-600" : ""}
              />
              {showFavourites ? "Show all listings" : "Favourites"}
            </button>
          </div>

          {/* FILTERS */}
          <div className="mb-5 grid gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs font-bold text-slate-600">
              Search results
              <input
                className={`${inputClass} mt-1.5`}
                value={nameQuery}
                onChange={(e) => setNameQuery(e.target.value)}
                placeholder="Name, address, service…"
              />
            </label>

            <label className="text-xs font-bold text-slate-600">
              Facility type
              <select
                className={`${inputClass} mt-1.5`}
                value={facilityType}
                onChange={(e) => setFacilityType(e.target.value)}
              >
                <option value="all">All facility types</option>
                <option value="hospital">Hospitals</option>
                <option value="clinic">Clinics</option>
                <option value="doctor">Doctors / medical practice</option>
                <option value="dentist">Dental care</option>
                <option value="pharmacy">Pharmacies</option>
                <option value="diagnostic">Diagnostic centres</option>
              </select>
            </label>

            <label className="text-xs font-bold text-slate-600">
              Sort results
              <select
                className={`${inputClass} mt-1.5`}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="information">
                  Most complete information first
                </option>
                <option value="name-asc">Name: A–Z</option>
                <option value="name-desc">Name: Z–A</option>
                <option value="rating">Highest rating (if available)</option>
                <option value="reviews">Most reviewed (if available)</option>
                <option value="nearest">Nearest first (enable location)</option>
              </select>
            </label>

            <label className="text-xs font-bold text-slate-600">
              Minimum rating
              <select
                className={`${inputClass} mt-1.5`}
                value={minRating}
                onChange={(e) => setMinRating(e.target.value)}
              >
                <option value="any">Any / not provided</option>
                <option value="3">3+ stars</option>
                <option value="4">4+ stars</option>
                <option value="4.5">4.5+ stars</option>
              </select>
            </label>

            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 accent-teal-700"
                checked={phoneOnly}
                onChange={(e) => setPhoneOnly(e.target.checked)}
              />
              Phone number listed
            </label>

            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 accent-teal-700"
                checked={openNowOnly}
                onChange={(e) => setOpenNowOnly(e.target.checked)}
              />
              Reported open now
            </label>

            <button
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100"
              type="button"
              onClick={resetFilters}
            >
              <RotateCcw size={15} />
              Clear filters
            </button>

            <p className="flex items-center text-xs text-slate-500">
              <SlidersHorizontal size={15} className="mr-1.5 text-teal-700" />
              Showing {filteredPlaces.length} of {places.length} results
            </p>
          </div>

          {searching && (
            <div className="mb-4 flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 text-teal-900">
              <LoaderCircle size={21} className="animate-spin" />

              <div>
                <p className="font-bold">
                  Searching healthcare directory…
                </p>
                <p className="text-sm">
                  This may take a moment for some cities.
                </p>
              </div>
            </div>
          )}

          {!searching && directoryError && (
            <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
              <AlertCircle size={20} className="mt-0.5 shrink-0" />

              <div className="flex-1">
                <p className="font-bold">Directory information</p>
                <p className="mt-1 text-sm leading-6">
                  {directoryError}
                </p>

                <button
                  type="button"
                  onClick={() => loadDirectory(city, speciality)}
                  className="mt-2 inline-flex items-center gap-1 font-bold text-teal-800 underline"
                >
                  Try searching again
                </button>
              </div>
            </div>
          )}

          {!searching && filteredPlaces.length === 0 && (
            <Empty
              icon={Hospital}
              title={
                showFavourites
                  ? "No saved favourites match"
                  : "No providers match these filters"
              }
              description="Try changing the city, speciality, search text, or filters, or search a nearby locality."
            />
          )}

          {filteredPlaces.length > 0 && (
            <div className="grid gap-4 lg:grid-cols-2">
              {filteredPlaces.map((p, index) => {
                const name = placeName(p);
                const phone = placePhone(p);
                const website = placeWebsite(p);
                const hours = placeHours(p);
                const favKey = String(p.id || name);
                const isFav = favourites.includes(favKey);
                const rating = ratingValue(p);
                const reviews = ratingCount(p);
                const open = openStatus(p);

                const dist = userLocation
                  ? distanceKm(
                      userLocation.lat,
                      userLocation.lon,
                      p.latitude,
                      p.longitude
                    )
                  : null;

                return (
                  <article
                    key={p.id || `${name}-${index}`}
                    className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-emerald-300 hover:shadow-lg hover:shadow-slate-900/5"
                  >
                    <div className="h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400" />

                    <div className="flex flex-1 flex-col p-5">
                      <div className="flex items-start gap-3">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-teal-800">
                          <Building2 size={24} />
                        </span>

                        <div className="min-w-0 flex-1">
                          <h3 className="break-words text-lg font-extrabold text-slate-800">
                            {name}
                          </h3>

                          <p className="mt-1 text-xs font-bold capitalize text-teal-800">
                            {placeCategory(p)}
                          </p>

                          <div className="mt-2 flex flex-wrap gap-2">
                            {rating ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
                                <Star size={13} className="fill-current" />
                                {rating}
                                {reviews != null &&
                                  ` · ${reviews} reviews`}
                              </span>
                            ) : (
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                                Rating not listed
                              </span>
                            )}

                            {open && (
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-bold ${open.cls}`}
                              >
                                {open.label}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleFavourite(p)}
                          aria-label={
                            isFav ? "Remove favourite" : "Save favourite"
                          }
                          title={
                            isFav ? "Remove favourite" : "Save favourite"
                          }
                          className={`rounded-xl p-2 transition ${
                            isFav
                              ? "bg-rose-50 text-rose-600"
                              : "bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          }`}
                        >
                          <Heart
                            size={19}
                            className={isFav ? "fill-current" : ""}
                          />
                        </button>
                      </div>

                      <div className="mt-4 space-y-3 text-sm">
                        <p className="flex items-start gap-2.5 leading-5 text-slate-600">
                          <MapPin
                            size={16}
                            className="mt-0.5 shrink-0 text-teal-700"
                          />
                          <span>{placeAddress(p)}</span>
                        </p>

                        <p className="flex items-start gap-2.5 leading-5 text-slate-600">
                          <Stethoscope
                            size={16}
                            className="mt-0.5 shrink-0 text-teal-700"
                          />
                          <span>
                            <strong className="text-slate-700">
                              Speciality / services:{" "}
                            </strong>
                            {placeSpeciality(p) ||
                              "Not listed by the directory"}
                          </span>
                        </p>

                        <p className="flex items-start gap-2.5 leading-5 text-slate-600">
                          <Clock
                            size={16}
                            className="mt-0.5 shrink-0 text-teal-700"
                          />
                          <span>
                            <strong className="text-slate-700">
                              Opening hours:{" "}
                            </strong>
                            {hours ||
                              "Not listed — check the provider's current listing or call."}
                          </span>
                        </p>

                        {(p?.qualification || p?.qualifications || p?.education) && (
                          <p className="flex items-start gap-2.5 leading-5 text-slate-600">
                            <ShieldCheck
                              size={16}
                              className="mt-0.5 shrink-0 text-teal-700"
                            />
                            <span>
                              <strong className="text-slate-700">
                                Qualifications:{" "}
                              </strong>
                              {p.qualification ||
                                p.qualifications ||
                                p.education}
                            </span>
                          </p>
                        )}

                        {phone && (
                          <p className="flex items-center gap-2.5 text-slate-700">
                            <Phone
                              size={16}
                              className="shrink-0 text-teal-700"
                            />

                            <a
                              className="break-all font-bold text-teal-800 hover:underline"
                              href={`tel:${String(phone).replace(/[^\d+]/g, "")}`}
                            >
                              {phone}
                            </a>
                          </p>
                        )}

                        {website && (
                          <p className="flex items-center gap-2.5 break-all text-slate-700">
                            <Globe
                              size={16}
                              className="shrink-0 text-teal-700"
                            />

                            <a
                              href={website}
                              target="_blank"
                              rel="noreferrer"
                              className="font-bold text-teal-800 hover:underline"
                            >
                              Official website{" "}
                              <ExternalLink
                                size={13}
                                className="inline"
                              />
                            </a>
                          </p>
                        )}

                        {dist != null && (
                          <p className="flex items-center gap-2.5 text-slate-600">
                            <Navigation
                              size={16}
                              className="text-teal-700"
                            />
                            Approximately {dist.toFixed(1)} km away
                          </p>
                        )}
                      </div>

                      <div className="mt-auto grid grid-cols-2 gap-2 pt-5">
                        <button
                          className={secondaryButton}
                          type="button"
                          onClick={() => viewDetails(p)}
                        >
                          <Eye size={15} />
                          More details
                        </button>

                        <a
                          className={primaryButton}
                          href={mapsUrl(p, searchedCity)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <MapPin size={15} />
                          View on Maps
                        </a>

                        <a
                          className="col-span-2 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                          href={directionsUrl(p, searchedCity)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Navigation size={15} />
                          Get directions
                        </a>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs leading-5 text-slate-500">
            <p className="font-bold text-slate-700">
              Data transparency · Source: {source}
            </p>

            <p className="mt-1">
              Map data can be incomplete. Ratings, review counts, phone
              numbers, qualifications, and opening status are shown only
              when supplied by the source; they are never generated or
              assumed. Verify important details directly before visiting.
            </p>

            {directoryMessage && (
              <p className="mt-1">{directoryMessage}</p>
            )}
          </div>
        </section>

        {/* REGISTERED CONNECTED DOCTORS WITH DELETE OPTION */}
        <section
          id="registered-doctors"
          className="scroll-mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
        >
          <Heading
            icon={UserRound}
            title="Elder Sense registered doctors"
            subtitle="Only doctors you are connected with in your care network can be booked and managed here."
            badge={`${doctors.length} connected`}
          />

          {doctors.length === 0 ? (
            <Empty
              icon={Stethoscope}
              title="No connected registered doctors"
              description="Connect with a registered doctor in 'Connect My Care Team' to see and book them here."
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {doctors.map((d, i) => {
                const av = doctorAvailability(d);
                const selected = selectedDoctor?.id === d.id;
                const docId = d.id ?? d.user_id;
                const isDeleting = deletingDoctorId === docId;

                return (
                  <article
                    key={docId || i}
                    className={`rounded-2xl border p-5 transition relative ${
                      selected
                        ? "border-emerald-400 bg-emerald-50/50"
                        : "border-slate-200 hover:border-emerald-300"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-teal-800">
                        <Stethoscope size={24} />
                      </span>

                      <div className="min-w-0 flex-1">
                        <h3 className="font-extrabold text-slate-800">
                          {/^dr\.?/i.test(doctorName(d))
                            ? doctorName(d)
                            : `Dr. ${doctorName(d)}`}
                        </h3>

                        <p className="mt-1 text-sm font-semibold text-teal-800">
                          {doctorSpeciality(d)}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {d?.city ||
                            d?.clinic?.city ||
                            d?.address ||
                            "Location not listed"}
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() => deleteConnectedDoctor(docId, d.link_id)}
                        className="rounded-xl bg-rose-50 p-2 text-rose-600 hover:bg-rose-100 transition shadow-sm"
                        title="Remove doctor connection"
                        aria-label="Remove doctor connection"
                      >
                        {isDeleting ? (
                          <LoaderCircle size={16} className="animate-spin" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </button>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${av.cls}`}
                      >
                        {av.label}
                      </span>

                      {d?.qualification && (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          {d.qualification}
                        </span>
                      )}

                      {d?.consultation_fee != null && (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          Fee: ₹{d.consultation_fee}
                        </span>
                      )}
                    </div>

                    <button
                      className={`${primaryButton} mt-4 w-full`}
                      type="button"
                      onClick={() => {
                        setSelectedDoctor(selected ? null : d);
                        setError("");
                        setSuccess("");

                        if (!selected) {
                          setTimeout(() => {
                            document
                              .getElementById("booking-form")
                              ?.scrollIntoView({
                                behavior: "smooth",
                                block: "start",
                              });
                          }, 100);
                        }
                      }}
                    >
                      <CalendarDays size={17} />
                      {selected
                        ? "Cancel selection"
                        : "Request appointment"}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* APPOINTMENT BOOKING FORM */}
        {selectedDoctor && (
          <section
            id="booking-form"
            className="scroll-mt-5 overflow-hidden rounded-3xl border border-sky-100 bg-white shadow-sm"
          >
            <div className="bg-gradient-to-r from-teal-700 to-teal-600 p-5 text-white sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-teal-100">
                    Appointment request
                  </p>

                  <h2 className="mt-2 text-2xl font-extrabold">
                    Request a visit
                  </h2>

                  <p className="mt-1 text-sm text-teal-100">
                    {doctorName(selectedDoctor)} ·{" "}
                    {doctorSpeciality(selectedDoctor)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedDoctor(null)}
                  aria-label="Close form"
                  className="rounded-lg bg-white/10 p-2 hover:bg-white/20"
                >
                  <X size={19} />
                </button>
              </div>
            </div>

            <form
              onSubmit={bookAppointment}
              className="space-y-4 p-5 sm:p-6"
            >
              {role === "CAREGIVER" && (
                <label className="block text-sm font-bold text-slate-700">
                  Select elder

                  <select
                    className={`${inputClass} mt-1.5`}
                    value={selectedElder}
                    onChange={(e) => setSelectedElder(e.target.value)}
                    required
                  >
                    <option value="">Choose linked elder</option>

                    {elders.map((el, i) => (
                      <option key={el.id || i} value={el.id}>
                        {el.name ||
                          el.full_name ||
                          el.elder_name ||
                          el.user?.name ||
                          `Elder ${el.id || i + 1}`}
                      </option>
                    ))}
                  </select>

                  {elders.length === 0 && (
                    <span className="mt-1 block text-xs font-medium text-amber-800">
                      No linked elders were returned for this caregiver.
                    </span>
                  )}
                </label>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-bold text-slate-700">
                  Appointment date

                  <input
                    className={`${inputClass} mt-1.5`}
                    type="date"
                    min={new Date().toLocaleDateString("en-CA")}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </label>

                <label className="block text-sm font-bold text-slate-700">
                  Preferred time

                  <input
                    className={`${inputClass} mt-1.5`}
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    required
                  />

                  <span className="mt-1 block text-xs font-normal text-slate-500">
                    Requested time is not a confirmed slot.
                  </span>
                </label>
              </div>

              <label className="block text-sm font-bold text-slate-700">
                Reason for appointment

                <input
                  className={`${inputClass} mt-1.5`}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={500}
                  placeholder="e.g. Routine check-up"
                  required
                />
              </label>

              <label className="block text-sm font-bold text-slate-700">
                Additional notes (optional)

                <textarea
                  className={`${inputClass} mt-1.5`}
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={2000}
                  placeholder="Anything else the doctor should know?"
                />
              </label>

              <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row">
                <button
                  className={`${primaryButton} flex-1`}
                  type="submit"
                  disabled={
                    booking ||
                    (role === "CAREGIVER" && !elders.length)
                  }
                >
                  {booking ? (
                    <LoaderCircle size={18} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={18} />
                  )}

                  {booking
                    ? "Submitting…"
                    : "Submit appointment request"}
                </button>

                <button
                  className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600 hover:bg-slate-50"
                  type="button"
                  onClick={() => setSelectedDoctor(null)}
                  disabled={booking}
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        )}

        {/* APPOINTMENT HISTORY */}
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <Heading
            icon={CalendarDays}
            title="My Appointments"
            subtitle="Track your upcoming and previous appointment requests."
            badge={`${appointments.length} total`}
          />

          {loading && appointments.length === 0 ? (
            <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4 text-teal-900">
              <LoaderCircle size={20} className="animate-spin" />
              Loading appointment records…
            </div>
          ) : appointments.length === 0 ? (
            <Empty
              icon={CalendarDays}
              title="No appointments yet"
              description="Your appointment records will appear here after you submit a request to a registered Elder Sense doctor."
            />
          ) : (
            <div className="space-y-3">
              {[...appointments]
                .sort(
                  (a, b) =>
                    new Date(
                      a.appointment_date || a.date || a.scheduled_at || 0
                    ) -
                    new Date(
                      b.appointment_date || b.date || b.scheduled_at || 0
                    )
                )
                .map((a, i) => {
                  const status =
                    a.status || a.appointment_status || "Pending";

                  return (
                    <article
                      key={a.id || i}
                      className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="flex gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-teal-800">
                          <CalendarDays size={21} />
                        </span>

                        <div>
                          <h3 className="font-extrabold text-slate-800">
                            {appointmentDoctor(a)}
                          </h3>

                          {a.elder_name && (
                            <p className="mt-1 text-xs text-slate-500">
                              Elder: {a.elder_name}
                            </p>
                          )}

                          <p className="mt-1 flex items-start gap-2 text-sm text-slate-600">
                            <Clock
                              size={15}
                              className="mt-0.5 text-teal-700"
                            />
                            {appointmentDate(a)}
                          </p>

                          {(a.reason || a.description) && (
                            <p className="mt-1 text-sm text-slate-600">
                              <strong>Reason:</strong>{" "}
                              {a.reason || a.description}
                            </p>
                          )}

                          {a.notes && (
                            <p className="mt-1 text-sm text-slate-500">
                              {a.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      <span
                        className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold capitalize ${statusClass(status)}`}
                      >
                        {status}
                      </span>
                    </article>
                  );
                })}
            </div>
          )}

          <div className="mt-5 flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2 text-xs leading-5 text-slate-500">
              <ShieldCheck
                size={17}
                className="mt-0.5 shrink-0 text-teal-700"
              />
              Requests are not confirmed until the application or provider
              confirms them.
            </p>

            <button
              className={secondaryButton}
              type="button"
              disabled={loading}
              onClick={async () => {
                setLoading(true);

                try {
                  await loadAppointments();
                } finally {
                  setLoading(false);
                }
              }}
            >
              <RefreshCw
                size={15}
                className={loading ? "animate-spin" : ""}
              />
              Refresh appointments
            </button>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="rounded-2xl border border-emerald-100 bg-white p-4">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-emerald-50 p-2 text-teal-800">
              <HeartPulse size={20} />
            </span>

            <div>
              <h3 className="font-bold text-slate-800">
                Your health, your peace of mind
              </h3>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                External listings are informational and are not verified
                Elder Sense doctors. Confirm details, opening hours and
                availability directly before visiting.
              </p>
            </div>
          </div>
        </footer>
      </main>

      {/* PROVIDER DETAILS MODAL */}
      {detailsPlace && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${placeName(detailsPlace)} details`}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setDetailsPlace(null);
            }
          }}
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-7">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold capitalize text-teal-800">
                  {placeCategory(detailsPlace)}
                </span>

                <h2 className="mt-3 text-2xl font-extrabold text-slate-800">
                  {placeName(detailsPlace)}
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {placeAddress(detailsPlace)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setDetailsPlace(null)}
                aria-label="Close details"
                className="rounded-xl bg-slate-100 p-2 text-slate-600 hover:bg-slate-200"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                {
                  label: "Speciality / services",
                  value:
                    placeSpeciality(detailsPlace) ||
                    "Not listed by source"
                },
                {
                  label: "Opening hours",
                  value:
                    placeHours(detailsPlace) ||
                    "Not listed — check the provider listing or call"
                },
                {
                  label: "Phone",
                  value: placePhone(detailsPlace) || "Not listed"
                },
                {
                  label: "Rating",
                  value:
                    detailsPlace.rating != null
                      ? `${ratingValue(detailsPlace)}${
                          ratingCount(detailsPlace) != null
                            ? ` (${ratingCount(detailsPlace)} reviews)`
                            : ""
                        }`
                      : "Not supplied by source"
                },
                {
                  label: "Qualifications / education",
                  value:
                    detailsPlace.qualification ||
                    detailsPlace.qualifications ||
                    detailsPlace.education ||
                    "Not supplied for this listing"
                },
                {
                  label: "Website",
                  value: placeWebsite(detailsPlace) || "Not listed"
                }
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-slate-100 bg-slate-50 p-3"
                >
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    {item.label}
                  </p>

                  <p className="mt-1 break-words text-sm font-semibold text-slate-800">
                    {Array.isArray(item.value)
                      ? item.value.join(", ")
                      : String(item.value)}
                  </p>
                </div>
              ))}
            </div>

            <p className="mt-4 text-xs leading-5 text-slate-500">
              Education and qualifications usually belong to an individual
              doctor profile, not a hospital listing. They are shown only
              if the source supplies them.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {placePhone(detailsPlace) && (
                <a
                  className={primaryButton}
                  href={`tel:${String(placePhone(detailsPlace)).replace(/[^\d+]/g, "")}`}
                >
                  <Phone size={16} />
                  Call provider
                </a>
              )}

              <a
                className={secondaryButton}
                href={mapsUrl(detailsPlace, searchedCity)}
                target="_blank"
                rel="noreferrer"
              >
                <MapPin size={16} />
                Open Maps
                <ExternalLink size={14} />
              </a>

              <a
                className={secondaryButton}
                href={directionsUrl(detailsPlace, searchedCity)}
                target="_blank"
                rel="noreferrer"
              >
                <Navigation size={16} />
                Directions
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}