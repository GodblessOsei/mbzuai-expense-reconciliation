import axios from "axios";

// Relative by default so every request rides the current origin (localhost or
// an ngrok tunnel) and gets proxied to the backend by the Vite dev server.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// The current session token, held in module scope so both axios and the raw
// fetch() download helpers below can reach it. AuthContext owns the lifecycle
// and is the only thing that should call setAuthToken.
let authToken = null;

export const setAuthToken = (token) => {
  authToken = token;
};

export const authHeaders = () =>
  authToken ? { Authorization: `Bearer ${authToken}` } : {};

// Attach the token to every outgoing request.
apiClient.interceptors.request.use((config) => {
  if (authToken) config.headers.Authorization = `Bearer ${authToken}`;
  return config;
});

// A 401 from anywhere means the session is gone -- expired, or the account was
// deactivated while they were using it. AuthContext registers a listener here
// so it can clear its state and show the login screen.
let expiredHandler = null;

export const onAuthExpired = (handler) => {
  expiredHandler = handler;
  return () => {
    expiredHandler = null;
  };
};

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && expiredHandler) expiredHandler();
    return Promise.reject(error);
  }
);

// ---- Authenticated file downloads -----------------------------------------
//
// PDFs, spreadsheets and receipt archives used to be plain <a href> links. A
// browser navigating to a URL sends no Authorization header, so those links
// return 401 now that the routes are genuinely protected.
//
// Fetching the bytes with the header and handing the browser a blob URL keeps
// ONE auth mechanism for the whole app. The alternative -- a token in the
// query string -- puts a credential into browser history and server logs.
const fetchBlob = async (path) => {
  const res = await fetch(`${API_BASE_URL}${path}`, { headers: authHeaders() });

  if (!res.ok) {
    if (res.status === 401 && expiredHandler) expiredHandler();
    // Error responses are JSON even when the success path is a file.
    const message = await res
      .json()
      .then((body) => body.message)
      .catch(() => `Request failed (${res.status})`);
    throw new Error(message);
  }

  return res.blob();
};

// Open a file in a new tab (PDF preview).
export const openAuthedFile = async (path) => {
  const url = URL.createObjectURL(await fetchBlob(path));
  window.open(url, "_blank", "noopener");
  // Revoking immediately would race the new tab reading it; a minute is plenty
  // and avoids holding the blob for the rest of the session.
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};

// Save a file to disk.
export const downloadAuthedFile = async (path, filename) => {
  const url = URL.createObjectURL(await fetchBlob(path));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export default apiClient;
