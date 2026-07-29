import { useState, useEffect, useCallback } from "react";
import apiClient from "../api/client";

// Shared machinery behind the RLA and Manager admin screens.
//
// The two screens differ in what they SHOW and what they REQUIRE -- RLAs hold
// cards and must have one, managers never do -- but adding, switching off,
// reactivating and resetting a password are identical operations. This holds
// that half so neither page has to restate it.

export function useUserAdmin(role) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // A temporary password is shown ONCE and never retrievable again -- only its
  // hash is stored. Held here until the manager confirms they have passed it on.
  const [issued, setIssued] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get("/users", { params: { role } });
      setUsers(res.data.users);
    } catch (err) {
      console.error("Failed to load users:", err);
      setError(err.response?.data?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    load();
  }, [load]);

  // Every action funnels through here so one page never forgets to surface an
  // error or forgets to refresh afterwards.
  const run = async (fn, fallbackMessage) => {
    setError("");
    try {
      const result = await fn();
      await load();
      return result;
    } catch (err) {
      setError(err.response?.data?.message || fallbackMessage);
      return null;
    }
  };

  const createUser = (body) =>
    run(async () => {
      const res = await apiClient.post("/users", { ...body, role });
      setIssued({
        name: res.data.user.fullName,
        email: res.data.user.email,
        password: res.data.temporaryPassword,
      });
      return res.data.user;
    }, "Could not create that account");

  const deactivate = (target) =>
    run(
      () => apiClient.patch(`/users/${target.userId}/deactivate`),
      "Could not switch off that account"
    );

  const reactivate = (target) =>
    run(
      () => apiClient.patch(`/users/${target.userId}/reactivate`),
      "Could not switch that account back on"
    );

  const resetPassword = (target) =>
    run(async () => {
      const res = await apiClient.post(`/users/${target.userId}/reset-password`);
      setIssued({
        name: target.fullName,
        email: target.email,
        password: res.data.temporaryPassword,
      });
    }, "Could not reset that password");

  return {
    users,
    loading,
    error,
    setError,
    issued,
    dismissIssued: () => setIssued(null),
    reload: load,
    createUser,
    deactivate,
    reactivate,
    resetPassword,
  };
}
