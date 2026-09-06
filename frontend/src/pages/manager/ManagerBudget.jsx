import { useState, useEffect } from "react";
import apiClient from "../../api/client";
import ManagerLayout from "../../components/ManagerLayout";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const formatAed = (value) => `AED ${Number(value).toLocaleString()}`;

const selectClass =
  "w-full rounded-lg border border-mbzuai-navy/20 px-3 py-2.5 text-sm text-mbzuai-navy focus:border-mbzuai-gold focus:outline-none bg-white";
const inputClass =
  "w-full rounded-lg border border-mbzuai-navy/20 px-3 py-2.5 text-sm text-mbzuai-navy focus:border-mbzuai-gold focus:outline-none";
const saveButtonClass =
  "px-5 py-2.5 rounded-lg bg-mbzuai-navy text-white text-sm font-medium hover:bg-mbzuai-navy/80 disabled:opacity-50";

export default function ManagerBudget() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

  const [annualBudget, setAnnualBudget] = useState(null);
  const [annualInput, setAnnualInput] = useState("");
  const [annualSaving, setAnnualSaving] = useState(false);
  const [annualMessage, setAnnualMessage] = useState("");

  const [monthlyBudgets, setMonthlyBudgets] = useState([]);
  const [monthInput, setMonthInput] = useState(1);
  const [monthlyAmountInput, setMonthlyAmountInput] = useState("");
  const [monthlySaving, setMonthlySaving] = useState(false);
  const [monthlyMessage, setMonthlyMessage] = useState("");

  const loadAnnual = () => {
    apiClient
      .get(`/budgets/${year}`)
      .then((res) => {
        setAnnualBudget(res.data.budget);
        setAnnualInput(String(res.data.budget.plannedAmount));
      })
      .catch(() => {
        setAnnualBudget(null);
        setAnnualInput("");
      });
  };

  const loadMonthly = () => {
    apiClient
      .get(`/budgets/${year}/monthly`)
      .then((res) => setMonthlyBudgets((res.data.months || []).filter((m) => m.monthlyBudgetId != null)))
      .catch(() => setMonthlyBudgets([]));
  };

  useEffect(() => {
    loadAnnual();
    loadMonthly();
    setAnnualMessage("");
    setMonthlyMessage("");
  }, [year]);

  const saveAnnual = async (e) => {
    e.preventDefault();
    if (!annualInput || Number(annualInput) <= 0) return;
    setAnnualSaving(true);
    setAnnualMessage("");
    try {
      await apiClient.post("/budgets", { year, plannedAmount: Number(annualInput) });
      setAnnualMessage("Annual budget saved.");
      loadAnnual();
    } catch (err) {
      console.error("Save annual budget error:", err);
      setAnnualMessage("Failed to save annual budget.");
    } finally {
      setAnnualSaving(false);
    }
  };

  const saveMonthly = async (e) => {
    e.preventDefault();
    if (!monthlyAmountInput || Number(monthlyAmountInput) <= 0) return;
    setMonthlySaving(true);
    setMonthlyMessage("");
    try {
      await apiClient.post(`/budgets/${year}/monthly`, {
        month: Number(monthInput),
        plannedAmount: Number(monthlyAmountInput),
      });
      setMonthlyMessage(`Budget for ${MONTH_NAMES[monthInput - 1]} saved.`);
      setMonthlyAmountInput("");
      loadMonthly();
    } catch (err) {
      console.error("Save monthly budget error:", err);
      setMonthlyMessage("Failed to save monthly budget.");
    } finally {
      setMonthlySaving(false);
    }
  };

  const editMonth = (m) => {
    setMonthInput(m.month);
    setMonthlyAmountInput(String(m.plannedAmount));
    setMonthlyMessage("");
  };

  return (
    <ManagerLayout>
      <p className="text-mbzuai-gold font-medium tracking-wide uppercase text-sm">Manager</p>
      <h1 className="mt-2 text-3xl font-semibold text-mbzuai-navy">Set Budget</h1>
      <p className="mt-1 text-sm text-mbzuai-navy/50">
        Set or edit the annual and monthly spending targets shown on the Budget Dashboard.
      </p>

      {/* year selector */}
      <div className="mt-6 max-w-xs">
        <label className="block text-xs font-medium text-mbzuai-navy/60 mb-1.5 uppercase tracking-wide">
          Year
        </label>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={selectClass}>
          {yearOptions.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Annual budget */}
      <div className="mt-8 max-w-md rounded-2xl border border-mbzuai-navy/10 bg-white p-6">
        <h2 className="text-base font-semibold text-mbzuai-navy mb-1">Annual Budget — {year}</h2>
        <p className="text-sm text-mbzuai-navy/50 mb-4">
          {annualBudget
            ? `Currently ${formatAed(annualBudget.plannedAmount)}`
            : "No annual budget set for this year."}
        </p>
        <form onSubmit={saveAnnual} className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-mbzuai-navy/60 mb-1.5 uppercase tracking-wide">
              Planned Amount (AED)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={annualInput}
              onChange={(e) => setAnnualInput(e.target.value)}
              className={inputClass}
              placeholder="e.g. 100000"
            />
          </div>
          <button type="submit" disabled={annualSaving} className={saveButtonClass}>
            {annualSaving ? "Saving…" : "Save"}
          </button>
        </form>
        {annualMessage && <p className="mt-3 text-sm text-mbzuai-navy/70">{annualMessage}</p>}
      </div>

      {/* Monthly budget */}
      <div className="mt-8 max-w-2xl rounded-2xl border border-mbzuai-navy/10 bg-white p-6">
        <h2 className="text-base font-semibold text-mbzuai-navy mb-1">Monthly Budget — {year}</h2>
        <p className="text-sm text-mbzuai-navy/50 mb-4">Set a planned spend target for a specific month.</p>
        <form onSubmit={saveMonthly} className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-xs font-medium text-mbzuai-navy/60 mb-1.5 uppercase tracking-wide">
              Month
            </label>
            <select
              value={monthInput}
              onChange={(e) => setMonthInput(Number(e.target.value))}
              className={selectClass}
            >
              {MONTH_NAMES.map((name, i) => (
                <option key={name} value={i + 1}>{name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium text-mbzuai-navy/60 mb-1.5 uppercase tracking-wide">
              Planned Amount (AED)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={monthlyAmountInput}
              onChange={(e) => setMonthlyAmountInput(e.target.value)}
              className={inputClass}
              placeholder="e.g. 8000"
            />
          </div>
          <button type="submit" disabled={monthlySaving} className={saveButtonClass}>
            {monthlySaving ? "Saving…" : "Save"}
          </button>
        </form>
        {monthlyMessage && <p className="mt-3 text-sm text-mbzuai-navy/70">{monthlyMessage}</p>}

        {monthlyBudgets.length > 0 && (
          <div className="mt-6 border-t border-mbzuai-navy/10 pt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-mbzuai-navy/50">
                  <th className="py-2 font-medium">Month</th>
                  <th className="py-2 font-medium">Planned</th>
                  <th className="py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {monthlyBudgets.map((m) => (
                  <tr key={m.month} className="border-t border-mbzuai-navy/5">
                    <td className="py-2 text-mbzuai-navy font-medium">{MONTH_NAMES[m.month - 1]}</td>
                    <td className="py-2 text-mbzuai-navy">{formatAed(m.plannedAmount)}</td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => editMonth(m)}
                        className="text-xs text-mbzuai-gold font-medium hover:underline"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ManagerLayout>
  );
}
