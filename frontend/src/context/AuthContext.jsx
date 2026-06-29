import { createContext, useContext, useState } from "react";

const AuthContext = createContext(null);

// wrapper
export function AuthProvider({ children }) {
  const [role, setRole] = useState(null); // "rla" | "manager" | null
  const [cardholder, setCardholder] = useState(null); // { cardholder_id, cardholder_name } | null

  const value = { role, setRole, cardholder, setCardholder };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// hook
export function useAuth() {
  return useContext(AuthContext);
}
