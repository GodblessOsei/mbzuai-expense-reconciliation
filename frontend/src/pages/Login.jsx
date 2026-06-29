import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Layout from "../components/Layout";
import Button from "../components/Button";

export default function Login() {
  const { setRole } = useAuth();
  const navigate = useNavigate();

  const handleRole = (role) => {
    setRole(role);
    navigate(role === "manager" ? "/manager" : "/rla");
  };

  return (
    <Layout>
      <div className="flex justify-center pt-12">
        <div className="w-full max-w-xl bg-white rounded-2xl shadow-sm border border-mbzuai-navy/10 p-10">
          <p className="text-mbzuai-gold font-medium tracking-wide uppercase text-sm">
            Welcome
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-mbzuai-navy">
            Prepaid Card Reconciliation
          </h1>
          <p className="mt-3 text-mbzuai-navy/70">
            Select your role to continue.
          </p>

          <div className="mt-8 flex flex-col gap-3">
            <Button variant="primary" onClick={() => handleRole("rla")}>
              Continue as RLA
            </Button>
            <Button variant="outline" onClick={() => handleRole("manager")}>
              Continue as Manager
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
