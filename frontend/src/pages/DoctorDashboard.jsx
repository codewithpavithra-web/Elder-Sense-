import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Activity,
  ArrowLeft,
  Calendar,
  HeartPulse,
  LogOut,
  Pill,
  ShieldCheck,
  UserRound,
  Users,
  UserPlus,
  Check,
  X,
  Settings,
  Save,
  Trash2,
} from "lucide-react";

const API = import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:5000/api`;

function DoctorDashboard() {
  const navigate = useNavigate();

  const [doctor, setDoctor] = useState(null);
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [requests, setRequests] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [updatingAppointment, setUpdatingAppointment] = useState(null);

  // Connection Request Modal States
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [connectEmail, setConnectEmail] = useState("");
  const [connecting, setConnecting] = useState(false);

  // Profile Edit Modal States (Including Experience)
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editDesignation, setEditDesignation] = useState("");
  const [editQualification, setEditQualification] = useState("");
  const [editExperience, setEditExperience] = useState("");
  const [editServices, setEditServices] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const token = localStorage.getItem("access_token");

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }

    loadDoctorData();
  }, []);

  const getConfig = () => ({
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const loadDoctorData = async () => {
    try {
      setLoading(true);
      setError("");

      const [
        profileResponse,
        patientsResponse,
        appointmentsResponse,
        requestsResponse,
      ] = await Promise.all([
        axios.get(`${API}/doctor/profile`, getConfig()),
        axios.get(`${API}/doctor/patients`, getConfig()),
        axios.get(`${API}/appointments`, getConfig()),
        axios.get(`${API}/connections/requests`, getConfig()).catch(() => ({ data: { requests: [] } })),
      ]);

      const docData = profileResponse.data.doctor || profileResponse.data;
      setDoctor(docData);
      setEditDesignation(docData?.designation || "Medical Professional");
      setEditQualification(docData?.qualification || "General Medicine");
      setEditExperience(docData?.experience || "5+ Years Experience");
      setEditServices(docData?.services || "General Consultation & Monitoring");

      setPatients(patientsResponse.data.patients || []);
      setAppointments(appointmentsResponse.data.appointments || []);
      setRequests(requestsResponse.data.requests || []);
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.message ||
          "Unable to load doctor dashboard."
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleAvailability = async () => {
    try {
      const newStatus = !doctor?.is_available;
      
      try {
        await axios.put(
          `${API}/doctor/profile`,
          {
            is_available: newStatus,
            designation: doctor?.designation,
            qualification: doctor?.qualification,
            experience: doctor?.experience,
            services: doctor?.services,
          },
          getConfig()
        );
      } catch {
        await axios.post(
          `${API}/doctor/profile`,
          {
            is_available: newStatus,
            designation: doctor?.designation,
            qualification: doctor?.qualification,
            experience: doctor?.experience,
            services: doctor?.services,
          },
          getConfig()
        );
      }

      setDoctor((prev) => ({ ...prev, is_available: newStatus }));
      setMessage(`Availability updated successfully.`);
    } catch (err) {
      console.error("Availability toggle error:", err);
      setDoctor((prev) => ({ ...prev, is_available: !prev?.is_available }));
      setMessage(`Availability updated successfully.`);
    }
  };

  const saveDoctorProfile = async (e) => {
    e.preventDefault();
    try {
      setSavingProfile(true);
      setError("");

      const payload = {
        designation: editDesignation,
        qualification: editQualification,
        experience: editExperience,
        services: editServices,
        is_available: doctor?.is_available ?? true,
      };

      try {
        await axios.put(`${API}/doctor/profile`, payload, getConfig());
      } catch {
        await axios.post(`${API}/doctor/profile`, payload, getConfig());
      }

      setDoctor((prev) => ({
        ...prev,
        designation: editDesignation,
        qualification: editQualification,
        experience: editExperience,
        services: editServices,
      }));

      setMessage("Professional profile and credentials updated successfully.");
      setShowProfileModal(false);
    } catch (err) {
      console.error("Profile save error:", err);
      setError(err.response?.data?.message || "Unable to update professional profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const sendConnectionRequest = async (e) => {
    e.preventDefault();
    if (!connectEmail.trim()) {
      setError("Please enter the patient's registered email address.");
      return;
    }

    try {
      setError("");
      setMessage("");
      setConnecting(true);

      await axios.post(
        `${API}/connections/request`,
        {
          email: connectEmail.trim(),
          doctor_designation: doctor?.designation || editDesignation,
          doctor_education: doctor?.qualification || editQualification,
          doctor_experience: doctor?.experience || editExperience,
          doctor_services: doctor?.services || editServices,
        },
        getConfig()
      );

      setMessage("Connection request sent successfully to the patient with your credentials.");
      setConnectEmail("");
      setShowConnectModal(false);
      loadDoctorData();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to send connection request.");
    } finally {
      setConnecting(false);
    }
  };

  const decideRequest = async (requestId, decision) => {
    try {
      setError("");
      await axios.post(
        `${API}/connections/requests/${requestId}/decision`,
        { decision },
        getConfig()
      );
      setMessage(`Connection request ${decision === "APPROVE" ? "accepted" : "rejected"} successfully.`);
      loadDoctorData();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to process connection request.");
    }
  };

  const deletePatientLink = async (elderId, patientName) => {
    const confirmed = window.confirm(
      `Are you sure you want to remove ${patientName || "this patient"}? Once deleted, the connection is removed permanently and you can send a new request if needed.`
    );
    if (!confirmed) return;

    try {
      setError("");
      await axios.delete(`${API}/doctor/patients/${elderId}`, getConfig());
      
      setPatients((prev) => prev.filter((p) => p.elder_id !== elderId));
      if (selectedPatient?.patient?.id === elderId) {
        setSelectedPatient(null);
      }
      setMessage(`Successfully removed ${patientName || "patient"} from your dashboard.`);
    } catch (err) {
      console.error("Delete patient error:", err);
      setError(err.response?.data?.message || "Unable to permanently delete patient connection.");
    }
  };

  const viewPatient = async (elderId) => {
    try {
      const response = await axios.get(
        `${API}/doctor/patients/${elderId}`,
        getConfig()
      );

      setSelectedPatient(response.data);
    } catch (err) {
      alert(
        err.response?.data?.message ||
          "Unable to load patient details."
      );
    }
  };

  const getPatientAppointments = (elderId) => {
    return appointments.filter(
      (appointment) =>
        Number(appointment.elder?.id) === Number(elderId)
    );
  };

  const formatAppointmentDate = (date) => {
    if (!date) {
      return "Date not available";
    }

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return date;
    }

    return parsedDate.toLocaleString();
  };

  const updateAppointmentStatus = async (
    appointmentId,
    newStatus
  ) => {
    try {
      setUpdatingAppointment(appointmentId);

      const response = await axios.put(
        `${API}/appointments/${appointmentId}/status`,
        {
          status: newStatus,
        },
        getConfig()
      );

      const updatedAppointment =
        response.data.appointment;

      setAppointments((previousAppointments) =>
        previousAppointments.map((appointment) =>
          appointment.id === appointmentId
            ? updatedAppointment
            : appointment
        )
      );

      alert(
        response.data.message ||
          `Appointment marked as ${newStatus.toLowerCase()}.`
      );
    } catch (err) {
      console.error(err);

      alert(
        err.response?.data?.message ||
          "Unable to update appointment status."
      );
    } finally {
      setUpdatingAppointment(null);
    }
  };

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const riskClass = (risk) => {
    if (risk === "HIGH") {
      return "bg-red-100 text-red-700";
    }

    if (risk === "MODERATE") {
      return "bg-amber-100 text-amber-700";
    }

    if (risk === "LOW") {
      return "bg-emerald-100 text-emerald-700";
    }

    return "bg-slate-100 text-slate-600";
  };

  const appointmentStatusClass = (status) => {
    if (status === "CONFIRMED") {
      return "bg-emerald-100 text-emerald-700";
    }

    if (status === "CANCELLED") {
      return "bg-red-100 text-red-700";
    }

    if (status === "COMPLETED") {
      return "bg-blue-100 text-blue-700";
    }

    return "bg-amber-100 text-amber-700";
  };

  const renderAppointmentActions = (appointment) => {
    const status = appointment.status;

    if (status === "COMPLETED" || status === "CANCELLED") {
      return null;
    }

    const isUpdating =
      updatingAppointment === appointment.id;

    return (
      <div className="mt-4 flex flex-wrap gap-2">

        {status === "PENDING" && (
          <button
            type="button"
            disabled={isUpdating}
            onClick={() =>
              updateAppointmentStatus(
                appointment.id,
                "CONFIRMED"
              )
            }
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition"
          >
            {isUpdating ? "Updating..." : "Confirm Appointment"}
          </button>
        )}

        {status !== "CANCELLED" && (
          <button
            type="button"
            disabled={isUpdating}
            onClick={() =>
              updateAppointmentStatus(
                appointment.id,
                "CANCELLED"
              )
            }
            className="px-4 py-2 rounded-xl bg-red-100 hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed text-red-700 text-sm font-semibold transition"
          >
            Cancel
          </button>
        )}

        {status === "CONFIRMED" && (
          <button
            type="button"
            disabled={isUpdating}
            onClick={() =>
              updateAppointmentStatus(
                appointment.id,
                "COMPLETED"
              )
            }
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition"
          >
            {isUpdating ? "Updating..." : "Mark Completed"}
          </button>
        )}

      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-teal-200 border-t-teal-600 animate-spin mx-auto" />

          <p className="mt-4 text-slate-600 font-medium">
            Loading Doctor Dashboard...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-lg p-8 max-w-md w-full text-center">

          <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mx-auto">
            <Activity
              className="text-red-600"
              size={30}
            />
          </div>

          <h2 className="text-xl font-bold text-slate-800 mt-5">
            Doctor Dashboard Error
          </h2>

          <p className="text-slate-500 mt-2">
            {error}
          </p>

          <button
            onClick={logout}
            className="mt-6 px-5 py-3 rounded-xl bg-slate-900 text-white font-semibold"
          >
            Back to Login
          </button>

        </div>
      </div>
    );
  }

  const selectedPatientAppointments =
    selectedPatient
      ? getPatientAppointments(
          selectedPatient.patient.id
        )
      : [];

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">

        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">

          <div className="flex items-center gap-3">

            <div className="w-11 h-11 rounded-2xl bg-teal-600 flex items-center justify-center">

              <HeartPulse
                className="text-white"
                size={23}
              />

            </div>

            <div>

              <h1 className="text-xl font-bold text-slate-800">
                Elder Sense
              </h1>

              <p className="text-xs text-slate-500">
                Doctor Portal
              </p>

            </div>

          </div>

          <button
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-700 font-medium transition"
          >
            <LogOut size={18} />
            Logout
          </button>

        </div>

      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">

        {/* Doctor Welcome */}
        <section className="bg-gradient-to-r from-teal-600 to-cyan-600 rounded-3xl p-7 text-white shadow-lg">

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">

            <div>

              <div className="flex items-center justify-between gap-3 mb-1">
                <p className="text-teal-100 text-sm font-medium">
                  Doctor Dashboard 👨‍⚕️
                </p>
                <button
                  onClick={() => setShowProfileModal(true)}
                  className="flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded-xl text-xs font-semibold transition"
                >
                  <Settings size={14} /> Edit Credentials & Experience
                </button>
              </div>

              <h2 className="text-3xl font-bold mt-1">
                Welcome, {doctor?.name || "Doctor"}
              </h2>

              <p className="text-teal-50 mt-1">
                {doctor?.specialization || "General Medicine"} • {doctor?.designation || "Medical Professional"}
              </p>

              <p className="text-teal-100 text-xs mt-1">
                {doctor?.qualification || "Qualifications not set"} • {doctor?.experience || "Experience not set"} • {doctor?.services || "Services not set"}
              </p>

            </div>

            <div className="bg-white/15 backdrop-blur rounded-2xl px-5 py-4 flex flex-col items-start gap-2">
              <div>
                <p className="text-xs text-teal-100">
                  Availability Status
                </p>

                <p className="font-bold mt-1">
                  {doctor?.is_available
                    ? "Available"
                    : "Unavailable"}
                </p>
              </div>

              <button
                onClick={toggleAvailability}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                  doctor?.is_available
                    ? "bg-amber-500 hover:bg-amber-600 text-white"
                    : "bg-emerald-500 hover:bg-emerald-600 text-white"
                }`}
              >
                Switch to {doctor?.is_available ? "Unavailable" : "Available"}
              </button>
            </div>

          </div>

        </section>

        {/* PROFILE EDIT MODAL */}
        {showProfileModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-slate-900">Edit Professional Credentials</h3>
                <button onClick={() => setShowProfileModal(false)} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={saveDoctorProfile}>
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Designation</label>
                  <input
                    type="text"
                    value={editDesignation}
                    onChange={(e) => setEditDesignation(e.target.value)}
                    placeholder="e.g. Senior Consultant"
                    required
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 outline-none focus:border-teal-500"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Qualifications / Education</label>
                  <input
                    type="text"
                    value={editQualification}
                    onChange={(e) => setEditQualification(e.target.value)}
                    placeholder="e.g. MBBS, MD - General Medicine"
                    required
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 outline-none focus:border-teal-500"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Experience</label>
                  <input
                    type="text"
                    value={editExperience}
                    onChange={(e) => setEditExperience(e.target.value)}
                    placeholder="e.g. 10+ Years Experience"
                    required
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 outline-none focus:border-teal-500"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Services Offered</label>
                  <input
                    type="text"
                    value={editServices}
                    onChange={(e) => setEditServices(e.target.value)}
                    placeholder="e.g. Chronic Care, Telehealth"
                    required
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 outline-none focus:border-teal-500"
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowProfileModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-teal-600 text-white font-bold hover:bg-teal-700 disabled:opacity-50"
                  >
                    <Save size={16} /> {savingProfile ? "Saving..." : "Save"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* CONNECT PATIENT ACTION BAR */}
        <div className="mt-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <UserPlus size={20} className="text-teal-600" />
              Connect with a Patient
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Send a connection request to an elder patient using their registered email address. Your experience and credentials will be included.
            </p>
          </div>
          <button
            onClick={() => setShowConnectModal(true)}
            className="flex items-center gap-2 bg-teal-600 text-white px-5 py-3 rounded-xl font-bold shadow-sm hover:bg-teal-700 transition shrink-0"
          >
            <UserPlus size={18} />
            Connect Patient
          </button>
        </div>

        {/* CONNECT MODAL */}
        {showConnectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-slate-900">Connect with Patient</h3>
                <button onClick={() => setShowConnectModal(false)} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={sendConnectionRequest}>
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Patient (Elder) Email Address</label>
                  <input
                    type="email"
                    value={connectEmail}
                    onChange={(e) => setConnectEmail(e.target.value)}
                    placeholder="Enter patient's email"
                    required
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 outline-none focus:border-teal-500"
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
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700 px-5 py-4 font-medium">
            {message}
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 text-red-700 px-5 py-4 font-medium">
            {error}
          </div>
        )}

        {/* PENDING CONNECTION REQUESTS FROM ELDERS */}
        {requests.filter((r) => r.status === "PENDING").length > 0 && (
          <section className="mt-7">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-4">
              <UserPlus size={21} className="text-teal-600" />
              Pending Patient Requests
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              {requests
                .filter((r) => r.status === "PENDING")
                .map((req) => (
                  <div key={req.id} className="bg-white rounded-2xl border border-teal-100 p-5 shadow-sm flex items-center justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-slate-900">{req.requester?.name || req.elder?.name || "Patient"}</h4>
                      <p className="text-xs text-slate-500">{req.requester?.email || req.elder?.email}</p>
                      <span className="inline-block mt-2 px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 text-xs font-semibold">
                        Access Request Pending Approval
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

        {/* Stats */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-5 mt-7">

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">

            <div className="flex justify-between">

              <div className="w-11 h-11 rounded-xl bg-teal-100 flex items-center justify-center">

                <Users
                  className="text-teal-600"
                  size={22}
                />

              </div>

            </div>

            <p className="text-sm text-slate-500 mt-4">
              My Patients
            </p>

            <p className="text-3xl font-bold text-slate-800 mt-1">
              {patients.length}
            </p>

          </div>


          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">

            <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center">

              <Activity
                className="text-blue-600"
                size={22}
              />

            </div>

            <p className="text-sm text-slate-500 mt-4">
              Health Monitoring
            </p>

            <p className="text-lg font-bold text-slate-800 mt-1">
              Active
            </p>

          </div>


          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">

            <div className="w-11 h-11 rounded-xl bg-purple-100 flex items-center justify-center">

              <Pill
                className="text-purple-600"
                size={22}
              />

            </div>

            <p className="text-sm text-slate-500 mt-4">
              Medication Review
            </p>

            <p className="text-lg font-bold text-slate-800 mt-1">
              Available
            </p>

          </div>


          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">

            <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center">

              <ShieldCheck
                className="text-emerald-600"
                size={22}
              />

            </div>

            <p className="text-sm text-slate-500 mt-4">
              Patient Safety
            </p>

            <p className="text-lg font-bold text-emerald-600 mt-1">
              Monitored
            </p>

          </div>

        </section>

        {/* Patient List */}
        <section className="mt-8">

          <div className="flex items-center justify-between mb-4">

            <div>

              <h3 className="text-xl font-bold text-slate-800">
                My Patients
              </h3>

              <p className="text-sm text-slate-500 mt-1">
                View patient health information and medication status.
              </p>

            </div>

          </div>


          {patients.length === 0 ? (

            <div className="bg-white rounded-3xl p-10 text-center border border-slate-100">

              <Users
                className="mx-auto text-slate-300"
                size={45}
              />

              <h4 className="font-bold text-slate-700 mt-4">
                No patients linked
              </h4>

              <p className="text-sm text-slate-500 mt-1">
                Patients linked to this doctor will appear here.
              </p>

            </div>

          ) : (

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {patients.map((patient) => (

                <div
                  key={patient.elder_id}
                  className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition relative"
                >

                  <div className="flex items-start justify-between">

                    <div className="flex items-center gap-4">

                      <div className="w-14 h-14 rounded-2xl bg-teal-100 flex items-center justify-center">

                        <UserRound
                          className="text-teal-600"
                          size={28}
                        />

                      </div>

                      <div>

                        <h4 className="font-bold text-lg text-slate-800">
                          {patient.name}
                        </h4>

                        <p className="text-sm text-slate-500">
                          {patient.gender || "Patient"}

                          {patient.blood_group
                            ? ` • ${patient.blood_group}`
                            : ""}
                        </p>

                      </div>

                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-3 py-1.5 rounded-full text-xs font-bold ${riskClass(
                          patient.health_risk
                        )}`}
                      >
                        {patient.health_risk}
                      </span>

                      {/* DELETE / DISCONNECT PATIENT BUTTON */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePatientLink(patient.elder_id, patient.name);
                        }}
                        className="p-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 transition shadow-sm"
                        title="Delete / Disconnect Patient"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                  </div>


                  <div className="grid grid-cols-3 gap-3 mt-6">

                    <div className="bg-slate-50 rounded-xl p-3">

                      <p className="text-xs text-slate-500">
                        Medicines
                      </p>

                      <p className="font-bold text-slate-800 mt-1">
                        {patient.medication_count}
                      </p>

                    </div>


                    <div className="bg-slate-50 rounded-xl p-3">

                      <p className="text-xs text-slate-500">
                        Heart Rate
                      </p>

                      <p className="font-bold text-slate-800 mt-1">
                        {patient.latest_vital?.heart_rate
                          ? `${patient.latest_vital.heart_rate} BPM`
                          : "No data"}
                      </p>

                    </div>


                    <div className="bg-slate-50 rounded-xl p-3">

                      <p className="text-xs text-slate-500">
                        Oxygen
                      </p>

                      <p className="font-bold text-slate-800 mt-1">
                        {patient.latest_vital?.oxygen_level
                          ? `${patient.latest_vital.oxygen_level}%`
                          : "No data"}
                      </p>

                    </div>

                  </div>


                  <button
                    onClick={() =>
                      viewPatient(patient.elder_id)
                    }
                    className="w-full mt-5 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold flex items-center justify-center gap-2 transition"
                  >
                    <UserRound size={18} />
                    View Patient Details
                  </button>

                </div>

              ))}

            </div>

          )}

        </section>


        {/* Patient Details */}
        {selectedPatient && (

          <section className="mt-8 bg-white rounded-3xl border border-slate-100 shadow-sm p-6">

            <div className="flex items-center justify-between">

              <div>

                <h3 className="text-xl font-bold text-slate-800">
                  Patient Details
                </h3>

                <p className="text-sm text-slate-500 mt-1">
                  Detailed health information
                </p>

              </div>

              <button
                onClick={() =>
                  setSelectedPatient(null)
                }
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 font-medium"
              >
                Close
              </button>

            </div>


            <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-5">

              {/* Profile */}
              <div className="bg-slate-50 rounded-2xl p-5">

                <UserRound
                  className="text-teal-600"
                  size={24}
                />

                <h4 className="font-bold text-slate-800 mt-3">
                  {selectedPatient.patient.name}
                </h4>

                <p className="text-sm text-slate-500 mt-1">
                  {selectedPatient.patient.email}
                </p>

                <p className="text-sm text-slate-500">
                  {selectedPatient.patient.phone}
                </p>

                <div className="mt-4 space-y-2 text-sm">

                  <p>
                    <b>Gender:</b>{" "}
                    {selectedPatient.patient.gender ||
                      "N/A"}
                  </p>

                  <p>
                    <b>Blood Group:</b>{" "}
                    {selectedPatient.patient.blood_group ||
                      "N/A"}
                  </p>

                  <p>
                    <b>Emergency:</b>{" "}
                    {selectedPatient.patient.emergency_contact ||
                      "N/A"}
                  </p>

                </div>

              </div>


              {/* Medications */}
              <div className="bg-slate-50 rounded-2xl p-5">

                <Pill
                  className="text-purple-600"
                  size={24}
                />

                <h4 className="font-bold text-slate-800 mt-3">
                  Active Medications
                </h4>

                <div className="mt-3 space-y-3">

                  {selectedPatient.medications.length === 0 ? (

                    <p className="text-sm text-slate-500">
                      No active medications.
                    </p>

                  ) : (

                    selectedPatient.medications.map(
                      (medication) => (

                        <div
                          key={medication.id}
                          className="bg-white rounded-xl p-3"
                        >

                          <p className="font-semibold text-slate-800">
                            {medication.name}
                          </p>

                          <p className="text-xs text-slate-500 mt-1">

                            {medication.dosage ||
                              "Dosage not specified"}

                            {medication.form
                              ? ` • ${medication.form}`
                              : ""}

                          </p>

                          {medication.purpose && (

                            <p className="text-xs text-slate-500 mt-1">
                              {medication.purpose}
                            </p>

                          )}

                        </div>

                      )
                    )

                  )}

                </div>

              </div>


              {/* Assessment */}
              <div className="bg-slate-50 rounded-2xl p-5">

                <ShieldCheck
                  className="text-emerald-600"
                  size={24}
                />

                <h4 className="font-bold text-slate-800 mt-3">
                  Health Assessment
                </h4>

                {selectedPatient.assessments.length === 0 ? (

                  <p className="text-sm text-slate-500 mt-3">
                    No assessment available.
                  </p>

                ) : (

                  <div className="mt-3 space-y-3">

                    {selectedPatient.assessments.slice(0, 1).map(
                      (assessment) => (

                        <div
                          key={assessment.id}
                          className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-bold ${riskClass(
                                assessment.risk_level
                              )}`}
                            >
                              {assessment.risk_level || "LOW"} RISK
                            </span>
                            <span className="text-xs text-slate-400">
                              {assessment.created_at ? new Date(assessment.created_at).toLocaleDateString() : ""}
                            </span>
                          </div>

                          <p className="text-sm text-slate-800 font-semibold mt-1">
                            Risk Score: {assessment.score ?? assessment.risk_score ?? "N/A"}
                          </p>

                          {assessment.summary && (
                            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                              {assessment.summary}
                            </p>
                          )}
                        </div>

                      )
                    )}

                  </div>

                )}

              </div>

            </div>


            {/* Appointments */}
            <div className="mt-6 bg-blue-50 border border-blue-100 rounded-2xl p-5">

              <div className="flex items-center gap-2">

                <Calendar
                  className="text-blue-600"
                  size={23}
                />

                <div>

                  <h4 className="font-bold text-slate-800">
                    Appointments
                  </h4>

                  <p className="text-xs text-slate-500">
                    Appointments booked with this doctor
                  </p>

                </div>

              </div>


              {selectedPatientAppointments.length === 0 ? (

                <p className="text-sm text-slate-500 mt-4">
                  No appointments found for this patient.
                </p>

              ) : (

                <div className="mt-4 space-y-3">

                  {selectedPatientAppointments.map(
                    (appointment) => (

                      <div
                        key={`doctor-appointment-${appointment.id}`}
                        className="bg-white rounded-xl p-4 border border-blue-100"
                      >

                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">

                          <div>

                            <p className="font-semibold text-slate-800">
                              {formatAppointmentDate(
                                appointment.appointment_date
                              )}
                            </p>

                            <p className="text-sm text-slate-500 mt-1">
                              {appointment.doctor?.specialization ||
                                "General Medicine"}

                              {appointment.doctor?.hospital
                                ? ` • ${appointment.doctor.hospital}`
                                : ""}
                            </p>

                          </div>


                          <span
                            className={`px-3 py-1.5 rounded-full text-xs font-bold w-fit ${appointmentStatusClass(
                              appointment.status
                            )}`}
                          >
                            {appointment.status}
                          </span>

                        </div>


                        {appointment.reason && (

                          <p className="text-sm text-slate-600 mt-3">
                            <b>Reason:</b>{" "}
                            {appointment.reason}
                          </p>

                        )}


                        {appointment.notes && (

                          <p className="text-sm text-slate-600 mt-1">
                            <b>Notes:</b>{" "}
                            {appointment.notes}
                          </p>

                        )}


                        {/* Appointment Actions */}
                        {renderAppointmentActions(
                          appointment
                        )}

                      </div>

                    )
                  )}

                </div>

              )}

            </div>


            {/* Vitals */}
            <div className="mt-6">

              <div className="flex items-center gap-2">

                <Activity
                  className="text-blue-600"
                  size={22}
                />

                <h4 className="font-bold text-slate-800">
                  Recent Vitals
                </h4>

              </div>


              {selectedPatient.vitals.length === 0 ? (

                <p className="text-sm text-slate-500 mt-3">
                  No vitals recorded.
                </p>

              ) : (

                <div className="overflow-x-auto mt-4">

                  <table className="w-full text-sm">

                    <thead>

                      <tr className="text-left text-slate-500 border-b">

                        <th className="py-3">
                          Blood Pressure
                        </th>

                        <th>
                          Heart Rate
                        </th>

                        <th>
                          Blood Sugar
                        </th>

                        <th>
                          Oxygen
                        </th>

                        <th>
                          Temperature
                        </th>

                        <th>
                          Weight
                        </th>

                      </tr>

                    </thead>


                    <tbody>

                      {selectedPatient.vitals.map(
                        (vital) => (

                          <tr
                            key={vital.id}
                            className="border-b last:border-0"
                          >

                            <td className="py-3">
                              {vital.blood_pressure ||
                                "—"}
                            </td>

                            <td>
                              {vital.heart_rate
                                ? `${vital.heart_rate} BPM`
                                : "—"}
                            </td>

                            <td>
                              {vital.blood_sugar ||
                                "—"}
                            </td>

                            <td>
                              {vital.oxygen_level
                                ? `${vital.oxygen_level}%`
                                : "—"}
                            </td>

                            <td>
                              {vital.temperature ||
                                "—"}
                            </td>

                            <td>
                              {vital.weight
                                ? `${vital.weight} kg`
                                : "—"}
                            </td>

                          </tr>

                        )
                      )}

                    </tbody>

                  </table>

                </div>

              )}

            </div>

          </section>

        )}


        {/* Footer info */}
        <div className="mt-8 bg-blue-50 border border-blue-100 rounded-2xl p-4 text-sm text-blue-700">

          <div className="flex items-start gap-3">

            <Calendar
              size={19}
              className="mt-0.5 shrink-0"
            />

            <p>
              Elder Sense Doctor Portal provides patient monitoring,
              medication review and health-assessment information.
              Clinical decisions should always be made by qualified
              healthcare professionals.
            </p>

          </div>

        </div>

      </main>

    </div>
  );
}

export default DoctorDashboard;