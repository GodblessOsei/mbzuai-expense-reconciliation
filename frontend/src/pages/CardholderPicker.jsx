import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../api/client";
import { useAuth } from "../context/AuthContext";
import Layout from "../components/Layout";

export default function CardholderPicker() {
  const { setCardholder } = useAuth();
  const navigate = useNavigate();
  const [cardholders, setCardholders] = useState([]);

  useEffect(() => {
    apiClient
      .get("/cardholders")
      .then((res) => setCardholders(res.data.cardholders))
      .catch((err) =>
        console.error("Failed to load cardholders:", err.message)
      );
  }, []);

  const handlePick = (cardholder) => {
    setCardholder(cardholder);
    navigate("/rla/dashboard");
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <p className="text-mbzuai-gold font-medium tracking-wide uppercase text-sm">
          Sign in
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-mbzuai-navy">
          Who are you?
        </h1>
        <p className="mt-3 text-mbzuai-navy/70">
          Select your cardholder profile to continue.
        </p>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {cardholders.map((c) => (
            <button
              key={c.cardholder_id}
              onClick={() => handlePick(c)}
              className="group flex items-center gap-4 bg-white rounded-2xl border border-mbzuai-navy/10 p-5 text-left hover:border-mbzuai-gold hover:shadow-md transition-all"
            >
              {/* avatar circle with initial */}
              <span className="flex items-center justify-center w-12 h-12 rounded-full bg-mbzuai-navy text-white font-semibold text-lg">
                {c.cardholder_name.charAt(0)}
              </span>
              <span className="flex flex-col">
                <span className="font-semibold text-mbzuai-navy">
                  {c.cardholder_name}
                </span>
                <span className="text-sm text-mbzuai-navy/60">
                  RLA Cardholder
                </span>
              </span>
              <span className="ml-auto text-mbzuai-navy/30 group-hover:text-mbzuai-gold transition-colors">
                →
              </span>
            </button>
          ))}
        </div>
      </div>
    </Layout>
  );
}
