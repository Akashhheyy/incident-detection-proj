import axios from "axios";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

api.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error)
);

export const fetchAlerts = () => api.get("/alerts");
export const startDetection = () => api.post("/start_detection");
export const stopDetection = () => api.post("/stop_detection");
export const checkHealth = () => api.get("/health");

export default api;
