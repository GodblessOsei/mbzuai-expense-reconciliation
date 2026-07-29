import { createContext, useContext, useEffect, useState } from "react";
import apiClient, { setAuthToken, onAuthExpired } from "../api/client";

const AuthContext = createContext(null);

const TOKEN_KEY = "mbzuai.token";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // The card this person currently holds, if any. NOT their identity -- it is
  // only used to pre-select their own card and to shape their dashboard.
  const [assignedCard, setAssignedCard] = useState(null);
  // Starts true because on a fresh page load we genuinely do not know yet
  // whether the stored token is still good. Without this the route guards run
  // before the answer arrives and bounce a signed-in user back to the login
  // screen on every refresh -- which is exactly the old known limitation.
  const [loading, setLoading] = useState(true);

  const applySession = (token, nextUser, nextCard) => {
    localStorage.setItem(TOKEN_KEY, token);
    setAuthToken(token);
    setUser(nextUser);
    setAssignedCard(nextCard ?? null);
  };

  const clearSession = () => {
    localStorage.removeItem(TOKEN_KEY);
    setAuthToken(null);
    setUser(null);
    setAssignedCard(null);
  };

  // Rehydrate from the stored token on first mount. The token alone is not
  // trusted -- /auth/me re-reads the account server-side, so a token belonging
  // to someone since deactivated fails here rather than appearing signed in.
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
      setLoading(false);
      return;
    }

    setAuthToken(token);

    apiClient
      .get("/auth/me")
      .then((res) => {
        setUser(res.data.user);
        setAssignedCard(res.data.assignedCard ?? null);
      })
      .catch(() => clearSession()) // expired or revoked; start clean
      .finally(() => setLoading(false));
  }, []);

  // A 401 from anywhere means this session is over. Registering it here keeps
  // the axios layer free of React concerns.
  useEffect(() => onAuthExpired(clearSession), []);

  const login = async (email, password) => {
    const res = await apiClient.post("/auth/login", { email, password });
    applySession(res.data.token, res.data.user, res.data.assignedCard);
    return res.data.user;
  };

  const logout = () => clearSession();

  // After changing their own password the forced-change flag is stale in
  // local state; refresh it so the app stops redirecting them back.
  const refreshUser = async () => {
    const res = await apiClient.get("/auth/me");
    setUser(res.data.user);
    setAssignedCard(res.data.assignedCard ?? null);
    return res.data.user;
  };

  const value = {
    user,
    assignedCard,
    loading,
    login,
    logout,
    refreshUser,
    isManager: user?.role === "manager",
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
