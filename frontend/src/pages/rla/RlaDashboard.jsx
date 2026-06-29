import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import Layout from "../../components/Layout";
import Button from "../../components/Button";

export default function RlaDashboard() {
  const { cardholder } = useAuth();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [nextDeadline, setNextDeadline] = useState(null);

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

  //fetch the next reconciliation deadline
  useEffect(() => {
    apiClient
      .get("/reconciliation-periods")
      .then((res) => {
        const now = new Date();
        const upcoming = res.data.periods.find(
          (p) => new Date(p.end_date) >= now
        );
        setNextDeadline(upcoming);
      })
      .catch((err) => console.error(err.message));
  }, []);

  // if someone lands here without picking a cardholder, send them back
  if (!cardholder) {
    return (
      <Layout>
        <div className="max-w-md mx-auto bg-white rounded-2xl p-8 text-center">
          <p className="text-mbzuai-navy/70">No cardholder selected.</p>
          <div className="mt-4 flex justify-center">
            <Button onClick={() => navigate("/rla")}>Choose cardholder</Button>
          </div>
        </div>
      </Layout>
    );
  }

  // a helper to style status badges
  const statusBadge = (status) => {
    const styles = {
      submitted: "bg-mbzuai-navy/10 text-mbzuai-navy",
      flagged: "bg-amber-100 text-amber-700",
      reviewed: "bg-green-100 text-green-700",
      packaged: "bg-blue-100 text-blue-700",
    };
    return styles[status] || "bg-gray-100 text-gray-600";
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        {/* header row: title + deadline + action */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-mbzuai-gold font-medium tracking-wide uppercase text-sm">
              Dashboard
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-mbzuai-navy">
              {cardholder.cardholder_name}
            </h1>
            {nextDeadline && (
              <p className="mt-2 text-mbzuai-navy/70">
                Next reconciliation deadline:{" "}
                <strong className="text-mbzuai-navy">
                  {new Date(nextDeadline.end_date).toLocaleDateString()}
                </strong>
              </p>
            )}
          </div>
          <Button onClick={() => navigate("/rla/submit")}>
            New Submission
          </Button>
        </div>

        {/* submissions table card */}
        <div className="mt-8 bg-white rounded-2xl border border-mbzuai-navy/10 overflow-hidden">
          <div className="px-6 py-4 border-b border-mbzuai-navy/10">
            <h2 className="font-semibold text-mbzuai-navy">Past Submissions</h2>
          </div>

          {transactions.length === 0 ? (
            <p className="px-6 py-10 text-center text-mbzuai-navy/50">
              No submissions yet. Click “New Submission” to add your first.
            </p>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-mbzuai-navy/50 bg-mbzuai-sand/50">
                  <th className="px-6 py-3 font-medium">Ref</th>
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 font-medium">Vendor</th>
                  <th className="px-6 py-3 font-medium">Amount (AED)</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr
                    key={t.transaction_id}
                    className="border-t border-mbzuai-navy/5 hover:bg-mbzuai-sand/30 transition-colors"
                  >
                    <td className="px-6 py-4 text-mbzuai-navy/70">
                      #{t.transaction_id}
                    </td>
                    <td className="px-6 py-4 text-mbzuai-navy/70">
                      {new Date(t.purchase_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 font-medium text-mbzuai-navy">
                      {t.vendor_name}
                    </td>
                    <td className="px-6 py-4 text-mbzuai-navy/70">
                      {t.amount_aed}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${statusBadge(
                          t.status
                        )}`}
                      >
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
}
