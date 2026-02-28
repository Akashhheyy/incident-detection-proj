import PropTypes from "prop-types";
import { NavLink } from "react-router-dom";

function Layout({ children, backendOnline, detectionStatus }) {
  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Sidebar */}
      <aside className="hidden md:flex md:w-64 flex-col border-r border-slate-800 bg-slate-950/80 backdrop-blur-xl">
        <div className="h-16 flex items-center px-6 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-brand-600 flex items-center justify-center shadow-lg shadow-brand-600/40">
              <span className="h-2 w-2 rounded-full bg-emerald-300 animate-ping" />
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-tight">
                AI Surveillance
              </h1>
              <p className="text-[11px] text-slate-400">
                Real-time incident monitoring
              </p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-4 py-4 text-xs text-slate-300 space-y-1">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `px-3 py-2 rounded-lg flex items-center justify-between ${
                isActive
                  ? "bg-slate-900/80 text-slate-50"
                  : "text-slate-400 hover:text-slate-100 hover:bg-slate-900/60"
              }`
            }
          >
            <span>Dashboard</span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </NavLink>
          <NavLink
            to="/cameras"
            className={({ isActive }) =>
              `px-3 py-2 rounded-lg block ${
                isActive
                  ? "bg-slate-900/80 text-slate-50"
                  : "text-slate-500 hover:text-slate-100 hover:bg-slate-900/60"
              }`
            }
          >
            Camera Management
          </NavLink>
          <NavLink
            to="/alerts"
            className={({ isActive }) =>
              `px-3 py-2 rounded-lg block ${
                isActive
                  ? "bg-slate-900/80 text-slate-50"
                  : "text-slate-500 hover:text-slate-100 hover:bg-slate-900/60"
              }`
            }
          >
            Alerts History
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `px-3 py-2 rounded-lg block ${
                isActive
                  ? "bg-slate-900/80 text-slate-50"
                  : "text-slate-500 hover:text-slate-100 hover:bg-slate-900/60"
              }`
            }
          >
            Settings
          </NavLink>
        </nav>
        <div className="px-4 py-4 border-t border-slate-800/80 text-[11px] text-slate-500 space-y-1">
          <div>
            Connected camera:{" "}
            <span className="text-slate-200 font-medium">1</span>
          </div>
          <div>
            Backend:{" "}
            <span
              className={`font-medium ${
                backendOnline ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {backendOnline ? "Online" : "Offline"}
            </span>
          </div>
          <div>
            Detection:{" "}
            <span
              className={`font-medium ${
                detectionStatus === "active"
                  ? "text-emerald-400"
                  : detectionStatus === "starting" ||
                    detectionStatus === "stopping"
                  ? "text-amber-300"
                  : detectionStatus === "error"
                  ? "text-rose-400"
                  : "text-slate-300"
              }`}
            >
              {detectionStatus === "active" && "ON"}
              {detectionStatus === "idle" && "OFF"}
              {detectionStatus === "starting" && "Starting…"}
              {detectionStatus === "stopping" && "Stopping…"}
              {detectionStatus === "error" && "Error"}
            </span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col">
        {children}
      </main>
    </div>
  );
}

Layout.propTypes = {
  children: PropTypes.node.isRequired,
  backendOnline: PropTypes.bool.isRequired,
  detectionStatus: PropTypes.oneOf([
    "idle",
    "starting",
    "active",
    "stopping",
    "error",
  ]).isRequired,
};

export default Layout;

