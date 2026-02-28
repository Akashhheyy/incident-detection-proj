import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import CameraView from "./CameraView.jsx";
import AlertPanel from "./AlertPanel.jsx";
import { fetchAlerts } from "./api.js";

function Dashboard({ detectionStatus, onStartDetection, onStopDetection }) {
  const [alerts, setAlerts] = useState([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [alertsError, setAlertsError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadAlerts = async (initial = false) => {
      if (!isMounted) return;
      if (initial) {
        setLoadingAlerts(true);
        setAlertsError(null);
      }
      try {
        const response = await fetchAlerts();
        if (!isMounted) return;
        setAlerts(response.data || []);
        setAlertsError(null);
      } catch (error) {
        if (!isMounted) return;
        setAlertsError(
          "Failed to load alerts from server. Check that the backend is running."
        );
      } finally {
        if (initial && isMounted) {
          setLoadingAlerts(false);
        }
      }
    };

    // Initial load
    loadAlerts(true);

    // Poll every 3 seconds for near-real-time updates
    const intervalId = setInterval(() => {
      loadAlerts(false);
    }, 3000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  return (
    <>
      <header className="h-16 flex items-center justify-between px-4 md:px-8 border-b border-slate-800 bg-slate-950/60 backdrop-blur-xl">
        <div>
          <h2 className="text-base md:text-lg font-semibold text-slate-50">
            Operations Center
          </h2>
          <p className="text-[11px] text-slate-400">
            Monitor your live camera feed and incident alerts in real time.
          </p>
        </div>
      </header>

      <section className="flex-1 px-4 md:px-8 py-5 md:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-6">
          <div className="lg:col-span-2">
            <CameraView
              onStartDetection={onStartDetection}
              onStopDetection={onStopDetection}
              detectionStatus={detectionStatus}
            />
          </div>
          <div className="lg:col-span-1">
            <AlertPanel
              alerts={alerts}
              loading={loadingAlerts}
              error={alertsError}
            />
          </div>
        </div>
      </section>
    </>
  );
}

Dashboard.propTypes = {
  detectionStatus: PropTypes.oneOf([
    "idle",
    "starting",
    "active",
    "stopping",
    "error",
  ]).isRequired,
  onStartDetection: PropTypes.func.isRequired,
  onStopDetection: PropTypes.func.isRequired,
};

export default Dashboard;
