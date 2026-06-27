import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../api/client";
import { useAuth } from "../../context/AuthContext";

export default function RlaDashboard() {
  const { cardholder } = useAuth();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);

  // fetch this cardholder's transactions
  useEffect(() => {
    if (!cardholder) return; // guard: no cardholder chosen yet
    apiClient
      .get(`/transactions/cardholder/${cardholder.cardholder_id}`)
      .then((res) => setTransactions(res.data.transactions))
      .catch((err) =>
        console.error("Failed to load transactions:", err.message)
      );
  }, [cardholder]);

  // if someone lands here without picking a cardholder, send them back
  if (!cardholder) {
    return (
      <div>
        <p>No cardholder selected.</p>
        <button onClick={() => navigate("/rla")}>Choose cardholder</button>
      </div>
    );
  }

  return (
    <div>
      <h1>{cardholder.cardholder_name}'s Dashboard</h1>
      <button onClick={() => navigate("/rla/submit")}>+ New Submission</button>

      <h2>Past Submissions</h2>
      {transactions.length === 0 ? (
        <p>No submissions yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Ref</th>
              <th>Date</th>
              <th>Vendor</th>
              <th>Amount (AED)</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.transaction_id}>
                <td>#{t.transaction_id}</td>
                <td>{new Date(t.purchase_date).toLocaleDateString()}</td>
                <td>{t.vendor_name}</td>
                <td>{t.amount_aed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
