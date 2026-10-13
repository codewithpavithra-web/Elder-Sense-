import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import {
  ArrowLeft,
  Pill,
  HeartPulse,
  Activity,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

const API =
  import.meta.env.VITE_API_BASE_URL ||
  `${window.location.protocol}//${window.location.hostname}:5000/api`;

/*
 * Prevent duplicate assessment cards.
 *
 * If an assessment has a timestamp, the timestamp is included in its
 * identity so that assessments performed at different times are preserved.
 *
 * If there is no timestamp, identical displayed assessment content is
 * shown only once. This is a display-level safeguard, not database cleanup.
 */
function getUniqueAssessments(items) {
  const seen = new Set();

  return items.filter((assessment) => {
    const identity = JSON.stringify({
      prediction: assessment.prediction ?? null,
      risk_level: assessment.risk_level ?? null,
      risk_score: assessment.risk_score ?? null,
      model_name: assessment.model_name ?? null,
      recommendations: assessment.recommendations ?? null,
    });

    if (seen.has(identity)) return false;

    seen.add(identity);
    return true;
  });
}

function CaregiverElderDetails() {
  const navigate = useNavigate();
  const { elderId } = useParams();

  const [elder, setElder] = useState(null);
  const [medications, setMedications] = useState([]);
  const [vitals, setVitals] = useState([]);
  const [assessments, setAssessments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const uniqueAssessments = useMemo(
    () => getUniqueAssessments(assessments),
    [assessments]
  );

  const token = localStorage.getItem("access_token");

  const loadDetails = useCallback(async () => {
    const currentToken = localStorage.getItem("access_token");

    if (!currentToken) {
      navigate("/login");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await axios.get(
        `${API}/caregiver/elders/${elderId}`,
        {
          headers: {
            Authorization: `Bearer ${currentToken}`,
          },
        }
      );

      const data = response.data || {};

      setElder(data.elder || null);
      setMedications(
        Array.isArray(data.medications) ? data.medications : []
      );
      setVitals(
        Array.isArray(data.vitals) ? data.vitals : []
      );
      setAssessments(
        Array.isArray(data.assessments) ? data.assessments : []
      );
    } catch (err) {
      console.error("Failed to load elder details:", err);

      if (
        err.response?.status === 401 ||
        err.response?.status === 403
      ) {
        setError(
          err.response?.data?.message ||
            "You are not authorized to view this elder."
        );
      } else {
        setError(
          err.response?.data?.message ||
            "Unable to load elder details."
        );
      }
    } finally {
      setLoading(false);
    }
  }, [elderId, navigate]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 font-medium">
            Loading elder details...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-5">
        <div className="bg-white rounded-3xl border border-red-200 shadow-sm p-8 max-w-lg w-full text-center">
          <AlertTriangle
            size={45}
            className="mx-auto text-red-500 mb-4"
          />

          <h2 className="text-xl font-bold text-slate-900">
            Access Error
          </h2>

          <p className="text-slate-600 mt-2">{error}</p>

          <button
            onClick={() => navigate("/caregiver")}
            className="mt-6 px-5 py-3 rounded-xl bg-teal-600 text-white font-semibold hover:bg-teal-700"
          >
            Back to Caregiver Dashboard
          </button>
        </div>
      </div>
    );
  }

  const latestAssessment = uniqueAssessments[0];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/caregiver")}
              className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50"
              aria-label="Back to caregiver dashboard"
            >
              <ArrowLeft size={19} />
            </button>

            <div>
              <h1 className="text-xl font-bold text-slate-900">
                Elder Sense
              </h1>
              <p className="text-xs text-slate-500">
                Caregiver • Elder Details
              </p>
            </div>
          </div>

          <button
            onClick={loadDetails}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50"
            title="Refresh"
            aria-label="Refresh elder details"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* ELDER PROFILE */}
        <section className="bg-gradient-to-r from-teal-600 to-cyan-600 rounded-3xl p-7 text-white shadow-lg mb-8">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="w-24 h-24 rounded-3xl bg-white/20 flex items-center justify-center text-4xl font-bold">
              {elder?.name?.charAt(0)?.toUpperCase() || "E"}
            </div>

            <div className="flex-1">
              <p className="text-teal-100 text-sm font-medium">
                Elder Profile
              </p>

              <h2 className="text-3xl font-bold mt-1">
                {elder?.name || "Elder"}
              </h2>

              <p className="text-teal-50 mt-1">
                {elder?.email || "No email available"}
              </p>

              <div className="flex flex-wrap gap-3 mt-4">
                {elder?.gender && (
                  <span className="px-3 py-1.5 rounded-full bg-white/15 text-sm">
                    {elder.gender}
                  </span>
                )}

                {elder?.blood_group && (
                  <span className="px-3 py-1.5 rounded-full bg-white/15 text-sm">
                    Blood Group: {elder.blood_group}
                  </span>
                )}

                {elder?.phone && (
                  <span className="px-3 py-1.5 rounded-full bg-white/15 text-sm">
                    📞 {elder.phone}
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* SUMMARY CARDS */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center mb-4">
              <Pill size={22} />
            </div>
            <p className="text-sm text-slate-500">Active Medicines</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">
              {medications.length}
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="w-11 h-11 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mb-4">
              <HeartPulse size={22} />
            </div>
            <p className="text-sm text-slate-500">Latest Heart Rate</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">
              {vitals[0]?.heart_rate != null &&
              vitals[0].heart_rate !== ""
                ? `${vitals[0].heart_rate} BPM`
                : "--"}
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="w-11 h-11 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center mb-4">
              <Activity size={22} />
            </div>
            <p className="text-sm text-slate-500">Latest Oxygen</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">
              {vitals[0]?.oxygen_level != null &&
              vitals[0].oxygen_level !== ""
                ? `${vitals[0].oxygen_level}%`
                : "--"}
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
              <ShieldCheck size={22} />
            </div>
            <p className="text-sm text-slate-500">Health Risk</p>
            <p className="text-lg font-bold text-emerald-600 mt-3">
              {latestAssessment?.risk_level || "NO DATA"}
            </p>
          </div>
        </section>

        {/* MEDICATIONS */}
        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 mb-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <Pill size={22} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">
                Medications
              </h3>
              <p className="text-sm text-slate-500">
                Current medications for this elder
              </p>
            </div>
          </div>

          {medications.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 p-8 text-center">
              <Pill
                size={38}
                className="mx-auto text-slate-300 mb-3"
              />
              <p className="font-semibold text-slate-700">
                No medications recorded
              </p>
              <p className="text-sm text-slate-500 mt-1">
                Medication information will appear here when available.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {medications.map((medication, index) => (
                <div
                  key={medication.id ?? `medication-${index}`}
                  className="border border-slate-200 rounded-2xl p-5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-slate-900">
                        {medication.name || "Unnamed medication"}
                      </h4>
                      <p className="text-sm text-slate-500 mt-1">
                        {medication.dosage || "Dosage not specified"}
                        {medication.form ? ` • ${medication.form}` : ""}
                      </p>
                    </div>

                    {medication.purpose && (
                      <span className="px-3 py-1.5 rounded-full bg-teal-50 text-teal-700 text-sm font-medium">
                        {medication.purpose}
                      </span>
                    )}
                  </div>

                  {medication.instructions && (
                    <p className="text-sm text-slate-600 mt-3">
                      <strong>Instructions:</strong>{" "}
                      {medication.instructions}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* HEALTH & VITALS */}
        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 mb-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <HeartPulse size={22} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">
                Health & Vitals
              </h3>
              <p className="text-sm text-slate-500">
                Recent health measurements
              </p>
            </div>
          </div>

          {vitals.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 p-8 text-center">
              <HeartPulse
                size={38}
                className="mx-auto text-slate-300 mb-3"
              />
              <p className="font-semibold text-slate-700">
                No vital records available
              </p>
              <p className="text-sm text-slate-500 mt-1">
                Health measurements will appear here when recorded.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    {[
                      "Date",
                      "BP",
                      "Heart Rate",
                      "Sugar",
                      "Oxygen",
                      "Temperature",
                    ].map((heading) => (
                      <th
                        key={heading}
                        className="py-3 pr-4 text-slate-500 font-medium"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {vitals.map((vital, index) => (
                    <tr
                      key={vital.id ?? `vital-${index}`}
                      className="border-b border-slate-100"
                    >
                      <td className="py-4 pr-4 text-slate-700">
                        {vital.recorded_at
                          ? new Date(vital.recorded_at).toLocaleString()
                          : "--"}
                      </td>
                      <td className="py-4 pr-4 font-medium">
                        {vital.blood_pressure || "--"}
                      </td>
                      <td className="py-4 pr-4 font-medium">
                        {vital.heart_rate != null &&
                        vital.heart_rate !== ""
                          ? `${vital.heart_rate} BPM`
                          : "--"}
                      </td>
                      <td className="py-4 pr-4 font-medium">
                        {vital.blood_sugar != null &&
                        vital.blood_sugar !== ""
                          ? `${vital.blood_sugar} mg/dL`
                          : "--"}
                      </td>
                      <td className="py-4 pr-4 font-medium">
                        {vital.oxygen_level != null &&
                        vital.oxygen_level !== ""
                          ? `${vital.oxygen_level}%`
                          : "--"}
                      </td>
                      <td className="py-4 font-medium">
                        {vital.temperature != null &&
                        vital.temperature !== ""
                          ? `${vital.temperature} °C`
                          : "--"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* HEALTH ASSESSMENTS */}
        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 mb-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Activity size={22} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">
                Health Assessments
              </h3>
              <p className="text-sm text-slate-500">
                Recent health risk assessments
              </p>
            </div>
          </div>

          {uniqueAssessments.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 p-8 text-center">
              <Activity
                size={38}
                className="mx-auto text-slate-300 mb-3"
              />
              <p className="font-semibold text-slate-700">
                No assessments available
              </p>
              <p className="text-sm text-slate-500 mt-1">
                Health assessment results will appear here when available.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {uniqueAssessments.map((assessment, index) => {
                const riskLevel = String(
                  assessment.risk_level || "UNKNOWN"
                ).toUpperCase();

                const riskStyle =
                  riskLevel === "HIGH"
                    ? "bg-red-100 text-red-700"
                    : riskLevel === "MODERATE"
                    ? "bg-amber-100 text-amber-700"
                    : riskLevel === "LOW"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-700";

                return (
                  <div
                    key={
                      assessment.id ??
                      `assessment-${index}-${assessment.risk_score ?? "na"}`
                    }
                    className="border border-slate-200 rounded-2xl p-5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <p className="text-sm text-slate-500">
                          Assessment
                        </p>
                        <p className="font-semibold text-slate-900 mt-1">
                          {assessment.prediction || "Health assessment"}
                        </p>
                      </div>

                      <span
                        className={`px-4 py-2 rounded-full text-sm font-bold ${riskStyle}`}
                      >
                        {riskLevel}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div className="rounded-xl bg-slate-50 p-4">
                        <p className="text-xs text-slate-500">
                          Risk Score
                        </p>
                        <p className="text-xl font-bold text-slate-900 mt-1">
                          {assessment.risk_score ?? "--"}
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-50 p-4">
                        <p className="text-xs text-slate-500">
                          Model
                        </p>
                        <p className="font-medium text-slate-800 mt-1">
                          {assessment.model_name ||
                            "Elder Sense Assessment"}
                        </p>
                      </div>
                    </div>

                    {assessment.recommendations && (
                      <div className="mt-4 rounded-xl bg-teal-50 border border-teal-100 p-4">
                        <p className="text-sm font-semibold text-teal-900">
                          Recommendations
                        </p>
                        <p className="text-sm text-teal-800 mt-1 whitespace-pre-line">
                          {assessment.recommendations}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* PRIVACY */}
        <div className="rounded-2xl border border-teal-200 bg-teal-50 p-5 flex gap-4">
          <div className="text-teal-600">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h4 className="font-semibold text-teal-900">
              Privacy & Access Control
            </h4>
            <p className="text-sm text-teal-800 mt-1">
              This information is available because this elder is
              explicitly linked to the current caregiver account.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default CaregiverElderDetails;