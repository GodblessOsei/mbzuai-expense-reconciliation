import axios from "axios";

// Relative by default so every request rides the current origin (localhost or
// an ngrok tunnel) and gets proxied to the backend by the Vite dev server.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

export default apiClient;
