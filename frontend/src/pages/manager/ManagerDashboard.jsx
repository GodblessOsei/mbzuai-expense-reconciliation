import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import ManagerLayout from "../../components/ManagerLayout";
import apiClient from "../../api/client";

const COLORS = ["#1B3A6B", "#C9A84C", "#4A7FC1", "#E8B84B", "#2D5A9E", "#F0CC6E"];

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

export default function ManagerDashboard() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [data, setData] = useState({
    byCategory: [],
    byCardholder: [],
    byDepartment: [],
    byVendor: [],
    byEvent: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [cat, holder, dept, vendor, event] = await Promise.all([
          apiClient.get(`/dashboard/spending-by-category?year=${year}`),
          apiClient.get(`/dashboard/spending-by-cardholder?year=${year}`),
          apiClient.get(`/dashboard/spending-by-department?year=${year}`),
          apiClient.get(`/dashboard/spending-by-vendor?year=${year}`),
          apiClient.get(`/dashboard/spending-by-event?year=${year}`),
        ]);
        setData({
          byCategory:    cat.data.data,
          byCardholder:  holder.data.data,
          byDepartment:  dept.data.data,
          byVendor:      vendor.data.data.slice(0, 5), // top 5 vendors
          byEvent:       event.data.data,
        });
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [year]);

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

      {loading ? (
        <div className="flex items-center justify-center h-64 text-sm text-mbzuai-navy/40">
          Loading…
        </div>
      ) : (
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
                <BarChart data={data.byCardholder} margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => `AED ${v}`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => formatAed(v)} />
                  <Bar dataKey="totalAed" name="Total Spent" fill="#1B3A6B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Spending by Event / Activity — Bar */}
          <ChartCard title="Spending by Event / Activity">
            {data.byEvent.every((d) => d.totalAed === 0) ? <EmptyState /> : (
              <ResponsiveContainer width="100%" height={Math.max(300, data.byEvent.length * 36)}>
                <BarChart data={data.byEvent} layout="vertical" margin={{ top: 4, right: 20, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis type="number" tickFormatter={(v) => `AED ${v}`} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={185} />
                  <Tooltip formatter={(v) => formatAed(v)} />
                  <Bar dataKey="totalAed" name="Total Spent" fill="#C9A84C" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Spending by Department — Bar */}
          <ChartCard title="Spending by Department">
            {data.byDepartment.length === 0 ? <EmptyState /> : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.byDepartment} margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => `AED ${v}`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => formatAed(v)} />
                  <Bar dataKey="totalAed" name="Total Spent" fill="#4A7FC1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Top 5 Vendors — Bar */}
          <ChartCard title="Top 5 Vendors">
            {data.byVendor.length === 0 ? <EmptyState /> : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.byVendor} layout="vertical" margin={{ top: 4, right: 20, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis type="number" tickFormatter={(v) => `AED ${v}`} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={140} />
                  <Tooltip formatter={(v) => formatAed(v)} />
                  <Bar dataKey="totalAed" name="Total Spent" fill="#2D5A9E" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

        </div>
      )}
    </ManagerLayout>
  );
}
