import { useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Layout from "../components/Layout";
import Button from "../components/Button";

// This screen used to be two buttons -- "Continue as RLA" / "Continue as
// Manager" -- which meant anyone could claim any role. Now that a manager's
// name gets stamped on spending entries and an RLA's name on every submission,
// identity has to be something proven rather than chosen from a menu.

export default function Login() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Already signed in (e.g. they hit /login by hand) -- send them home.
  if (!loading && user) {
    return <Navigate to={user.role === "manager" ? "/manager" : "/rla"} replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const signedIn = await login(email, password);

      if (signedIn.mustChangePassword) {
        navigate("/change-password", { replace: true });
        return;
      }

      // Resume whatever they were trying to reach before being bounced here.
      const intended = location.state?.from?.pathname;
      const home = signedIn.role === "manager" ? "/manager" : "/rla";
      navigate(intended || home, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "Could not sign you in");
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-mbzuai-navy/20 px-3 py-2 text-mbzuai-navy focus:border-mbzuai-gold focus:outline-none focus:ring-1 focus:ring-mbzuai-gold";

  return (
    <Layout>
      <div className="flex justify-center pt-12">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-mbzuai-navy/10 p-10">
          <p className="text-mbzuai-gold font-medium tracking-wide uppercase text-sm">
            Welcome
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-mbzuai-navy">
            Prepaid Card Reconciliation
          </h1>
          <p className="mt-3 text-mbzuai-navy/70">Sign in to continue.</p>

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-mbzuai-navy/70 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-mbzuai-navy/70 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="mt-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Signing in…" : "Sign in"}
              </Button>
            </div>
          </form>

          <p className="mt-6 text-sm text-mbzuai-navy/50">
            Forgotten your password? Ask a manager to reset it — they can issue
            you a new temporary one.
          </p>
        </div>
      </div>
    </Layout>
  );
}
