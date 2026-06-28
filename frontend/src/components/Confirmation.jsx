import Button from "./Button";

export default function Confirmation({
  confirmation,
  onNewSubmission,
  onHome,
}) {
  const rows = [
    ["Reference", `#${confirmation.transaction_id}`],
    ["Vendor", confirmation.vendor_name],
    ["Amount", `AED ${confirmation.amount_aed}`],
    ["Invoice", confirmation.invoice_number],
    ["Submitted", new Date(confirmation.submission_date).toLocaleString()],
    [
      "Reconciliation period",
      confirmation.reconciliation_period_id ?? "Unassigned",
    ],
  ];

  return (
    <div className="max-w-md mx-auto text-center">
      {/* navy success badge */}
      <div className="mx-auto flex items-center justify-center w-14 h-14 rounded-full bg-mbzuai-navy text-white text-2xl">
        ✓
      </div>
      <h2 className="mt-4 text-xl font-semibold text-mbzuai-navy">
        Transaction added
      </h2>
      <p className="mt-1 text-sm text-mbzuai-navy/60">
        Your submission was recorded successfully.
      </p>

      {/* details on a navy panel */}
      <div className="mt-6 bg-mbzuai-navy rounded-2xl p-6 text-left">
        <dl className="space-y-2">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 text-sm">
              <dt className="text-white/60">{label}</dt>
              <dd className="text-white font-medium text-right">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-6 flex items-center justify-center gap-3">
        <Button variant="outline" onClick={onHome}>
          Home
        </Button>
        <Button onClick={onNewSubmission}>Add Transaction</Button>
      </div>
    </div>
  );
}
