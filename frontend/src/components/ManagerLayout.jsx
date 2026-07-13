import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Layout from "./Layout";

const menuItems = [
  { label: "Reconciliation Spreadsheets", path: "/manager/packages"          },
  { label: "Download Package",            path: "/manager/package-download"  },
  { label: "Set Budget",                  path: "/manager/budget"            },
];

const tabItems = [
  { label: "Dashboard",           path: "/manager/dashboard"            },
  { label: "Transactions",        path: "/manager/transactions"         },
  { label: "Additional Spending", path: "/manager/additional-spending"  },
];

export default function ManagerLayout({ children }) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const [open, setOpen] = useState(false);
  const menuRef   = useRef(null);

  // close flyout when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const go = (path) => { navigate(path); setOpen(false); };

  return (
    <Layout>
      <div className="flex items-center justify-between border-b border-mbzuai-navy/10 mb-8 relative" ref={menuRef}>
        {/* tabs */}
        <div className="flex gap-2">
          {tabItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => go(item.path)}
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

        {/* menu button */}
        <div className="relative pb-px">
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Open menu"
            className={`p-2 rounded-md border-b-2 -mb-px transition-colors ${
              open
                ? "border-mbzuai-gold text-mbzuai-navy"
                : "border-transparent text-mbzuai-navy/50 hover:text-mbzuai-navy"
            }`}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <rect x="2" y="4"  width="16" height="2" rx="1" fill="currentColor" />
              <rect x="2" y="9"  width="16" height="2" rx="1" fill="currentColor" />
              <rect x="2" y="14" width="16" height="2" rx="1" fill="currentColor" />
            </svg>
          </button>

          {/* flyout panel */}
          {open && (
            <div className="absolute right-0 top-full mt-1 w-64 bg-mbzuai-navy rounded-xl shadow-xl z-50 overflow-hidden">
              {menuItems.map((item) => {
                const active = location.pathname === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => go(item.path)}
                    className={`w-full text-left px-5 py-3.5 text-sm transition-colors border-b border-white/10 last:border-0 ${
                      active
                        ? "text-mbzuai-gold font-semibold bg-white/10"
                        : "text-white hover:bg-white/10"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {children}
    </Layout>
  );
}
