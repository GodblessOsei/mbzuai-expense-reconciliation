import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import ManagerLayout from "../../components/ManagerLayout";
import apiClient from "../../api/client";

const COLORS = ["#1B3A6B", "#C9A84C", "#4A7FC1", "#E8B84B", "#2D5A9E", "#F0CC6E"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const formatAed = (value) => `AED ${Number(value).toLocaleString()}`;

const ChartCard = ({ title, children }) => (
  <div className="bg-white rounded-2xl border border-mbzuai-navy/10 p-5 shadow-sm">
    <h3 className="text-sm font-semibold text-mbzuai-navy/70 uppercase tracking-wide mb-4">
      {title}
    </h3>
    {children}
  </div>
);

const EmptyState = () => (
  <div className="flex items-center justify-center h-48 text-sm text-mbzuai-navy/40">
    No data for this period
  </div>
);

const Loading = () => (
  <div className="flex items-center justify-center h-64 text-sm text-mbzuai-navy/40">
    Loading…
  </div>
);

const SummaryCard = ({ label, value }) => (
  <div className="rounded-2xl border border-mbzuai-navy/10 bg-white p-6">
    <p className="text-sm text-mbzuai-navy/50">{label}</p>
    <p className="mt-2 text-3xl font-semibold text-mbzuai-navy">{value}</p>
  </div>
);

const TABS = [
  { id: "yearly",  label: "Yearly Summary" },
  { id: "monthly", label: "Monthly Summary" },
];

export default function ManagerDashboard() {
  const currentYear = new Date().getFullYear();
  const [tab, setTab] = useState("yearly");
  const [year, setYear] = useState(currentYear);
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <ManagerLayout>
      {/* header row */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-mbzuai-navy">Budget Dashboard</h1>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="rounded-lg border border-mbzuai-navy/20 px-3 py-1.5 text-sm text-mbzuai-navy focus:border-mbzuai-gold focus:outline-none"
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* tabs */}
      <div className="flex gap-2 border-b border-mbzuai-navy/10 mb-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? "border-mbzuai-gold text-mbzuai-navy"
                : "border-transparent text-mbzuai-navy/50 hover:text-mbzuai-navy"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "yearly" ? <YearlySummary year={year} /> : <MonthlySummary year={year} />}
    </ManagerLayout>
  );
}

function YearlySummary({ year }) {
  const [budget, setBudget] = useState(null);
  const [monthlyBudgets, setMonthlyBudgets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [budgetRes, monthlyRes] = await Promise.allSettled([
          apiClient.get(`/budgets/${year}`),
          apiClient.get(`/budgets/${year}/monthly`),
        ]);
        if (cancelled) return;
        setBudget(budgetRes.status === "fulfilled" ? budgetRes.value.data.budget : null);
        setMonthlyBudgets(monthlyRes.status === "fulfilled" ? monthlyRes.value.data.months : []);
      } catch (err) {
        console.error("Yearly dashboard fetch error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchAll();
    return () => { cancelled = true; };
  }, [year]);

  if (loading) return <Loading />;

  const monthlyChartData = monthlyBudgets.map((m) => ({
    name: MONTH_NAMES[m.month - 1].slice(0, 3),
    planned: m.plannedAmount,
    actual: m.actualAmount,
  }));

  return (
    <>
      {budget && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <SummaryCard label="Annual Budget"      value={formatAed(budget.plannedAmount)} />
          <SummaryCard label="Annual Expenditure" value={formatAed(budget.actualAmount)} />
          <SummaryCard label="Annual Remaining"   value={formatAed(budget.remainingAmount)} />
          <SummaryCard label="Budget Used"        value={`${budget.percentageSpent}%`} />
        </div>
      )}

      <div className="mb-6">
        <ChartCard title="Planned vs Actual by Month">
          {monthlyChartData.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyChartData} margin={{ top: 10, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => Number(v).toLocaleString()} tick={{ fontSize: 11 }} width={50} />
                <Tooltip formatter={(v) => formatAed(v)} />
                <Legend />
                <Bar dataKey="planned" name="Planned" fill="#4A7FC1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="actual"  name="Actual"  fill="#1B3A6B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <SpendingBreakdown year={year} />
    </>
  );
}

function MonthlySummary({ year }) {
  const [months, setMonths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSelectedMonth(null);
    apiClient
      .get(`/budgets/${year}/monthly`)
      .then((res) => {
        if (!cancelled) setMonths(res.data.months || []);
      })
      .catch((err) => {
        console.error("Monthly budgets fetch error:", err);
        if (!cancelled) setMonths([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [year]);

  if (loading) return <Loading />;
  if (months.length === 0) return <EmptyState />;

  const now = new Date();
  const currentMonth = now.getFullYear() === year ? now.getMonth() + 1 : null;
  const selected = months.find((m) => m.month === selectedMonth);

  return (
    <>
      <div className="rounded-2xl border border-mbzuai-navy/10 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-mbzuai-navy/50 border-b border-mbzuai-navy/10">
              <th className="px-6 py-3 font-medium">Month</th>
              <th className="px-6 py-3 font-medium">Planned</th>
              <th className="px-6 py-3 font-medium">Actual</th>
              <th className="px-6 py-3 font-medium">Variance</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => {
              const hasBudget = m.monthlyBudgetId != null;
              const isSelected = m.month === selectedMonth;
              return (
                <tr
                  key={m.month}
                  onClick={() => setSelectedMonth(isSelected ? null : m.month)}
                  className={`cursor-pointer border-b border-mbzuai-navy/5 last:border-0 border-l-4 ${
                    isSelected
                      ? "bg-mbzuai-gold/20 border-l-mbzuai-gold"
                      : m.month === currentMonth
                      ? "bg-mbzuai-gold/10 border-l-transparent hover:bg-mbzuai-navy/5"
                      : "border-l-transparent hover:bg-mbzuai-navy/5"
                  }`}
                >
                  <td className="px-6 py-3 font-medium text-mbzuai-navy">
                    {MONTH_NAMES[m.month - 1]}
                  </td>
                  <td className="px-6 py-3 text-mbzuai-navy">
                    {hasBudget ? formatAed(m.plannedAmount) : (
                      <span className="italic text-mbzuai-navy/40">No budget set</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-mbzuai-navy">{formatAed(m.actualAmount)}</td>
                  <td className={`px-6 py-3 ${hasBudget && m.variance < 0 ? "text-red-600" : "text-mbzuai-navy"}`}>
                    {hasBudget ? formatAed(m.variance) : <span className="text-mbzuai-navy/40">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold text-mbzuai-navy mb-4">
            Breakdown for {MONTH_NAMES[selected.month - 1]} {year}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <SummaryCard label="Monthly Planned"  value={selected.monthlyBudgetId != null ? formatAed(selected.plannedAmount) : "No budget set"} />
            <SummaryCard label="Monthly Actual"   value={formatAed(selected.actualAmount)} />
            <SummaryCard label="Monthly Variance" value={selected.monthlyBudgetId != null ? formatAed(selected.variance) : "—"} />
          </div>

          <SpendingBreakdown year={year} month={selected.month} />
        </div>
      )}
    </>
  );
}

function SpendingBreakdown({ year, month }) {
  const [data, setData] = useState({
    byCategory: [],
    byCardholder: [],
    byBudgetItem: [],
    byDepartment: [],
    byVendor: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const params = `year=${year}${month ? `&month=${month}` : ""}`;
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [cat, holder, item, dept, vendor] = await Promise.allSettled([
          apiClient.get(`/dashboard/spending-by-category?${params}`),
          apiClient.get(`/dashboard/spending-by-cardholder?${params}`),
          apiClient.get(`/dashboard/spending-by-budget-item?${params}`),
          apiClient.get(`/dashboard/spending-by-department?${params}`),
          apiClient.get(`/dashboard/spending-by-vendor?${params}`),
        ]);
        if (cancelled) return;
        setData({
          byCategory:   cat.status === "fulfilled"    ? cat.value.data.data    : [],
          byCardholder: holder.status === "fulfilled" ? holder.value.data.data : [],
          byBudgetItem: item.status === "fulfilled"   ? item.value.data.data   : [],
          byDepartment: dept.status === "fulfilled"   ? dept.value.data.data   : [],
          byVendor:     (vendor.status === "fulfilled" ? vendor.value.data.data : []).slice(0, 5),
        });
      } catch (err) {
        console.error("Spending breakdown fetch error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchAll();
    return () => { cancelled = true; };
  }, [year, month]);

  if (loading) return <Loading />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

      {/* Spending by Category — Pie */}
      <ChartCard title="Spending by Category">
        {data.byCategory.length === 0 ? <EmptyState /> : (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={data.byCategory}
                dataKey="totalAed"
                nameKey="name"
                cx="50%"
                cy="45%"
                outerRadius={95}
              >
                {data.byCategory.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => formatAed(v)} />
              <Legend verticalAlign="bottom" height={36} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Spending by Cardholder — Bar */}
      <ChartCard title="Spending by Cardholder">
        {data.byCardholder.length === 0 ? <EmptyState /> : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.byCardholder} margin={{ top: 10, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => Number(v).toLocaleString()} tick={{ fontSize: 11 }} width={50} />
              <Tooltip formatter={(v) => formatAed(v)} />
              <Bar dataKey="totalAed" name="Total Spent" fill="#1B3A6B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Spending by Purchase For — Bar */}
      <div className="lg:col-span-2">
        <ChartCard title="Spending by Purchase For">
          {data.byBudgetItem.every((d) => d.totalAed === 0) ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={Math.max(300, data.byBudgetItem.length * 36)}>
              <BarChart data={data.byBudgetItem} layout="vertical" margin={{ top: 4, right: 20, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis type="number" tickFormatter={(v) => `AED ${v}`} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={260} />
                <Tooltip formatter={(v) => formatAed(v)} />
                <Bar dataKey="totalAed" name="Total Spent" fill="#C9A84C" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Spending by Department — Bar */}
      <ChartCard title="Spending by Department">
        {data.byDepartment.length === 0 ? <EmptyState /> : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.byDepartment} margin={{ top: 10, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => Number(v).toLocaleString()} tick={{ fontSize: 11 }} width={50} />
              <Tooltip formatter={(v) => formatAed(v)} />
              <Bar dataKey="totalAed" name="Total Spent" fill="#4A7FC1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Top 5 Vendors — Bar */}
      <div className="lg:col-span-2">
        <ChartCard title="Top 5 Vendors">
          {data.byVendor.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.byVendor} layout="vertical" margin={{ top: 4, right: 20, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis type="number" tickFormatter={(v) => `AED ${v}`} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={260} />
                <Tooltip formatter={(v) => formatAed(v)} />
                <Bar dataKey="totalAed" name="Total Spent" fill="#2D5A9E" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

    </div>
  );
}
