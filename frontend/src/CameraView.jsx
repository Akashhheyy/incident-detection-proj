import { useState } from "react";
import PropTypes from "prop-types";
import { API_BASE_URL } from "./api.js";

function CameraView({
  onStartDetection,
  onStopDetection,
  detectionStatus,
  backendOnline,
}) {
  // Requirement: live camera must use this exact src
  const videoUrl = "http://localhost:8000/video_feed";
  const [streamError, setStreamError] = useState(false);

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl shadow-lg shadow-slate-900/50 p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">
            Live Camera Feed
          </h2>
          <p className="text-xs text-slate-400">
            Streaming directly from FastAPI at{" "}
            <span className="font-mono text-slate-300 text-[10px]">
              /video_feed
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-medium text-slate-300">
            <span
              className={`h-2 w-2 rounded-full ${
                detectionStatus === "active"
                  ? "bg-emerald-400 animate-pulse"
                  : detectionStatus === "starting" || detectionStatus === "stopping"
                  ? "bg-amber-400 animate-pulse"
                  : "bg-slate-500"
              }`}
            />
            {detectionStatus === "active" && "Detection ON"}
            {detectionStatus === "starting" && "Starting…"}
            {detectionStatus === "stopping" && "Stopping…"}
            {detectionStatus === "idle" && "Detection OFF"}
            {detectionStatus === "error" && "Error"}
          </span>
          <button
            type="button"
            onClick={onStartDetection}
            disabled={
              detectionStatus === "starting" ||
              detectionStatus === "active" ||
              detectionStatus === "stopping"
            }
            className="inline-flex items-center gap-2 rounded-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-900 disabled:text-emerald-300/60 text-white text-xs font-medium px-3 py-1.5 transition-colors"
          >
            Start
          </button>
          <button
            type="button"
            onClick={onStopDetection}
            disabled={
              detectionStatus === "idle" ||
              detectionStatus === "starting" ||
              detectionStatus === "stopping"
            }
            className="inline-flex items-center gap-2 rounded-full bg-rose-500 hover:bg-rose-600 disabled:bg-rose-900 disabled:text-rose-300/60 text-white text-xs font-medium px-3 py-1.5 transition-colors"
          >
            Stop
          </button>
        </div>
      </div>

      <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
        {streamError ? (
          <div className="w-full h-72 flex flex-col items-center justify-center text-center px-6">
            <p className="text-sm font-medium text-slate-100">
              Live stream unavailable
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              {backendOnline
                ? "The camera stream could not be loaded. Check that the webcam is free and the backend has access to it."
                : "The backend appears to be offline. Start the FastAPI server to resume streaming."}
            </p>
          </div>
        ) : (
          <>
            <div className="absolute inset-0 bg-slate-900/20 pointer-events-none" />
            <img
              src={videoUrl}
              alt="Live camera"
              className="w-full h-72 object-cover bg-black"
              onError={() => setStreamError(true)}
            />
          </>
        )}
      </div>
      <p className="text-[11px] text-slate-400">
        Ensure your backend is running on{" "}
        <span className="font-mono text-slate-200">
          {API_BASE_URL.replace(/\/$/, "")}
        </span>{" "}
        and that a webcam is connected to the server machine.
      </p>
    </div>
  );
}

CameraView.propTypes = {
  onStartDetection: PropTypes.func.isRequired,
  onStopDetection: PropTypes.func.isRequired,
  detectionStatus: PropTypes.oneOf([
    "idle",
    "starting",
    "active",
    "stopping",
    "error",
  ]).isRequired,
  backendOnline: PropTypes.bool.isRequired,
};

export default CameraView;
