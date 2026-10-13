import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";

function Register() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
    confirm_password: "",
    role: "ELDER",
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (formData.password !== formData.confirm_password) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      await api.post("/auth/register", {
        full_name: formData.full_name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
      });

      setSuccess("Account created successfully! Redirecting to login...");

      setTimeout(() => {
        navigate("/login");
      }, 1500);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to create account. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🩺</div>

          <h1 className="text-4xl font-bold text-cyan-400">
            Elder Sense
          </h1>

          <p className="text-slate-400 mt-2">
            Smart care for healthier living
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">

          <h2 className="text-2xl font-semibold text-white mb-2">
            Create Account 📝
          </h2>

          <p className="text-slate-400 mb-6">
            Join Elder Sense and manage your health with ease
          </p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-3 mb-5">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-500/10 border border-green-500/30 text-green-400 rounded-xl p-3 mb-5">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">

            <div>
              <label className="block text-slate-300 mb-2">
                Full Name
              </label>

              <input
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                placeholder="Enter your full name"
                required
                className="w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 text-white outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block text-slate-300 mb-2">
                Email
              </label>

              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter your email"
                required
                className="w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 text-white outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block text-slate-300 mb-2">
                Password
              </label>

              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Create a password"
                required
                minLength="6"
                className="w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 text-white outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block text-slate-300 mb-2">
                Confirm Password
              </label>

              <input
                type="password"
                name="confirm_password"
                value={formData.confirm_password}
                onChange={handleChange}
                placeholder="Confirm your password"
                required
                className="w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 text-white outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block text-slate-300 mb-2">
                Account Type
              </label>

              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 text-white outline-none focus:border-cyan-400"
              >
                <option value="ELDER">👴 Elder</option>
                <option value="CAREGIVER">👨‍👩‍👧 Caregiver</option>
                <option value="DOCTOR">👨‍⚕️ Doctor</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-semibold rounded-xl py-3 transition"
            >
              {loading ? "Creating Account..." : "Create Account"}
            </button>

          </form>

          <p className="text-center text-slate-400 mt-6">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-cyan-400 hover:text-cyan-300 font-medium"
            >
              Sign In
            </Link>
          </p>

        </div>
      </div>
    </div>
  );
}

export default Register;