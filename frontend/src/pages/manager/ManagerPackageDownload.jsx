import { useState, useEffect } from "react";
import apiClient from "../../api/client";
import ManagerLayout from "../../components/ManagerLayout";

const fmt = (n) =>
  Number(n).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (v) =>
  v ? new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "–";

export default function ManagerPackageDownload() {
  const [cardholders, setCardholders] = useState([]);
  const [cardholderId, setCardholderId] = useState("");
  const [currentPeriod, setCurrentPeriod] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  // fetch cardholders + current period on mount
  useEffect(() => {
    apiClient.get("/cardholders").then((r) => setCardholders(r.data.cardholders));
    apiClient
      .get("/packages/current-period")
      .then((r) => setCurrentPeriod(r.data.period))
      .catch(() => setError("Could not determine current reconciliation period."));
  }, []);

  // auto-preview when cardholder is selected and we have the period
  useEffect(() => {
    if (!cardholderId || !currentPeriod?.reconciliationPeriodId) {
      setPreview(null);
      return;
    }
    setPreviewLoading(true);
    setDone(false);
    setError("");
    apiClient
      .get("/spreadsheets/preview", {
        params: {
          cardholder_id: cardholderId,
          reconciliation_period_id: currentPeriod.reconciliationPeriodId,
        },
      })
      .then((r) => setPreview(r.data.preview))
      .catch(() => setPreview(null))
      .finally(() => setPreviewLoading(false));
  }, [cardholderId, currentPeriod]);

  const handleDownload = async () => {
    setDownloading(true);
    setError("");
    try {
      const res = await fetch("http://localhost:5050/api/packages/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardholder_id: Number(cardholderId),
          reconciliation_period_id: currentPeriod.reconciliationPeriodId,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Download failed");
      }

      // trigger browser download
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const nameMatch = disposition.match(/filename="(.+)"/);
      const filename = nameMatch ? nameMatch[1] : "MBZUAI_Package.zip";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setDone(true);
    } catch (err) {
      setError(err.message || "Failed to generate package");
    } finally {
      setDownloading(false);
    }
  };

  const selected = cardholders.find((c) => String(c.cardholder_id) === cardholderId);

  const selectClass =
    "w-full rounded-lg border border-mbzuai-navy/20 px-3 py-2.5 text-sm text-mbzuai-navy focus:border-mbzuai-gold focus:outline-none bg-white";

  return (
    <ManagerLayout>
      <p className="text-mbzuai-gold font-medium tracking-wide uppercase text-sm">Manager</p>
      <h1 className="mt-2 text-3xl font-semibold text-mbzuai-navy">Download Package</h1>
      <p className="mt-1 text-sm text-mbzuai-navy/50">
        Generate and download a ZIP containing the reconciliation spreadsheet and all receipt files for the current period.
      </p>

      {/* current period banner */}
      {currentPeriod && (
        <div className="mt-6 inline-flex items-center gap-2 rounded-lg bg-mbzuai-navy/5 border border-mbzuai-navy/10 px-4 py-2.5">
          <span className="w-2 h-2 rounded-full bg-mbzuai-gold flex-shrink-0" />
          <span className="text-sm text-mbzuai-navy font-medium">
            Current period:&nbsp;
            <span className="font-semibold">
              {fmtDate(currentPeriod.startDate)} – {fmtDate(currentPeriod.endDate)}
            </span>
          </span>
        </div>
      )}

      {/* cardholder selector */}
      <div className="mt-6 max-w-xs">
        <label className="block text-xs font-medium text-mbzuai-navy/60 mb-1.5 uppercase tracking-wide">
          Cardholder
        </label>
        <select value={cardholderId} onChange={(e) => { setCardholderId(e.target.value); setDone(false); }} className={selectClass}>
          <option value="">Select cardholder…</option>
          {cardholders.map((c) => (
            <option key={c.cardholder_id} value={c.cardholder_id}>
              {c.cardholder_name} (#{c.last_four_digits})
            </option>
          ))}
        </select>
      </div>

      {previewLoading && (
        <p className="mt-6 text-sm text-mbzuai-navy/50 animate-pulse">Loading period summary…</p>
      )}

      {/* preview */}
      {preview && !done && (
        <div className="mt-8">
          <h2 className="text-base font-semibold text-mbzuai-navy mb-4">
            Package contents — {selected?.cardholder_name}
          </h2>

          {preview.totalCount === 0 ? (
            <div className="rounded-xl border border-mbzuai-navy/10 bg-white p-8 text-center text-mbzuai-navy/40 text-sm">
              No eligible transactions for this cardholder in the current period.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-2xl">
                {[
                  { label: "Total Transactions",     value: preview.totalCount },
                  { label: "Eligible (Replenishment)", value: `AED ${fmt(preview.eligibleReplenishment)}`, gold: true },
                  { label: "Total Spend",             value: `AED ${fmt(preview.totalSpend)}` },
                  { label: "Submitted (Clean)",       value: preview.submittedCount },
                  { label: "Manager Reviewed",        value: preview.reviewedCount },
                  { label: "Excluded",                value: `AED ${fmt(preview.excludedAmount)}` },
                ].map((s) => (
                  <div
                    key={s.label}
                    className={`rounded-xl border p-4 ${s.gold ? "border-mbzuai-gold bg-mbzuai-gold/10" : "border-mbzuai-navy/10 bg-white"}`}
                  >
                    <p className="text-xs text-mbzuai-navy/50 uppercase tracking-wide font-medium">{s.label}</p>
                    <p className="text-xl font-bold text-mbzuai-navy mt-1">{s.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-xl border border-mbzuai-navy/10 bg-mbzuai-sand/40 p-4 text-sm text-mbzuai-navy/70 max-w-2xl">
                <strong className="text-mbzuai-navy">What's included in the ZIP:</strong>
                <ul className="mt-1.5 list-disc list-inside space-y-0.5">
                  <li>Excel reconciliation spreadsheet (Section 22 format)</li>
                  <li>All receipt files for {preview.totalCount} eligible transactions in a <code>receipts/</code> folder</li>
                  <li>All {preview.totalCount} eligible transactions will be marked as <strong>Packaged</strong></li>
                </ul>
              </div>

              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

              <button
                onClick={handleDownload}
                disabled={downloading}
                className="mt-5 px-6 py-2.5 rounded-lg bg-mbzuai-navy text-white text-sm font-medium hover:bg-mbzuai-navy/80 disabled:opacity-50"
              >
                {downloading ? "Generating package…" : "Download Package (ZIP)"}
              </button>
            </>
          )}
        </div>
      )}

      {/* success */}
      {done && (
        <div className="mt-8 max-w-lg">
          <div className="rounded-xl border border-green-200 bg-green-50 p-5">
            <p className="text-green-800 font-semibold text-sm">Package downloaded successfully</p>
            <p className="text-green-700 text-xs mt-0.5">
              The ZIP file contains the reconciliation spreadsheet and all receipt files.
            </p>
          </div>
          <button
            onClick={() => { setCardholderId(""); setDone(false); setPreview(null); }}
            className="mt-4 px-5 py-2.5 rounded-lg border border-mbzuai-navy/20 text-mbzuai-navy text-sm font-medium hover:bg-mbzuai-sand/50"
          >
            Download Another
          </button>
        </div>
      )}
    </ManagerLayout>
  );
}
