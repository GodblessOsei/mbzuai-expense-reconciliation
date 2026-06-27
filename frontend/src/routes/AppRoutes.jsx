import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "../pages/Login";
import RlaDashboard from "../pages/rla/RlaDashboard";
import ManagerDashboard from "../pages/manager/ManagerDashboard";
import CardholderPicker from "../pages/CardholderPicker";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/rla/dashboard" element={<RlaDashboard />} />
        <Route path="/rla" element={<CardholderPicker />} />
        <Route path="/manager" element={<ManagerDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
