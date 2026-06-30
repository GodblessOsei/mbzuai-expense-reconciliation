import { useNavigate, useLocation } from "react-router-dom";
import Layout from "./Layout";

export default function ManagerLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { label: "Transactions", path: "/manager/transactions" },
    { label: "Dashboard", path: "/manager/dashboard" }, // built later
  ];

  return (
    <Layout>
      <div className="flex gap-2 mb-8 border-b border-mbzuai-navy/10">
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                active
                  ? "border-mbzuai-gold text-mbzuai-navy"
                  : "border-transparent text-mbzuai-navy/50 hover:text-mbzuai-navy"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {children}
    </Layout>
  );
}
