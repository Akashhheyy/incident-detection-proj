import PropTypes from "prop-types";

function CamerasPage({ detectionStatus, backendOnline }) {
  return (
    <>
      <header className="h-16 flex items-center justify-between px-4 md:px-8 border-b border-slate-800 bg-slate-950/60 backdrop-blur-xl">
        <div>
          <h2 className="text-base md:text-lg font-semibold text-slate-50">
            Camera Management
          </h2>
          <p className="text-[11px] text-slate-400">
            View camera connectivity and detection status.
          </p>
        </div>
      </header>
      <section className="flex-1 px-4 md:px-8 py-5 md:py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-100">
              Camera Status
            </h3>
            <p className="text-xs text-slate-400">
              Overview of the primary surveillance camera connected to this
              node.
            </p>
            <div className="mt-2 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Backend connection</span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium ${
                    backendOnline
                      ? "bg-emerald-500/10 text-emerald-300"
                      : "bg-rose-500/10 text-rose-300"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      backendOnline ? "bg-emerald-400" : "bg-rose-400"
                    }`}
                  />
                  {backendOnline ? "Connected" : "Disconnected"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Detection status</span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium ${
                    detectionStatus === "active"
                      ? "bg-emerald-500/10 text-emerald-300"
                      : detectionStatus === "starting" ||
                        detectionStatus === "stopping"
                      ? "bg-amber-500/10 text-amber-300"
                      : detectionStatus === "error"
                      ? "bg-rose-500/10 text-rose-300"
                      : "bg-slate-700/40 text-slate-200"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      detectionStatus === "active"
                        ? "bg-emerald-400"
                        : detectionStatus === "starting" ||
                          detectionStatus === "stopping"
                        ? "bg-amber-400"
                        : detectionStatus === "error"
                        ? "bg-rose-400"
                        : "bg-slate-400"
                    }`}
                  />
                  {detectionStatus === "active" && "Running"}
                  {detectionStatus === "idle" && "Stopped"}
                  {detectionStatus === "starting" && "Starting…"}
                  {detectionStatus === "stopping" && "Stopping…"}
                  {detectionStatus === "error" && "Error"}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-3">
              Detection can be controlled from the main dashboard view. Changes
              are reflected here in real time.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

CamerasPage.propTypes = {
  detectionStatus: PropTypes.oneOf([
    "idle",
    "starting",
    "active",
    "stopping",
    "error",
  ]).isRequired,
  backendOnline: PropTypes.bool.isRequired,
};

export default CamerasPage;

