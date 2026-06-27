export default function Confirmation({ confirmation, onNewSubmission }) {
  return (
    <div
      style={{ border: "1px solid green", padding: "16px", maxWidth: "480px" }}
    >
      <h2>✓ Submission Successful</h2>
      <p>
        <strong>Reference:</strong> #{confirmation.transaction_id}
      </p>
      <p>
        <strong>Vendor:</strong> {confirmation.vendor_name}
      </p>
      <p>
        <strong>Amount:</strong> AED {confirmation.amount_aed}
      </p>
      <p>
        <strong>Invoice:</strong> {confirmation.invoice_number}
      </p>
      <p>
        <strong>Submitted:</strong>{" "}
        {new Date(confirmation.submission_date).toLocaleString()}
      </p>
      <p>
        <strong>Reconciliation period:</strong>{" "}
        {confirmation.reconciliation_period_id ?? "Unassigned"}
      </p>
      <button onClick={onNewSubmission}>New Submission</button>
    </div>
  );
}
