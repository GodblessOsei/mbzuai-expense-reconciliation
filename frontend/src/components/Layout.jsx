import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-mbzuai-sand">
      {/* Gold header band */}
      <header className="bg-mbzuai-gold">
        <div className="mx-auto max-w-6xl px-6 py-5 flex items-center gap-4">
          {/* Logo mark — simple dotted motif placeholder , svg later*/}
          <div className="flex flex-col leading-tight">
            <span className="text-mbzuai-navy font-semibold text-lg">
              Mohamed bin Zayed University
            </span>
            <span className="text-mbzuai-navy/80 text-sm">
              of Artificial Intelligence
            </span>
          </div>

          <div className="ml-auto flex items-center gap-4">
            <span className="hidden sm:inline text-mbzuai-navy/70 text-sm">
              RLA Prepaid Card Reconciliation
            </span>

            {/* Who am I signed in as. Worth showing permanently: everything
                this person does now carries their name, and on shared machines
                it is easy to forget whose session is open. */}
            {user && (
              <div className="flex items-center gap-3 border-l border-mbzuai-navy/20 pl-4">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-mbzuai-navy text-white text-sm font-semibold">
                  {user.fullName.charAt(0)}
                </span>
                <span className="hidden sm:flex flex-col leading-tight">
                  <span className="text-mbzuai-navy text-sm font-medium">
                    {user.fullName}
                  </span>
                  {/* Not CSS `capitalize` — that renders "rla" as "Rla". */}
                  <span className="text-mbzuai-navy/60 text-xs">
                    {user.role === "rla" ? "RLA" : "Manager"}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="text-mbzuai-navy/70 hover:text-mbzuai-navy text-sm underline"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
