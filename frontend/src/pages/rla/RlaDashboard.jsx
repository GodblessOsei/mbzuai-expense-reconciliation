import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import Layout from "../../components/Layout";
import Button from "../../components/Button";

const CARD_LIMIT_AED = 5000;

// This screen answers TWO different questions, and they must not be merged:
//
//   "How much of my AED 5,000 is left?"  -- a fact about the CARD. Must include
//   spending someone else put on it, or the number is a lie.
//
//   "Have I filed my receipts?"          -- a fact about the SUBMITTER. Must
//   include what I put on someone else's card.
//
// One combined total would eventually mislead somebody about their balance.

export default function RlaDashboard() {
  const { user, assignedCard } = useAuth();
  const navigate = useNavigate();

  const [transactions, setTransactions] = useState([]);
  const [nextDeadline, setNextDeadline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all | mine | card

  useEffect(() => {
    // Scoped from the session server-side — there is no id in this URL for
    // anyone to change.
    apiClient
      .get("/transactions/mine")
      .then((res) => setTransactions(res.data.transactions))
      .catch((err) => console.error("Failed to load transactions:", err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    apiClient
      .get("/reconciliation-periods")
      .then((res) => {
        const now = new Date();
        setNextDeadline(
          res.data.periods.find((p) => new Date(p.endDate) >= now)
        );
      })
      .catch((err) => console.error("Failed to load periods:", err));
  }, []);

  // Card spend counts everything charged to the card, whoever submitted it.
  const cardSpend = useMemo(
    () =>
      transactions
        .filter((t) => t.onMyCard && t.isActive !== false)
        .reduce((sum, t) => sum + Number(t.amountAed || 0), 0),
    [transactions]
  );

  const visible = useMemo(() => {
    if (filter === "mine") return transactions.filter((t) => t.submittedByMe);
    if (filter === "card") return transactions.filter((t) => t.onMyCard);
    return transactions;
  }, [transactions, filter]);

  // How many rows are NOT the ordinary "I submitted this on my own card" case.
  const borrowedCount = transactions.filter(
    (t) => !t.submittedByMe || !t.onMyCard
  ).length;

  const statusBadge = (status) => {
    const styles = {
      submitted: "bg-mbzuai-navy/10 text-mbzuai-navy",
      flagged: "bg-amber-100 text-amber-700",
      reviewed: "bg-green-100 text-green-700",
      packaged: "bg-blue-100 text-blue-700",
    };
    return styles[status] || "bg-gray-100 text-gray-600";
  };

  const remaining = Math.max(CARD_LIMIT_AED - cardSpend, 0);
  const usedPct = Math.min((cardSpend / CARD_LIMIT_AED) * 100, 100);

  const filterTab = (key, label) => (
    <button
      key={key}
      type="button"
      onClick={() => setFilter(key)}
      className={`px-4 py-2 text-sm rounded-full transition-colors ${
        filter === key
          ? "bg-mbzuai-navy text-white"
          : "text-mbzuai-navy/70 hover:bg-mbzuai-navy/5"
      }`}
    >
      {label}
    </button>
  );

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-mbzuai-gold font-medium tracking-wide uppercase text-sm">
              Dashboard
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-mbzuai-navy">
              {user.fullName}
            </h1>
            {nextDeadline && (
              <p className="mt-2 text-mbzuai-navy/70">
                Next reconciliation deadline:{" "}
                <strong className="text-mbzuai-navy">
                  {new Date(nextDeadline.endDate).toLocaleDateString()}
                </strong>
              </p>
            )}
          </div>
          <Button onClick={() => navigate("/rla/submit")}>New Submission</Button>
        </div>

        {/* Card balance — strictly card-scoped. */}
        {assignedCard ? (
          <div className="mt-8 bg-white rounded-2xl border border-mbzuai-navy/10 p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="font-semibold text-mbzuai-navy">
                  Your card •••• {assignedCard.lastFourDigits}
                </h2>
                <p className="mt-1 text-sm text-mbzuai-navy/60">
                  Includes everything charged to this card, whoever submitted it.
                </p>
              </div>
              <p className="text-2xl font-semibold text-mbzuai-navy">
                AED{" "}
                {remaining.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}{" "}
                <span className="text-sm font-normal text-mbzuai-navy/60">
                  left of {CARD_LIMIT_AED.toLocaleString()}
                </span>
              </p>
            </div>

            <div className="mt-4 h-3 w-full rounded-full bg-mbzuai-navy/10 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  usedPct > 90
                    ? "bg-red-500"
                    : usedPct > 70
                      ? "bg-amber-500"
                      : "bg-mbzuai-gold"
                }`}
                style={{ width: `${usedPct}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-mbzuai-navy/60">
              AED{" "}
              {cardSpend.toLocaleString(undefined, { minimumFractionDigits: 2 })}{" "}
              spent
            </p>
          </div>
        ) : (
          <div className="mt-8 bg-white rounded-2xl border border-mbzuai-navy/10 p-6">
            <h2 className="font-semibold text-mbzuai-navy">
              No card assigned to you
            </h2>
            <p className="mt-1 text-sm text-mbzuai-navy/60">
              You can still submit expenses on any card — ask a manager if you
              should have one of your own.
            </p>
          </div>
        )}

        <div className="mt-8 bg-white rounded-2xl border border-mbzuai-navy/10 overflow-hidden">
          <div className="px-6 py-4 border-b border-mbzuai-navy/10 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold text-mbzuai-navy">Transactions</h2>
            {/* Only worth offering the split when the two sets actually differ
                — otherwise it is three tabs showing one identical list. */}
            {borrowedCount > 0 && (
              <div className="flex gap-1">
                {filterTab("all", "All")}
                {filterTab("mine", "Submitted by me")}
                {filterTab("card", "On my card")}
              </div>
            )}
          </div>

          {loading ? (
            <p className="px-6 py-10 text-center text-mbzuai-navy/50">Loading…</p>
          ) : visible.length === 0 ? (
            <p className="px-6 py-10 text-center text-mbzuai-navy/50">
              No submissions yet. Click “New Submission” to add your first.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-mbzuai-navy/50 bg-mbzuai-sand/50">
                    <th className="px-6 py-3 font-medium">Ref</th>
                    <th className="px-6 py-3 font-medium">Date</th>
                    <th className="px-6 py-3 font-medium">Vendor</th>
                    <th className="px-6 py-3 font-medium">Amount (AED)</th>
                    <th className="px-6 py-3 font-medium">Card</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((t) => (
                    <tr
                      key={t.transactionId}
                      className="border-t border-mbzuai-navy/5 hover:bg-mbzuai-sand/30 transition-colors"
                    >
                      <td className="px-6 py-4 text-mbzuai-navy/70">
                        #{t.transactionId}
                      </td>
                      <td className="px-6 py-4 text-mbzuai-navy/70">
                        {new Date(t.purchaseDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 font-medium text-mbzuai-navy">
                        {t.vendorName}
                        {/* The unusual cases announce themselves rather than
                            hiding silently in the list. */}
                        {!t.submittedByMe && (
                          <span className="block text-xs font-normal text-mbzuai-navy/50">
                            submitted by {t.submittedByName}
                          </span>
                        )}
                        {t.submittedByMe && !t.onMyCard && (
                          <span className="block text-xs font-normal text-mbzuai-navy/50">
                            you submitted this on someone else’s card
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-mbzuai-navy/70">
                        {t.amountAed}
                      </td>
                      <td className="px-6 py-4 text-mbzuai-navy/70">
                        {t.lastFourDigits ? `•••• ${t.lastFourDigits}` : "—"}
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
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
