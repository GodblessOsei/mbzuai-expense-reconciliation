import { useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../api/client";
import { useAuth } from "../context/AuthContext";
import Layout from "../components/Layout";
import Button from "../components/Button";

// Reached two ways: voluntarily, or forced by RequireAuth when someone is
// still on the temporary password a manager read out to them. The forced case
// is the point -- a password a second person knows should not stay valid.

export default function ChangePassword() {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const forced = user?.mustChangePassword;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    // Checked here rather than server-side: the confirm box exists to catch a
    // typo, and the backend has no business knowing about it.
    if (newPassword !== confirmPassword) {
      setError("The two new passwords do not match");
      return;
    }

    setSubmitting(true);

    try {
      await apiClient.post("/auth/change-password", {
        currentPassword,
        newPassword,
      });

      // Clears the forced-change flag in local state so the guard stops
      // redirecting back here.
      const updated = await refreshUser();
      navigate(updated.role === "manager" ? "/manager" : "/rla", { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "Could not update your password");
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-mbzuai-navy/20 px-3 py-2 text-mbzuai-navy focus:border-mbzuai-gold focus:outline-none focus:ring-1 focus:ring-mbzuai-gold";
  const labelClass = "block text-sm font-medium text-mbzuai-navy/70 mb-1";

  return (
    <Layout>
      <div className="flex justify-center pt-12">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-mbzuai-navy/10 p-10">
          <p className="text-mbzuai-gold font-medium tracking-wide uppercase text-sm">
            {forced ? "One more step" : "Account"}
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-mbzuai-navy">
            Choose your password
          </h1>

          {forced && (
            <p className="mt-3 text-mbzuai-navy/70">
              You are signed in with a temporary password. Pick your own before
              carrying on — someone else knows the current one.
            </p>
          )}

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
            <div>
              <label htmlFor="current" className={labelClass}>
                {forced ? "Temporary password" : "Current password"}
              </label>
              <input
                id="current"
                type="password"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="new" className={labelClass}>
                New password
              </label>
              <input
                id="new"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputClass}
              />
              <p className="mt-1 text-xs text-mbzuai-navy/50">
                At least 8 characters.
              </p>
            </div>

            <div>
              <label htmlFor="confirm" className={labelClass}>
                Confirm new password
              </label>
              <input
                id="confirm"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="mt-2 flex items-center gap-4">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : "Save password"}
              </Button>
              <button
                type="button"
                onClick={() => {
                  logout();
                  navigate("/login", { replace: true });
                }}
                className="text-sm text-mbzuai-navy/60 hover:text-mbzuai-navy underline"
              >
                Sign out
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}
