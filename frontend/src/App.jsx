import { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import Dashboard from "./Dashboard.jsx";
import CamerasPage from "./CamerasPage.jsx";
import AlertsPage from "./AlertsPage.jsx";
import SettingsPage from "./SettingsPage.jsx";
import Layout from "./Layout.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";
import { checkHealth, startDetection, stopDetection } from "./api.js";

function App() {
  const [backendOnline, setBackendOnline] = useState(true);
  const [detectionStatus, setDetectionStatus] = useState("idle");

  useEffect(() => {
    let cancelled = false;

    const pollHealth = async () => {
      try {
        await checkHealth();
        if (!cancelled) {
          setBackendOnline(true);
        }
      } catch {
        if (!cancelled) {
          setBackendOnline(false);
        }
      }
    };

    pollHealth();
    const intervalId = setInterval(pollHealth, 5000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []);

  const handleStartDetection = async () => {
    if (detectionStatus === "active" || detectionStatus === "starting") return;
    setDetectionStatus("starting");
    try {
      await startDetection();
      setDetectionStatus("active");
    } catch {
      setDetectionStatus("error");
    }
  };

  const handleStopDetection = async () => {
    if (detectionStatus === "idle" || detectionStatus === "stopping") return;
    setDetectionStatus("stopping");
    try {
      await stopDetection();
      setDetectionStatus("idle");
    } catch {
      setDetectionStatus("error");
    }
  };

  return (
    <ErrorBoundary>
      <Layout backendOnline={backendOnline} detectionStatus={detectionStatus}>
        <Routes>
          <Route
            path="/"
            element={
              <Dashboard
                detectionStatus={detectionStatus}
                onStartDetection={handleStartDetection}
                onStopDetection={handleStopDetection}
              />
            }
          />
          <Route
            path="/cameras"
            element={
              <CamerasPage
                detectionStatus={detectionStatus}
                backendOnline={backendOnline}
              />
            }
          />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Layout>
    </ErrorBoundary>
  );
}

export default App;
