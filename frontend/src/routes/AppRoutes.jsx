import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "../pages/Login";
import RlaDashboard from "../pages/rla/RlaDashboard";
import ManagerDashboard from "../pages/manager/ManagerDashboard";
import CardholderPicker from "../pages/CardholderPicker";
import SubmissionPage from "../pages/rla/SubmissionPage";
import ManagerTransactions from "../pages/manager/ManagerTransactions";
import ManagerSpreadsheet from "../pages/manager/ManagerSpreadsheet";
import ManagerPackageDownload from "../pages/manager/ManagerPackageDownload";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/rla/dashboard" element={<RlaDashboard />} />
        <Route path="/rla" element={<CardholderPicker />} />
        <Route path="/rla/submit" element={<SubmissionPage />} />
        <Route path="/manager" element={<ManagerTransactions />} />
        <Route path="/manager/transactions" element={<ManagerTransactions />} />
        <Route path="/manager/packages" element={<ManagerSpreadsheet />} />
        <Route path="/manager/package-download" element={<ManagerPackageDownload />} />
        <Route path="/manager/dashboard" element={<ManagerDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
