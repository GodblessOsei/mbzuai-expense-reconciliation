import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { RequireAuth, RequireRole } from "../components/RequireAuth";
import { useAuth } from "../context/AuthContext";
import Login from "../pages/Login";
import ChangePassword from "../pages/ChangePassword";
import RlaDashboard from "../pages/rla/RlaDashboard";
import SubmissionPage from "../pages/rla/SubmissionPage";
import ManagerDashboard from "../pages/manager/ManagerDashboard";
import ManagerTransactions from "../pages/manager/ManagerTransactions";
import ManagerSpreadsheet from "../pages/manager/ManagerSpreadsheet";
import ManagerPackageDownload from "../pages/manager/ManagerPackageDownload";
import ManagerBudget from "../pages/manager/ManagerBudget";
import ManagerAdditionalSpending from "../pages/manager/ManagerAdditionalSpending";
import ManagerBudgetItems from "../pages/manager/ManagerBudgetItems";
import ManagerRlas from "../pages/manager/ManagerRlas";
import ManagerManagers from "../pages/manager/ManagerManagers";

// Send each role to its own home. Reached only when already signed in, since
// RequireAuth wraps it.
function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={user.role === "manager" ? "/manager" : "/rla"} replace />;
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />

        {/* Signed in, any role */}
        <Route element={<RequireAuth />}>
          <Route path="/change-password" element={<ChangePassword />} />

          {/* RLA. The old /rla "choose your cardholder" step is gone —
              identity comes from signing in, and which card was used is a
              question inside the submission form. */}
          <Route path="/rla" element={<RlaDashboard />} />
          <Route path="/rla/dashboard" element={<Navigate to="/rla" replace />} />
          <Route path="/rla/submit" element={<SubmissionPage />} />

          {/* Manager. All managers see the same thing — no per-manager
              scoping anywhere. */}
          <Route element={<RequireRole role="manager" />}>
            <Route path="/manager" element={<ManagerDashboard />} />
            <Route path="/manager/dashboard" element={<ManagerDashboard />} />
            <Route path="/manager/transactions" element={<ManagerTransactions />} />
            <Route path="/manager/packages" element={<ManagerSpreadsheet />} />
            <Route path="/manager/package-download" element={<ManagerPackageDownload />} />
            <Route path="/manager/budget" element={<ManagerBudget />} />
            <Route path="/manager/additional-spending" element={<ManagerAdditionalSpending />} />
            <Route path="/manager/budget-items" element={<ManagerBudgetItems />} />
            <Route path="/manager/rlas" element={<ManagerRlas />} />
            <Route path="/manager/managers" element={<ManagerManagers />} />
            {/* The old combined "People" screen split in two. */}
            <Route
              path="/manager/users"
              element={<Navigate to="/manager/rlas" replace />}
            />
          </Route>
        </Route>

        {/* "/" is no longer the login screen — RequireAuth decides where an
            unknown visitor lands, which keeps the destination in one place. */}
        <Route path="/" element={<RequireAuth />}>
          <Route index element={<HomeRedirect />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
