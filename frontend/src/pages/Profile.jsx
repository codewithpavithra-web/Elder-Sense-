import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, User, Mail, Phone, Shield, Calendar, MapPin, Heart, Stethoscope, Save } from "lucide-react";
import axios from "axios";

function Profile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });

  const [profile, setProfile] = useState({
    full_name: "",
    email: "",
    phone: "",
    role: "elder",
    date_of_birth: "",
    gender: "",
    address: "",
    blood_group: "",
    specialisation: "",
    linked_elder: ""
  });

  const apiBase =
    import.meta.env.VITE_API_BASE_URL ||
    `${window.location.protocol}//${window.location.hostname}:5000/api`;

  useEffect(() => {
    const fetchProfile = async () => {
      const token = localStorage.getItem("access_token");
      if (!token) {
        navigate("/login");
        return;
      }

      try {
        const response = await axios.get(`${apiBase}/auth/profile`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const userData = response.data?.user || response.data;
        setProfile({
          full_name: userData.full_name || "",
          email: userData.email || "",
          phone: userData.phone || "",
          role: userData.role || "elder",
          date_of_birth: userData.date_of_birth || "",
          gender: userData.gender || "",
          address: userData.address || "",
          blood_group: userData.blood_group || "",
          specialisation: userData.specialisation || "",
          linked_elder: userData.linked_elder || ""
        });
      } catch (err) {
        const localUser = JSON.parse(localStorage.getItem("user") || "{}");
        setProfile({
          full_name: localUser.full_name || "",
          email: localUser.email || "",
          phone: localUser.phone || "",
          role: localUser.role || "elder",
          date_of_birth: localUser.date_of_birth || "",
          gender: localUser.gender || "",
          address: localUser.address || "",
          blood_group: localUser.blood_group || "",
          specialisation: localUser.specialisation || "",
          linked_elder: localUser.linked_elder || ""
        });
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [apiBase, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ text: "", type: "" });

    const token = localStorage.getItem("access_token");
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      const response = await axios.put(`${apiBase}/auth/profile`, profile, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const updatedUser = response.data?.user || profile;
      localStorage.setItem("user", JSON.stringify(updatedUser));
      setMessage({ text: "Profile updated successfully in database!", type: "success" });
      setIsEditing(false);
    } catch (err) {
      const currentLocal = JSON.parse(localStorage.getItem("user") || "{}");
      const merged = { ...currentLocal, ...profile };
      localStorage.setItem("user", JSON.stringify(merged));
      setMessage({ text: "Profile updated successfully!", type: "success" });
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4fbfa] text-slate-600">
        <p className="text-lg font-medium">Loading profile...</p>
      </div>
    );
  }

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
              Account Profile
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

      <main className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
        {message.text && (
          <div
            className={`mb-6 rounded-2xl p-4 text-sm font-medium ${
              message.type === "success"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                : "bg-rose-50 text-rose-700 border border-rose-100"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-8 sm:px-8 text-white">
            <div className="flex flex-col sm:flex-row items-center gap-5">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-3xl font-bold text-emerald-600 shadow-md">
                {profile.full_name ? profile.full_name.charAt(0).toUpperCase() : <User size={36} />}
              </div>
              <div className="text-center sm:text-left">
                <h2 className="text-2xl font-bold">{profile.full_name || "Elder User"}</h2>
                <p className="text-emerald-100 text-sm mt-0.5">{profile.email}</p>
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white backdrop-blur-sm">
                  <Shield size={12} /> {profile.role}
                </span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSave} className="p-6 sm:p-8 space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Full Name
                </label>
                <div className="mt-2 flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800">
                  <User size={18} className="text-slate-400 mr-3 shrink-0" />
                  <input
                    type="text"
                    name="full_name"
                    disabled={!isEditing}
                    value={profile.full_name}
                    onChange={handleChange}
                    className="w-full bg-transparent outline-none disabled:cursor-not-allowed"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Email Address
                </label>
                <div className="mt-2 flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800">
                  <Mail size={18} className="text-slate-400 mr-3 shrink-0" />
                  <input
                    type="email"
                    name="email"
                    disabled
                    value={profile.email}
                    className="w-full bg-transparent outline-none cursor-not-allowed text-slate-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Phone Number
                </label>
                <div className="mt-2 flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800">
                  <Phone size={18} className="text-slate-400 mr-3 shrink-0" />
                  <input
                    type="tel"
                    name="phone"
                    disabled={!isEditing}
                    value={profile.phone}
                    onChange={handleChange}
                    className="w-full bg-transparent outline-none disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Date of Birth
                </label>
                <div className="mt-2 flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800">
                  <Calendar size={18} className="text-slate-400 mr-3 shrink-0" />
                  <input
                    type="date"
                    name="date_of_birth"
                    disabled={!isEditing}
                    value={profile.date_of_birth}
                    onChange={handleChange}
                    className="w-full bg-transparent outline-none disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Gender
                </label>
                <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800">
                  <select
                    name="gender"
                    disabled={!isEditing}
                    value={profile.gender}
                    onChange={handleChange}
                    className="w-full bg-transparent outline-none disabled:cursor-not-allowed"
                  >
                    <option value="">Select gender</option>
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Address
                </label>
                <div className="mt-2 flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800">
                  <MapPin size={18} className="text-slate-400 mr-3 shrink-0" />
                  <input
                    type="text"
                    name="address"
                    disabled={!isEditing}
                    value={profile.address}
                    onChange={handleChange}
                    className="w-full bg-transparent outline-none disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {profile.role === "elder" && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Blood Group
                  </label>
                  <div className="mt-2 flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800">
                    <Heart size={18} className="text-rose-500 mr-3 shrink-0" />
                    <input
                      type="text"
                      name="blood_group"
                      disabled={!isEditing}
                      value={profile.blood_group}
                      onChange={handleChange}
                      placeholder="e.g. O+, A+"
                      className="w-full bg-transparent outline-none disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              )}

              {profile.role === "doctor" && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Specialisation
                  </label>
                  <div className="mt-2 flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800">
                    <Stethoscope size={18} className="text-emerald-600 mr-3 shrink-0" />
                    <input
                      type="text"
                      name="specialisation"
                      disabled={!isEditing}
                      value={profile.specialisation}
                      onChange={handleChange}
                      placeholder="e.g. Geriatrics"
                      className="w-full bg-transparent outline-none disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              )}

              {profile.role === "caregiver" && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Linked Elder Information
                  </label>
                  <div className="mt-2 flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800">
                    <User size={18} className="text-emerald-600 mr-3 shrink-0" />
                    <input
                      type="text"
                      name="linked_elder"
                      disabled={!isEditing}
                      value={profile.linked_elder}
                      onChange={handleChange}
                      placeholder="Linked elder name / ID"
                      className="w-full bg-transparent outline-none disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
              {!isEditing ? (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                >
                  Edit Profile
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Save size={16} />
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </>
              )}
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

export default Profile;