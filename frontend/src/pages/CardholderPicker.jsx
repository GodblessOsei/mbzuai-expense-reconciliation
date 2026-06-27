import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function CardholderPicker() {
  const { setCardholder } = useAuth();
  const navigate = useNavigate();
  const [cardholders, setCardholders] = useState([]);

  // load the cardholder
  useEffect(() => {
    apiClient
      .get("/cardholders")
      .then((res) => setCardholders(res.data.cardholders))
      .catch((err) =>
        console.error("Failed to load cardholders:", err.message)
      );
  }, []); //happens once

  const handlePick = (cardholder) => {
    setCardholder(cardholder); // store the whole cardholder object in Context
    navigate("/rla/dashboard"); // go to their dashboard
  };

  return (
    <div>
      <h1>Who are you?</h1>
      <p>Select your cardholder profile</p>
      {cardholders.map((c) => (
        <button key={c.cardholder_id} onClick={() => handlePick(c)}>
          {c.cardholder_name}
        </button>
      ))}
    </div>
  );
}
