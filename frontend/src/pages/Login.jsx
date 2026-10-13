
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";

function Login() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
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
    setLoading(true);

    try {
      const response = await api.post("/auth/login", formData);

      localStorage.setItem(
        "access_token",
        response.data.access_token
      );

      localStorage.setItem(
        "user",
        JSON.stringify(response.data.user)
      );

      // Role-based dashboard navigation
      if (response.data.user?.role === "CAREGIVER") {
        navigate("/caregiver");
      } else if (response.data.user?.role === "DOCTOR") {
        navigate("/doctor");
      } else {
        navigate("/dashboard");
      }

    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to login. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-white to-emerald-50 flex items-center justify-center px-4 py-10">

      <div className="w-full max-w-5xl grid md:grid-cols-2 bg-white rounded-[2rem] shadow-xl overflow-hidden border border-slate-100">

        {/* Left Section */}
        <div className="hidden md:flex bg-gradient-to-br from-cyan-500 to-teal-600 p-10 text-white flex-col justify-center relative overflow-hidden">

          <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full" />

          <div className="absolute -bottom-24 -left-20 w-72 h-72 bg-white/10 rounded-full" />

          <div className="relative z-10">

            <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-3xl flex items-center justify-center text-5xl mb-8">
              🩺
            </div>

            <h1 className="text-5xl font-bold mb-4">
              Elder Sense
            </h1>

            <p className="text-cyan-50 text-lg leading-relaxed mb-8">
              Smart, simple and caring technology designed to make
              elderly healthcare easier.
            </p>

            <div className="space-y-4">

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center">
                  💊
                </div>

                <span>
                  Medication reminders
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center">
                  ❤️
                </div>

                <span>
                  Health monitoring
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center">
                  🤖
                </div>

                <span>
                  AI-powered assistance
                </span>
              </div>

            </div>

          </div>
        </div>

        {/* Login Section */}
        <div className="p-8 sm:p-10 md:p-12 flex flex-col justify-center">

          {/* Mobile Logo */}
          <div className="md:hidden text-center mb-8">

            <div className="w-20 h-20 bg-cyan-100 rounded-3xl flex items-center justify-center text-5xl mx-auto mb-4">
              🩺
            </div>

            <h1 className="text-4xl font-bold text-slate-800">
              Elder Sense
            </h1>

            <p className="text-slate-500 mt-2">
              Smart care for healthier living
            </p>

          </div>

          {/* Heading */}
          <div className="mb-8">

            <p className="text-cyan-600 font-semibold mb-2">
              Welcome back 👋
            </p>

            <h2 className="text-3xl font-bold text-slate-800">
              Sign in to your account
            </h2>

            <p className="text-slate-500 mt-2">
              Continue your healthcare journey with Elder Sense.
            </p>

          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 rounded-2xl p-4 mb-5 text-sm">
              {error}
            </div>
          )}

          {/* Login Form */}
          <form
            onSubmit={handleSubmit}
            className="space-y-5"
          >

            {/* Email */}
            <div>

              <label className="block text-slate-700 font-medium mb-2">
                Email Address
              </label>

              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter your email"
                required
                className="w-full rounded-2xl bg-slate-50 border border-slate-200 px-5 py-4 text-slate-800 placeholder-slate-400 outline-none transition focus:bg-white focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
              />

            </div>

            {/* Password */}
            <div>

              <label className="block text-slate-700 font-medium mb-2">
                Password
              </label>

              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password"
                required
                className="w-full rounded-2xl bg-slate-50 border border-slate-200 px-5 py-4 text-slate-800 placeholder-slate-400 outline-none transition focus:bg-white focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
              />

            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 disabled:opacity-60 text-white font-semibold rounded-2xl py-4 text-lg shadow-lg shadow-cyan-100 transition-all duration-200 hover:-translate-y-0.5"
            >
              {loading
                ? "Signing in..."
                : "Sign In →"}
            </button>

          </form>

          {/* Divider */}
          <div className="relative my-7">

            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>

            <div className="relative flex justify-center">

              <span className="bg-white px-4 text-sm text-slate-400">
                New to Elder Sense?
              </span>

            </div>

          </div>

          {/* Register */}
          <Link
            to="/register"
            className="w-full text-center border-2 border-cyan-100 hover:border-cyan-300 hover:bg-cyan-50 text-cyan-700 font-semibold rounded-2xl py-3.5 transition"
          >
            Create an Account
          </Link>

          {/* Security Note */}
          <p className="text-center text-xs text-slate-400 mt-7">
            🛡️ Your healthcare information is handled securely.
          </p>

        </div>

      </div>

    </div>
  );
}

export default Login;

