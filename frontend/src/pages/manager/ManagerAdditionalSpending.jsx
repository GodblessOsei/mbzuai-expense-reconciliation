import { useState, useEffect } from "react";
import apiClient from "../../api/client";
import ManagerLayout from "../../components/ManagerLayout";

const CATEGORY_OPTIONS = [
  "Event supplies", "Food and catering", "Stationery", "Equipment",
  "Subscription", "Per diem expense", "Other",
];
const DEPARTMENT_OPTIONS = ["Residential Life", "Student Life", "Other department"];
const PAYMENT_METHOD_OPTIONS = [
  "RLA prepaid card", "Department card", "ResLife account",
  "Personal payment awaiting reimbursement", "Other",
];

const todayDate = () => new Date().toISOString().split("T")[0];

const emptyForm = {
  date: todayDate(),
  vendor_name: "",
  budget_item_id: "",
  department: "Residential Life",
  customDepartment: "",
  category: "",
  customCategory: "",
  amount_aed: "",
  payment_method: "RLA prepaid card",
  reference_number: "",
  notes: "",
};

const inputClass =
  "w-full rounded-lg border border-mbzuai-navy/20 px-3 py-2 text-sm text-mbzuai-navy";
const labelClass = "block text-xs text-mbzuai-navy/50 mb-1";

export default function ManagerAdditionalSpending() {
  const [entries, setEntries] = useState([]);
  const [budgetItems, setBudgetItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadEntries = () => {
    setLoading(true);
    apiClient
      .get("/additional-spending")
      .then((res) => setEntries(res.data.entries || []))
      .catch((err) => console.error("Failed to load additional spending:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadEntries();
    apiClient
      .get("/budget-items")
      .then((res) => setBudgetItems(res.data.budgetItems || []))
      .catch((err) => console.error("Failed to load budget items:", err));
  }, []);

  const openForm = () => {
    setForm(emptyForm);
    setError("");
    setShowForm(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const department = form.department === "Other department" ? form.customDepartment.trim() : form.department;
    const category = form.category === "Other" ? form.customCategory.trim() : form.category;

    if (!form.date || !form.vendor_name || !form.budget_item_id || !department || !category || !form.amount_aed || !form.payment_method) {
      setError("Please fill in all required fields.");
      return;
    }

    setSaving(true);
    try {
      await apiClient.post("/additional-spending", {
        budget_item_id: Number(form.budget_item_id),
        date: form.date,
        vendor_name: form.vendor_name,
        department,
        category,
        amount_aed: Number(form.amount_aed),
        payment_method: form.payment_method,
        reference_number: form.reference_number || null,
        notes: form.notes || null,
      });
      setShowForm(false);
      loadEntries();
    } catch (err) {
      console.error("Failed to save additional spending:", err);
      setError(err.response?.data?.message || "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ManagerLayout>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-mbzuai-gold font-medium tracking-wide uppercase text-sm">Manager</p>
          <h1 className="mt-2 text-3xl font-semibold text-mbzuai-navy">Additional Spending</h1>
          <p className="mt-1 text-sm text-mbzuai-navy/50">
            Spending recorded outside the RLA prepaid card workflow.
          </p>
        </div>
        <button
          onClick={openForm}
          className="px-5 py-2.5 rounded-lg bg-mbzuai-navy text-white text-sm font-medium hover:bg-mbzuai-navy/80"
        >
          Add Additional Spending
        </button>
      </div>

      <div className="mt-6 bg-white rounded-2xl border border-mbzuai-navy/10 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-mbzuai-navy/50 bg-mbzuai-sand/50">
              <th className="px-5 py-3 font-medium">Date</th>
              <th className="px-5 py-3 font-medium">Vendor</th>
              <th className="px-5 py-3 font-medium">Purchase For</th>
              <th className="px-5 py-3 font-medium">Department</th>
              <th className="px-5 py-3 font-medium">Category</th>
              <th className="px-5 py-3 font-medium">Amount</th>
              <th className="px-5 py-3 font-medium">Payment Method</th>
              {/* The whole reason managers have individual logins rather than
                  one shared password: a disputed figure needs a name that was
                  proven at sign-in, not typed into a box. */}
              <th className="px-5 py-3 font-medium">Added by</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-mbzuai-navy/50">
                  Loading…
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-mbzuai-navy/50">
                  No additional spending yet. Click "Add Additional Spending" to record your first entry.
                </td>
              </tr>
            ) : (
              entries.map((e) => (
                <tr key={e.additionalSpendingId} className="border-t border-mbzuai-navy/5 hover:bg-mbzuai-sand/30 transition-colors">
                  <td className="px-5 py-4 text-mbzuai-navy/70">
                    {new Date(e.date).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-4 font-medium text-mbzuai-navy">{e.vendorName}</td>
                  <td className="px-5 py-4 text-mbzuai-navy/70">{e.budgetItemName || "—"}</td>
                  <td className="px-5 py-4 text-mbzuai-navy/70">{e.department}</td>
                  <td className="px-5 py-4 text-mbzuai-navy/70">{e.category}</td>
                  <td className="px-5 py-4 text-mbzuai-navy/70">AED {e.amountAed}</td>
                  <td className="px-5 py-4 text-mbzuai-navy/70">{e.paymentMethod}</td>
                  <td className="px-5 py-4 text-mbzuai-navy/70">
                    {/* Null for rows entered before logins existed — there is
                        genuinely no record, and inventing one would be worse. */}
                    {e.createdByName || (
                      <span className="text-mbzuai-navy/40 italic">unknown</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6"
          onClick={() => setShowForm(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-mbzuai-navy/10 flex items-start justify-between">
              <div>
                <p className="text-mbzuai-gold font-medium tracking-wide uppercase text-xs">New Entry</p>
                <h2 className="text-xl font-semibold text-mbzuai-navy mt-0.5">Add Additional Spending</h2>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="text-mbzuai-navy/40 hover:text-mbzuai-navy text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Date</label>
                  <input
                    type="date"
                    name="date"
                    value={form.date}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Amount (AED)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    name="amount_aed"
                    value={form.amount_aed}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Vendor</label>
                  <input
                    name="vendor_name"
                    value={form.vendor_name}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Payment Method</label>
                  <select name="payment_method" value={form.payment_method} onChange={handleChange} className={inputClass}>
                    {PAYMENT_METHOD_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Category</label>
                  <select name="category" value={form.category} onChange={handleChange} className={inputClass}>
                    <option value="">-- Select category --</option>
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Purchase For</label>
                  <select name="budget_item_id" value={form.budget_item_id} onChange={handleChange} className={inputClass}>
                    <option value="">Select purchase purpose</option>
                    {budgetItems.map((item) => (
                      <option key={item.budget_item_id} value={item.budget_item_id}>{item.item_name}</option>
                    ))}
                  </select>
                </div>

                {form.category === "Other" && (
                  <div>
                    <label className={labelClass}>Describe Category</label>
                    <input
                      name="customCategory"
                      value={form.customCategory}
                      onChange={handleChange}
                      className={inputClass}
                    />
                  </div>
                )}

                <div>
                  <label className={labelClass}>Department</label>
                  <select name="department" value={form.department} onChange={handleChange} className={inputClass}>
                    {DEPARTMENT_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                {form.department === "Other department" && (
                  <div>
                    <label className={labelClass}>Specify Department</label>
                    <input
                      name="customDepartment"
                      value={form.customDepartment}
                      onChange={handleChange}
                      className={inputClass}
                    />
                  </div>
                )}

                <div>
                  <label className={labelClass}>Reference Number (optional)</label>
                  <input
                    name="reference_number"
                    value={form.reference_number}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>

                <div className="col-span-2">
                  <label className={labelClass}>Notes (optional)</label>
                  <textarea
                    name="notes"
                    value={form.notes}
                    onChange={handleChange}
                    rows={3}
                    className={inputClass}
                  />
                </div>
              </div>

              {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 rounded-lg border border-mbzuai-navy/20 text-mbzuai-navy text-sm font-medium hover:bg-mbzuai-sand/50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-mbzuai-navy text-white text-sm font-medium hover:bg-mbzuai-navy/80 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ManagerLayout>
  );
}
