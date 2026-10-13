import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import MedicineFinder from "./pages/MedicineFinder";
import AIAssistant from "./pages/AIAssistant";
import HealthVitals from "./pages/HealthVitals";
import Medications from "./pages/Medications";
import Nutrition from "./pages/Nutrition";
import Appointments from "./pages/Appointments";
import DoctorDashboard from "./pages/DoctorDashboard";
import CaregiverDashboard from "./pages/CaregiverDashboard";
import CaregiverElderDetails from "./pages/CaregiverElderDetails";
import HeartRateTest from "./pages/HeartRateTest";
import HealthReports from "./pages/HealthReports";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import MyCareTeam from "./pages/MyCareTeam";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<Navigate to="/login" replace />}
        />

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/register"
          element={<Register />}
        />

        <Route
          path="/dashboard"
          element={<Dashboard />}
        />

        <Route
          path="/medicine-finder"
          element={<MedicineFinder />}
        />

        <Route
          path="/ai-assistant"
          element={<AIAssistant />}
        />

        <Route
          path="/health-vitals"
          element={<HealthVitals />}
        />

        <Route
          path="/medications"
          element={<Medications />}
        />

        <Route
          path="/nutrition"
          element={<Nutrition />}
        />

        <Route
          path="/appointments"
          element={<Appointments />}
        />

        <Route
          path="/doctor"
          element={<DoctorDashboard />}
        />

        <Route
          path="/caregiver"
          element={<CaregiverDashboard />}
        />

        <Route
          path="/caregiver/elder/:elderId"
          element={<CaregiverElderDetails />}
        />

        {/* Temporary heart-rate test */}
        <Route
          path="/heart-rate-test"
          element={<HeartRateTest />}
        />

        <Route path="/health-reports" element={<HealthReports />} />

        <Route path="/profile" element={<Profile />} />

        <Route path="/settings" element={<Settings />} />

              <Route path="/my-care-team" element={<MyCareTeam />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
