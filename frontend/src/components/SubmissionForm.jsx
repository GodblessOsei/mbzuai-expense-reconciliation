import { useState, useEffect } from "react";
import apiClient from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function SubmissionForm({
  extractedData,
  uploadedFiles,
  onSubmitted,
  onBack,
}) {
  const [status, setStatus] = useState("");
  const { cardholder } = useAuth();

  const [form, setForm] = useState({
    vendorName: "",
    purchaseDate: "",
    invoiceNumber: "",
    amountAed: "",
    currency: "AED",
    cardLastFour: "",
    paymentMethod: "RLA prepaid card",
    category: "",
    customCategory: "",
    department: "Residential Life",
    customDepartment: "",
    notes: "",
  });

  const [cardDigitsNotShown, setCardDigitsNotShown] = useState(false); // acknowledgment

  // when OCR data arrives, pre-fill the form
  useEffect(() => {
    if (extractedData) {
      setForm((prev) => ({
        ...prev,
        vendorName: extractedData.vendorName || "",
        purchaseDate: extractedData.purchaseDate || "",
        invoiceNumber: extractedData.invoiceNumber || "",
        amountAed: extractedData.amountAed || "",
        currency: extractedData.currency || "AED",
        cardLastFour: extractedData.cardLastFour || "",
      }));
    }
  }, [extractedData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const getBlockingErrors = () => {
    const errors = [];

    if (!form.vendorName.trim()) errors.push("Vendor name is required");
    if (!form.purchaseDate) errors.push("Purchase date is required");
    if (!form.invoiceNumber.trim()) errors.push("Invoice number is required");
    if (!form.amountAed.trim()) errors.push("Amount is required");
    if (!form.currency.trim()) errors.push("Currency is required");
    if (form.currency.trim().toUpperCase() !== "AED")
      errors.push("Currency must be AED");

    // card digits: blocking UNLESS user acknowledged they're not on the receipt
    if (!form.cardLastFour.trim() && !cardDigitsNotShown) {
      errors.push(
        "Card last-four is required (or tick 'not shown on receipt')"
      );
    }

    if (
      form.department === "Other department" &&
      !form.customDepartment.trim()
    ) {
      errors.push("Please specify the department");
    }

    // category must be selected
    if (!form.category) errors.push("Select a category");

    // if "Other", the description is required
    if (form.category === "Other" && !form.customCategory.trim()) {
      errors.push("Please describe the category");
    }

    return errors;
  };

  const blockingErrors = getBlockingErrors();
  const canSubmit = blockingErrors.length === 0;

  const handleSubmit = async () => {
    if (!canSubmit) {
      setStatus("Resolve the blocking issues first.");
      return;
    }
    try {
      setStatus("Submitting...");
      const res = await apiClient.post("/transactions/final-submit", {
        user_id: 1,
        cardholder_id: cardholder.cardholder_id,
        card_last_four: form.cardLastFour,
        card_digits_not_shown: cardDigitsNotShown,
        vendor_name: form.vendorName,
        purchase_date: form.purchaseDate,
        invoice_number: form.invoiceNumber,
        category: form.category,
        department: form.department,
        amount_aed: form.amountAed,
        original_currency: form.currency,
        payment_method: form.paymentMethod,
        notes: form.notes,
        receipt_file_ids: uploadedFiles.map((f) => f.receipt_file_id),
      });
      setStatus(
        `Transaction created (ID: ${res.data.confirmation.transaction_id})`
      );
      if (onSubmitted) onSubmitted(res.data.confirmation);
    } catch (err) {
      setStatus(
        "Submit failed: " + (err.response?.data?.message || err.message)
      );
    }
  };

  return (
    <div>
      <h2>Review & Submit</h2>

      <p>
        Submitting as: <strong>{cardholder.cardholder_name}</strong>
      </p>

      <label>Vendor</label>
      <input
        name="vendorName"
        value={form.vendorName}
        onChange={handleChange}
      />

      <label>Purchase Date</label>
      <input
        name="purchaseDate"
        type="date"
        value={form.purchaseDate}
        onChange={handleChange}
      />

      <label>Invoice Number</label>
      <input
        name="invoiceNumber"
        value={form.invoiceNumber}
        onChange={handleChange}
      />

      <label>Amount (AED)</label>
      <input name="amountAed" value={form.amountAed} onChange={handleChange} />

      <label>Currency</label>
      <input name="currency" value={form.currency} onChange={handleChange} />

      <label>Payment Method</label>
      <select
        name="paymentMethod"
        value={form.paymentMethod}
        onChange={handleChange}
      >
        <option value="RLA prepaid card">RLA prepaid card</option>
        <option value="Department card">Department card</option>
        <option value="ResLife account">ResLife account</option>
        <option value="Personal payment awaiting reimbursement">
          Personal payment awaiting reimbursement
        </option>
        <option value="Other">Other</option>
      </select>

      <label>
        <input
          type="checkbox"
          checked={cardDigitsNotShown}
          onChange={(e) => setCardDigitsNotShown(e.target.checked)}
        />
        Card digits not shown on receipt
      </label>

      <label>Card Last Four</label>
      <input
        name="cardLastFour"
        value={form.cardLastFour}
        onChange={handleChange}
      />

      <label>Category</label>
      <select name="category" value={form.category} onChange={handleChange}>
        <option value="">-- Select category --</option>
        <option value="Event supplies">Event supplies</option>
        <option value="Food and catering">Food and catering</option>
        <option value="Stationery">Stationery</option>
        <option value="Equipment">Equipment</option>
        <option value="Subscription">Subscription</option>
        <option value="Per diem expense">Per diem expense</option>
        <option value="Other">Other</option>
      </select>

      {form.category === "Other" && (
        <>
          <label>Describe Category</label>
          <input
            name="customCategory"
            value={form.customCategory}
            onChange={handleChange}
          />
        </>
      )}

      <label>Department</label>
      <select name="department" value={form.department} onChange={handleChange}>
        <option value="Residential Life">Residential Life</option>
        <option value="Student Life">Student Life</option>
        <option value="Other department">Other department</option>
      </select>

      {form.department === "Other department" && (
        <>
          <label>Specify Department</label>
          <input
            name="customDepartment"
            value={form.customDepartment}
            onChange={handleChange}
          />
        </>
      )}

      <label>Notes</label>
      <textarea name="notes" value={form.notes} onChange={handleChange} />
      {blockingErrors.length > 0 && (
        <div style={{ color: "crimson" }}>
          <p>Resolve these before submitting:</p>
          <ul>
            {blockingErrors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {onBack && <button onClick={onBack}> Back</button>}
      <button onClick={handleSubmit}>Submit</button>
      <p>{status}</p>
    </div>
  );
}
