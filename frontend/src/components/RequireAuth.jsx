import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Layout from "./Layout";

// Route guards are CONVENIENCE, not security. Their job is to stop an RLA
// seeing a manager screen, not to stop them calling the endpoint -- anything
// that actually matters is enforced by requireAuth/requireRole on the server,
// because a hidden button is not access control.

function Loading() {
  return (
    <Layout>
      <div className="py-20 text-center">
        <div className="inline-block w-8 h-8 border-4 border-mbzuai-navy/20 border-t-mbzuai-navy rounded-full animate-spin" />
      </div>
    </Layout>
  );
}

export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Wait for the stored token to be checked. Redirecting during this window is
  // what used to throw signed-in users back to the login screen on refresh.
  if (loading) return <Loading />;

  if (!user) {
    // Remember where they were headed so signing in resumes it.
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Someone on a temporary password can go exactly one place until they pick
  // their own. Checked here rather than per-page so no route can miss it.
  if (user.mustChangePassword && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }

  return <Outlet />;
}

export function RequireRole({ role }) {
  const { user, loading } = useAuth();

  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;

  // Send them to their own home rather than showing a dead end.
  if (user.role !== role) {
    return <Navigate to={user.role === "manager" ? "/manager" : "/rla"} replace />;
  }

  return <Outlet />;
}
