import { useEffect, useRef, useState } from "react";
import { HeartPulse, Camera, Square, ArrowLeft } from "lucide-react";
import { PPG } from "@sontakey/ppg-js";
import { useNavigate } from "react-router-dom";

function HeartRateTest() {
  const navigate = useNavigate();

  const videoRef = useRef(null);
  const ppgRef = useRef(null);

  const [running, setRunning] = useState(false);
  const [heartRate, setHeartRate] = useState(null);
  const [status, setStatus] = useState(
    "Click Start and place your fingertip over the rear camera."
  );
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      if (ppgRef.current) {
        try {
          ppgRef.current.stop();
          ppgRef.current.destroy();
        } catch (err) {
          console.error("PPG cleanup error:", err);
        }
      }
    };
  }, []);

  const startMeasurement = async () => {
    setError("");
    setHeartRate(null);

    try {
      setStatus(
        "Starting camera... Place your fingertip gently over the rear camera."
      );

      const ppg = new PPG({
        camera: {
          facingMode: "environment",
          torch: true,
        },
        video: videoRef.current,
        wakeLock: true,
      });

      ppg.addEventListener("state", (event) => {
        const { state, reason } = event.detail;

        console.log("PPG state:", state, reason);

        if (state === "NO_FINGER") {
          setStatus(
            "Place your fingertip over the rear camera and keep still."
          );
        } else if (state === "SETTLING") {
          setStatus("Finger detected. Keep your finger still...");
        } else if (state === "MEASURING") {
          setStatus("Measuring heart rate...");
        }
      });

      ppg.addEventListener("metrics", (event) => {
        const metrics = event.detail;

        console.log("PPG metrics:", metrics);

        if (
          metrics.quality?.good &&
          metrics.heartRate > 0
        ) {
          const measuredHeartRate = Math.round(
            metrics.heartRate
          );

          setHeartRate(measuredHeartRate);

          setStatus(
            "Good signal detected. Your heart-rate estimate is ready."
          );
        } else {
          setStatus(
            metrics.guidanceMessage ||
              "Collecting a good signal. Keep your finger still..."
          );
        }
      });

      ppg.addEventListener("error", (event) => {
        console.error("PPG error:", event.detail);

        const guidance =
          event.detail?.error?.guidance ||
          "Camera measurement could not be started.";

        setError(guidance);
        setStatus("Measurement stopped.");
        setRunning(false);
      });

      ppgRef.current = ppg;

      await ppg.start();

      setRunning(true);

      setStatus(
        "Camera started. Place your fingertip over the rear camera and keep still."
      );
    } catch (err) {
      console.error("Heart-rate measurement error:", err);

      setError(
        err?.guidance ||
          err?.message ||
          "Unable to start camera measurement. Please allow camera permission and try again."
      );

      setStatus("Unable to start measurement.");
      setRunning(false);
    }
  };

  const stopMeasurement = () => {
    if (ppgRef.current) {
      try {
        ppgRef.current.stop();
        ppgRef.current.destroy();
      } catch (err) {
        console.error("PPG stop error:", err);
      }

      ppgRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setRunning(false);

    setStatus(
      "Measurement stopped. Click Start to measure again."
    );
  };

  const useReading = () => {
    if (!heartRate) {
      return;
    }

    /*
      Store the measured BPM temporarily.

      HealthVitals will retrieve it, automatically save it as a
      new vital record, and reload the Dashboard data.
    */
    localStorage.setItem(
      "elderSenseCameraHeartRate",
      String(heartRate)
    );

    stopMeasurement();

    navigate("/health-vitals");
  };

  return (
    <div className="min-h-screen bg-[#f4fbfa] px-5 py-10 text-slate-800">
      <div className="mx-auto max-w-xl">
        <div className="mb-4">
          <button
            onClick={() => navigate("/health-vitals")}
            className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-cyan-50 hover:text-cyan-600"
          >
            <ArrowLeft size={17} />
            Back to Health & Vitals
          </button>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500">
              <HeartPulse size={25} />
            </div>

            <div>
              <h1 className="text-xl font-bold">
                Camera Heart Rate Test
              </h1>

              <p className="text-sm text-slate-400">
                Experimental wellness measurement
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl bg-black">
            <video
              ref={videoRef}
              muted
              playsInline
              autoPlay
              className="h-72 w-full object-cover"
            />
          </div>

          <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-center">
            <p className="text-sm text-slate-500">
              {status}
            </p>

            {heartRate !== null && (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Estimated Heart Rate
                </p>

                <p className="mt-1 text-5xl font-bold text-red-500">
                  {heartRate}
                  <span className="ml-2 text-lg">
                    BPM
                  </span>
                </p>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-600">
              ⚠️ {error}
            </div>
          )}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
            {!running ? (
              <button
                onClick={startMeasurement}
                className="flex items-center justify-center gap-2 rounded-xl bg-red-500 px-5 py-3 font-semibold text-white transition hover:bg-red-600"
              >
                <Camera size={18} />
                Start Measurement
              </button>
            ) : (
              <button
                onClick={stopMeasurement}
                className="flex items-center justify-center gap-2 rounded-xl bg-slate-700 px-5 py-3 font-semibold text-white transition hover:bg-slate-800"
              >
                <Square size={17} />
                Stop Measurement
              </button>
            )}

            {heartRate !== null && (
              <button
                onClick={useReading}
                className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-white transition hover:bg-emerald-600"
              >
                <HeartPulse size={18} />
                Use This Reading
              </button>
            )}
          </div>

          <div className="mt-6 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-xs leading-5 text-amber-700">
            <strong>Important:</strong> This is an experimental,
            camera-based heart-rate estimate. It is not a medical device
            and should not be used for diagnosis or emergency decisions.
            For medical decisions, use an appropriate medical device or
            healthcare professional.
          </div>
        </div>
      </div>
    </div>
  );
}

export default HeartRateTest;