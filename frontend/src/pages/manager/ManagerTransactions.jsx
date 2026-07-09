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
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const isDeleted = selectedTransaction?.status === "deleted" || selectedTransaction?.is_active === false;
  const [modalFlags, setModalFlags] = useState([]);
  const [editFields, setEditFields] = useState({});
  const [saving, setSaving] = useState(false);
  const [resolvingFlagId, setResolvingFlagId] = useState(null);
  const [markingReviewed, setMarkingReviewed] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [showAuditLogs, setShowAuditLogs] = useState(false);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);
  const [budgetItems, setBudgetItems] = useState([])
  const inputClass =
  "w-full rounded-lg border border-mbzuai-navy/20 px-3 py-2 text-sm text-mbzuai-navy";

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
    apiClient
      .get("/budget-items")
      .then((res) => setBudgetItems(res.data.budgetItems || []))
      .catch((err) => console.error("Failed to load budget items:", err));
  }, []);

  useEffect(() => {
    if (!selectedTransaction) {
      setModalFlags([]);
      setEditFields({});
      return;
    }
    const { vendor_name, purchase_date, invoice_number, category, budget_item_id, department, amount_aed, original_currency, payment_method, notes } = selectedTransaction;
    setEditFields({
      vendor_name: vendor_name ?? "",
      purchase_date: purchase_date ? purchase_date.split("T")[0] : "",
      invoice_number: invoice_number ?? "",
      category: category ?? "",
      budget_item_id: budget_item_id ?? "",
      department: department ?? "",
      amount_aed: amount_aed ?? "",
      original_currency: original_currency ?? "",
      payment_method: payment_method ?? "",
      notes: notes ?? "",
    });
    apiClient
      .get(`/transactions/${selectedTransaction.transaction_id}/flags`)
      .then((res) => setModalFlags(res.data.flags))
      .catch((err) => console.error("Failed to load flags:", err));
  }, [selectedTransaction]);

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

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiClient.patch(
        `/transactions/${selectedTransaction.transaction_id}`,
        editFields
      );
      const refreshed = await apiClient.get("/transactions");
      setTransactions(refreshed.data.transactions);

      setSelectedTransaction(null);
      setEditFields({});
      
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  };

  const hasChanges =
  selectedTransaction &&
  Object.keys(editFields).some((key) => {
    const original =
      key === "purchase_date"
        ? (selectedTransaction.purchase_date?.split("T")[0] ?? "")
        : (selectedTransaction[key] ?? "");

    return String(editFields[key] ?? "") !== String(original);
  });

  const handleResolveFlag = async (flagId) => {
    setResolvingFlagId(flagId);
    try {
      const res = await apiClient.patch(`/flags/${flagId}/resolve`);
      setModalFlags((prev) =>
        prev.map((f) => (f.flag_id === flagId ? res.data.flag : f))
      );
    } catch (err) {
      console.error("Resolve flag failed:", err);
    } finally {
      setResolvingFlagId(null);
    }
  };

  const handleMarkReviewed = async () => {
    setMarkingReviewed(true);
    try {
      await apiClient.patch(
        `/transactions/${selectedTransaction.transaction_id}/status`,
        { status: "reviewed" }
      );
      setTransactions((prev) =>
        prev.map((t) =>
          t.transaction_id === selectedTransaction.transaction_id
            ? { ...t, status: "reviewed" }
            : t
        )
      );
      setSelectedTransaction(null);
    } catch (err) {
      console.error("Mark reviewed failed:", err);
    } finally {
      setMarkingReviewed(false);
    }
  };

  const handleDeleteTransaction = async () => {
    if (!selectedTransaction) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this transaction?"
    );

    if (!confirmed) return;

    try {
      const res = await apiClient.patch(
        `/transactions/${selectedTransaction.transaction_id}/delete`
      );

      const deletedTransaction = res.data.transaction;

      setTransactions((prev) =>
        prev.map((t) =>
          t.transaction_id === deletedTransaction.transaction_id
            ? deletedTransaction
            : t
        )
      );

      setSelectedTransaction(null);
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Failed to delete transaction.");
    }
  };

  const handleViewHistory = async () => {
    if (!selectedTransaction) return;

    if (showAuditLogs) {
      setShowAuditLogs(false);
      return;
    }

    try {
      setLoadingAuditLogs(true);

      const res = await apiClient.get(
        `/transactions/${selectedTransaction.transaction_id}/audit-logs`
      );

      setAuditLogs(res.data.audit_logs);
      setShowAuditLogs(true);
    } catch (err) {
      console.error("Failed to fetch audit logs:", err);
      alert("Failed to load edit history.");
    } finally {
      setLoadingAuditLogs(false);
    }
  };

  const statusBadge = (status) => {
    const styles = {
      submitted: "bg-mbzuai-navy/10 text-mbzuai-navy",
      flagged: "bg-amber-100 text-amber-700",
      reviewed: "bg-green-100 text-green-700",
      deleted: "bg-red-100 text-red-700",
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
              <th className="px-5 py-3 font-medium">Purchase For</th>
              <th className="px-5 py-3 font-medium">Amount</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Receipt PDF</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-5 py-10 text-center text-mbzuai-navy/50"
                >
                  No transactions match these filters.
                </td>
              </tr>
            ) : (
              filtered.map((t) => (
                <tr
                  key={t.transaction_id}
                  onClick={() => {
                    setAuditLogs([]);
                    setShowAuditLogs(false);
                    setSelectedTransaction(t);
                  }}
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
                    {t.budget_item_name || "—"}
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
                        onClick={(e) => { e.stopPropagation(); handleGenerate(t.transaction_id); }}
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
      {/* transaction detail modal */}
      {selectedTransaction && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6"
          onClick={() => setSelectedTransaction(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* modal header */}
            <div className="px-6 py-4 border-b border-mbzuai-navy/10 flex items-start justify-between">
              <div>
                <p className="text-mbzuai-gold font-medium tracking-wide uppercase text-xs">
                  Transaction #{selectedTransaction.transaction_id}
                </p>
                <h2 className="text-xl font-semibold text-mbzuai-navy mt-0.5">
                  {selectedTransaction.vendor_name}
                </h2>
                <p className="text-sm text-mbzuai-navy/50 mt-0.5">
                  {selectedTransaction.cardholder_name} &middot; submitted{" "}
                  {new Date(selectedTransaction.submission_date).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${statusBadge(selectedTransaction.status)}`}>
                  {selectedTransaction.status}
                </span>
                <button
                  onClick={() => setSelectedTransaction(null)}
                  className="text-mbzuai-navy/40 hover:text-mbzuai-navy text-lg leading-none"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* editable fields */}
            <div className="px-6 py-5">
              <h3 className="text-sm font-semibold text-mbzuai-navy/60 uppercase tracking-wide mb-3">
                Transaction Details
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Vendor", key: "vendor_name" },
                  { label: "Invoice #", key: "invoice_number" },
                  { label: "Purchase Date", key: "purchase_date", type: "date" },
                  { label: "Amount (AED)", key: "amount_aed", type: "number" },
                  { label: "Currency", key: "original_currency" },
                  { label: "Payment Method", key: "payment_method" },
                  { label: "Category", key: "category" },
                  { label: "Purchase For", key: "budget_item_id", type: "budgetItem"},
                  { label: "Department", key: "department" },
                ].map(({ label, key, type = "text" }) => (
                  <div key={key}>
                    <label className="block text-xs text-mbzuai-navy/50 mb-1">{label}</label>
                    {type === "budgetItem" ? (
                      <select 
                      value={editFields[key] || ""}
                      onChange={(e) => 
                        setEditFields((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                      disabled={isDeleted}
                      className={inputClass}
                      >
                        <option value="">Select purchase purpose</option>
                        {budgetItems.map((item) => (
                          <option key={item.budget_item_id} value={item.budget_item_id}>
                            {item.item_name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input 
                      type={type}
                      value={editFields[key] ?? ""}
                      onChange={(e) => 
                        setEditFields((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      } 
                      disabled={isDeleted}
                      className={inputClass}
                      />
                    )}
                  </div>
                ))}
                <div className="col-span-2">
                  <label className="block text-xs text-mbzuai-navy/50 mb-1">Notes</label>
                  <textarea
                    value={editFields.notes ?? ""}
                    onChange={(e) => setEditFields((prev) => ({ ...prev, notes: e.target.value }))}
                    disabled={isDeleted}
                    rows={2}
                    className="w-full rounded-lg border border-mbzuai-navy/20 px-3 py-2 text-sm text-mbzuai-navy focus:border-mbzuai-gold focus:outline-none resize-none"
                  />
                </div>
              </div>
            </div>

            {/* flags */}
            <div className="px-6 pb-5">
              <h3 className="text-sm font-semibold text-mbzuai-navy/60 uppercase tracking-wide mb-3">
                Flags
              </h3>
              {modalFlags.length === 0 ? (
                <p className="text-sm text-mbzuai-navy/40">No flags on this transaction.</p>
              ) : (
                <ul className="space-y-2">
                  {modalFlags.map((flag) => (
                    <li
                      key={flag.flag_id}
                      className="flex items-center justify-between rounded-lg border border-mbzuai-navy/10 px-4 py-2"
                    >
                      <div>
                        <span className="text-sm font-medium text-mbzuai-navy">
                          {flag.flag_type.replace(/_/g, " ")}
                        </span>
                        <span className={`ml-2 text-xs ${flag.resolved ? "text-green-600" : "text-amber-600"}`}>
                          {flag.resolved ? "resolved" : "unresolved"}
                        </span>
                      </div>
                      {!flag.resolved && (
                        <button
                          onClick={() => handleResolveFlag(flag.flag_id)}
                          disabled={resolvingFlagId === flag.flag_id}
                          className="text-xs text-mbzuai-navy underline hover:text-mbzuai-gold disabled:opacity-50"
                        >
                          {resolvingFlagId === flag.flag_id ? "Resolving…" : "Resolve"}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="px-6 pb-4">
              <button
                onClick={handleViewHistory}
                className="text-sm font-medium text-mbzuai-gold hover:underline"
              >
                {showAuditLogs ? "Hide Edit History" : "View Edit History"}
              </button>

              {showAuditLogs && (
                <div className="mt-4 space-y-3 rounded-lg border border-mbzuai-navy/10 p-4 bg-white">
                  {auditLogs.length === 0 ? (
                    <p className="text-sm text-mbzuai-navy/60">
                      No edit history yet.
                    </p>
                  ) : (
                    auditLogs.map((log) => (
                      <div
                        key={log.log_id}
                        className="border-b border-mbzuai-navy/10 pb-3 last:border-b-0"
                      >
                        <p className="font-medium text-sm">
                          {log.field_name}
                        </p>

                        <p className="text-sm text-mbzuai-navy/70">
                          {String(log.old_value ?? "—")} → {String(log.new_value ?? "—")}
                        </p>

                        <p className="text-xs text-mbzuai-navy/50">
                          {new Date(log.timestamp).toLocaleString()}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* footer actions */}
            <div className="px-6 py-4 border-t border-mbzuai-navy/10 flex justify-between items-center">
              <button
                onClick={handleDeleteTransaction}
                disabled={selectedTransaction.status === "deleted"}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                Delete Transaction
              </button>

              <button
                onClick={handleSave}
                disabled={!hasChanges || saving || isDeleted}
                className="px-4 py-2 rounded-lg bg-mbzuai-navy text-white text-sm font-medium hover:bg-mbzuai-navy/80 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleted
                  ? "Transaction Deleted"
                  : saving
                    ? "Saving..."
                    : "Save Changes"}
              </button>
              {selectedTransaction.status !== "reviewed" && !isDeleted &&(
                <button
                  onClick={handleMarkReviewed}
                  disabled={markingReviewed}
                  className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  {markingReviewed ? "Marking…" : "Mark as Reviewed"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </ManagerLayout>
  );
}
