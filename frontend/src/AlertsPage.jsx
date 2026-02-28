import { useEffect, useState } from "react";
import AlertPanel from "./AlertPanel.jsx";
import { fetchAlerts } from "./api.js";

function AlertsPage() {
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

    loadAlerts(true);
    const intervalId = setInterval(() => loadAlerts(false), 3000);

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
            Alerts History
          </h2>
          <p className="text-[11px] text-slate-400">
            Review all recorded alerts from YOLO detections.
          </p>
        </div>
      </header>
      <section className="flex-1 px-4 md:px-8 py-5 md:py-6">
        <AlertPanel alerts={alerts} loading={loadingAlerts} error={alertsError} />
      </section>
    </>
  );
}

export default AlertsPage;

