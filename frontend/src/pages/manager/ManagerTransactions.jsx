// frontend/src/pages/manager/ManagerTransactions.jsx
import { useState, useEffect } from "react";
import apiClient from "../../api/client";
import ManagerLayout from "../../components/ManagerLayout";

export default function ManagerTransactions() {
  const [transactions, setTransactions] = useState([]);
  const [cardholders, setCardholders] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [cardholderFilter, setCardholderFilter] = useState("");
  const [periodFilter, setPeriodFilter] = useState("");
  const [generatingId, setGeneratingId] = useState(null);

  // load everything once
  useEffect(() => {
    apiClient
      .get("/transactions")
      .then((res) => setTransactions(res.data.transactions));
    apiClient
      .get("/cardholders")
      .then((res) => setCardholders(res.data.cardholders));
    apiClient
      .get("/reconciliation-periods")
      .then((res) => setPeriods(res.data.periods));
  }, []);

  // apply filters in the browser (client-side filtering)
  const filtered = transactions.filter((t) => {
    const matchCardholder =
      !cardholderFilter || String(t.cardholder_id) === cardholderFilter;
    const matchPeriod =
      !periodFilter || String(t.reconciliation_period_id) === periodFilter;
    return matchCardholder && matchPeriod;
  });

  const handleGenerate = async (id) => {
    setGeneratingId(id);
    try {
      const res = await apiClient.post(`/transactions/${id}/generate-pdf`);
      // update that transaction's pdf_path in state so the row switches to View/Download
      setTransactions((prev) =>
        prev.map((t) =>
          t.transaction_id === id ? { ...t, pdf_path: res.data.pdf_path } : t
        )
      );
    } catch (err) {
      console.error("Generate failed:", err.message);
    } finally {
      setGeneratingId(null);
    }
  };

  const statusBadge = (status) => {
    const styles = {
      submitted: "bg-mbzuai-navy/10 text-mbzuai-navy",
      flagged: "bg-amber-100 text-amber-700",
      reviewed: "bg-green-100 text-green-700",
      packaged: "bg-blue-100 text-blue-700",
    };
    return styles[status] || "bg-gray-100 text-gray-600";
  };

  const selectClass =
    "rounded-lg border border-mbzuai-navy/20 px-3 py-2 text-sm text-mbzuai-navy focus:border-mbzuai-gold focus:outline-none";

  return (
    <ManagerLayout>
      <p className="text-mbzuai-gold font-medium tracking-wide uppercase text-sm">
        Manager
      </p>
      <h1 className="mt-2 text-3xl font-semibold text-mbzuai-navy">
        Transactions
      </h1>

      {/* filters */}
      <div className="mt-6 flex flex-wrap gap-3">
        <select
          value={cardholderFilter}
          onChange={(e) => setCardholderFilter(e.target.value)}
          className={selectClass}
        >
          <option value="">All cardholders</option>
          {cardholders.map((c) => (
            <option key={c.cardholder_id} value={c.cardholder_id}>
              {c.cardholder_name}
            </option>
          ))}
        </select>

        <select
          value={periodFilter}
          onChange={(e) => setPeriodFilter(e.target.value)}
          className={selectClass}
        >
          <option value="">All periods</option>
          {periods.map((p) => (
            <option
              key={p.reconciliation_period_id}
              value={p.reconciliation_period_id}
            >
              {new Date(p.start_date).toLocaleDateString()} –{" "}
              {new Date(p.end_date).toLocaleDateString()}
            </option>
          ))}
        </select>
      </div>

      {/* table */}
      <div className="mt-6 bg-white rounded-2xl border border-mbzuai-navy/10 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-mbzuai-navy/50 bg-mbzuai-sand/50">
              <th className="px-5 py-3 font-medium">Ref</th>
              <th className="px-5 py-3 font-medium">Cardholder</th>
              <th className="px-5 py-3 font-medium">Vendor</th>
              <th className="px-5 py-3 font-medium">Amount</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Receipt PDF</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-5 py-10 text-center text-mbzuai-navy/50"
                >
                  No transactions match these filters.
                </td>
              </tr>
            ) : (
              filtered.map((t) => (
                <tr
                  key={t.transaction_id}
                  className="border-t border-mbzuai-navy/5 hover:bg-mbzuai-sand/30 transition-colors"
                >
                  <td className="px-5 py-4 text-mbzuai-navy/70">
                    #{t.transaction_id}
                  </td>
                  <td className="px-5 py-4 font-medium text-mbzuai-navy">
                    {t.cardholder_name}
                  </td>
                  <td className="px-5 py-4 text-mbzuai-navy/70">
                    {t.vendor_name}
                  </td>
                  <td className="px-5 py-4 text-mbzuai-navy/70">
                    AED {t.amount_aed}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${statusBadge(
                        t.status
                      )}`}
                    >
                      {t.status}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {t.pdf_path ? (
                      <div className="flex gap-3 text-sm">
                        <a
                          href={`http://localhost:5050/api/transactions/${t.transaction_id}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-mbzuai-navy underline hover:text-mbzuai-gold"
                        >
                          View
                        </a>
                        <a
                          href={`http://localhost:5050/api/transactions/${t.transaction_id}/pdf?download=true`}
                          className="text-mbzuai-navy underline hover:text-mbzuai-gold"
                        >
                          Download
                        </a>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleGenerate(t.transaction_id)}
                        disabled={generatingId === t.transaction_id}
                        className="text-sm text-mbzuai-navy underline hover:text-mbzuai-gold disabled:opacity-50"
                      >
                        {generatingId === t.transaction_id
                          ? "Generating…"
                          : "Generate PDF"}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </ManagerLayout>
  );
}
