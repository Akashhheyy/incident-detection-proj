import PropTypes from "prop-types";

function AlertPanel({ alerts, loading, error }) {
  const hasAlerts = alerts && alerts.length > 0;
  const latestAlert = hasAlerts ? alerts[0] : null;

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl shadow-lg shadow-slate-900/50 p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">
            Real-time Alerts
          </h2>
          <p className="text-xs text-slate-400">
            Fetched from FastAPI endpoint{" "}
            <span className="font-mono text-slate-300 text-[10px]">
              /alerts
            </span>
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          Live
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 text-xs">
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5">
          <p className="text-slate-400 text-[11px]">Total Alerts</p>
          <p className="text-xl font-semibold text-slate-50 mt-1">
            {alerts.length}
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5">
          <p className="text-slate-400 text-[11px]">Last Alert Type</p>
          <p className="text-sm font-medium text-slate-50 mt-1">
            {latestAlert ? latestAlert.alert_type : "—"}
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5">
          <p className="text-slate-400 text-[11px]">Last Confidence</p>
          <p className="text-sm font-medium text-slate-50 mt-1">
            {latestAlert ? `${(latestAlert.confidence * 100).toFixed(1)}%` : "—"}
          </p>
        </div>
      </div>

      {error && (
        <div className="text-xs text-rose-400 bg-rose-950/40 border border-rose-900/60 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-xs text-slate-400 flex items-center gap-2">
          <span className="h-3 w-3 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
          Loading alerts…
        </div>
      )}

      <div className="mt-1">
        <h3 className="text-xs font-semibold text-slate-300 mb-2">
          Alert History
        </h3>
        <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950/60">
          <div className="max-h-64 overflow-auto scrollbar-thin">
            <table className="min-w-full text-[11px]">
              <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-300">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Time</th>
                  <th className="px-3 py-2 text-left font-medium">Camera</th>
                  <th className="px-3 py-2 text-left font-medium">Type</th>
                  <th className="px-3 py-2 text-left font-medium">
                    Confidence
                  </th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => (
                  <tr
                    key={alert.id || `${alert.timestamp}-${alert.alert_type}`}
                    className="border-b border-slate-800/60 last:border-0 hover:bg-slate-900/80 transition-colors"
                  >
                    <td className="px-3 py-2 text-slate-200 whitespace-nowrap">
                      {new Date(alert.timestamp).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-slate-300">
                      {alert.camera_id || "CAM-1"}
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-100">
                        {alert.alert_type}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-200">
                      {(alert.confidence * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
                {!alerts.length && !loading && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-4 text-center text-slate-500"
                    >
                      No alerts recorded yet. Start detection and they will
                      appear here in real time.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

AlertPanel.propTypes = {
  alerts: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      alert_type: PropTypes.string.isRequired,
      confidence: PropTypes.number.isRequired,
      timestamp: PropTypes.string.isRequired,
      camera_id: PropTypes.string,
    })
  ).isRequired,
  loading: PropTypes.bool.isRequired,
  error: PropTypes.string,
};

AlertPanel.defaultProps = {
  error: null,
};

export default AlertPanel;
