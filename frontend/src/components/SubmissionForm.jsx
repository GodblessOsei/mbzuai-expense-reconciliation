import { useState, useEffect } from "react";
import apiClient from "../api/client";
import { useAuth } from "../context/AuthContext";
import Button from "./Button";

export default function SubmissionForm({
  extractedData,
  uploadedFiles,
  ocrFlags = [],
  reviewFlags = [],
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
    isSplitPayment: false,
    totalPaymentParts: "",
    overallOrderTotal: "",
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
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
       ...prev, 
       [name]: type === "checkbox" ? checked : value }));
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

    if (form.isSplitPayment) {
      if (!form.totalPaymentParts.trim()) errors.push("Total payment parts is required");
      if (!form.overallOrderTotal.trim()) errors.push("Overall order total is required.")
    }
    return errors;
  };

  const blockingErrors = [...getBlockingErrors(), ...ocrFlags];
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

  const inputClass =
    "w-full rounded-lg border border-mbzuai-navy/20 px-3 py-2 text-mbzuai-navy focus:border-mbzuai-gold focus:outline-none focus:ring-1 focus:ring-mbzuai-gold";
  const labelClass = "block text-sm font-medium text-mbzuai-navy/70 mb-1";

  return (
    <div>
      <h2 className="text-lg font-semibold text-mbzuai-navy">
        Review &amp; Submit
      </h2>
      <p className="mt-1 text-sm text-mbzuai-navy/60">
        Submitting as{" "}
        <span className="font-semibold text-mbzuai-navy">
          {cardholder.cardholder_name}
        </span>
      </p>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Vendor</label>
          <input
            name="vendorName"
            value={form.vendorName}
            onChange={handleChange}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Purchase Date</label>
          <input
            name="purchaseDate"
            type="date"
            value={form.purchaseDate}
            onChange={handleChange}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Invoice Number</label>
          <input
            name="invoiceNumber"
            value={form.invoiceNumber}
            onChange={handleChange}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Amount (AED)</label>
          <input
            name="amountAed"
            value={form.amountAed}
            onChange={handleChange}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Currency</label>
          <input
            name="currency"
            value={form.currency}
            onChange={handleChange}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Payment Method</label>
          <select
            name="paymentMethod"
            value={form.paymentMethod}
            onChange={handleChange}
            className={inputClass}
          >
            <option value="RLA prepaid card">RLA prepaid card</option>
            <option value="Department card">Department card</option>
            <option value="ResLife account">ResLife account</option>
            <option value="Personal payment awaiting reimbursement">
              Personal payment awaiting reimbursement
            </option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div className="flex items-center gap-2 pt-7">
          <input
            id="isSplitPayment"
            name="isSplitPayment"
            type="checkbox"
            checked={form.isSplitPayment}
            onChange={handleChange}
            className="w-4 h-4 accent-mbzuai-navy"
          />
          <label
            htmlFor="isSplitPayment"
            className="text-sm text-mbzuai-navy/70"
          >
            This is a split payment
          </label>
        </div>

        {form.isSplitPayment && (
          <div>
            <div>
              <label className={labelClass}>Total Number of Payment Parts</label>
              <input 
              name="totalPaymentParts"
              value={form.totalPaymentParts}
              onChange={handleChange}
              className={inputClass}/>
            </div>

            <div>
              <label className={labelClass}>Overall Total Order</label>
              <input 
              name="overallOrderTotal"
              value={form.overallOrderTotal}
              onChange={handleChange}
              className={inputClass}/>
            </div>
          </div>
        )}

        <div>
          <label className={labelClass}>Card Last Four</label>
          <input
            name="cardLastFour"
            value={form.cardLastFour}
            onChange={handleChange}
            className={inputClass}
          />
        </div>
        <div className="flex items-center gap-2 pt-7">
          <input
            id="cardDigitsNotShown"
            type="checkbox"
            checked={cardDigitsNotShown}
            onChange={(e) => setCardDigitsNotShown(e.target.checked)}
            className="w-4 h-4 accent-mbzuai-navy"
          />
          <label
            htmlFor="cardDigitsNotShown"
            className="text-sm text-mbzuai-navy/70"
          >
            Card digits not shown on receipt
          </label>
        </div>
        <div>
          <label className={labelClass}>Category</label>
          <select
            name="category"
            value={form.category}
            onChange={handleChange}
            className={inputClass}
          >
            <option value="">-- Select category --</option>
            <option value="Event supplies">Event supplies</option>
            <option value="Food and catering">Food and catering</option>
            <option value="Stationery">Stationery</option>
            <option value="Equipment">Equipment</option>
            <option value="Subscription">Subscription</option>
            <option value="Per diem expense">Per diem expense</option>
            <option value="Other">Other</option>
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
          <select
            name="department"
            value={form.department}
            onChange={handleChange}
            className={inputClass}
          >
            <option value="Residential Life">Residential Life</option>
            <option value="Student Life">Student Life</option>
            <option value="Other department">Other department</option>
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
        <div className="sm:col-span-2">
          <label className={labelClass}>Notes</label>
          <textarea
            name="notes"
            value={form.notes}
            onChange={handleChange}
            rows={2}
            className={inputClass}
          />
        </div>
      </div>

      {blockingErrors.length > 0 && (
        <div className="mt-5 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm font-medium text-red-700">
            Resolve these before submitting:
          </p>
          <ul className="mt-1 list-disc list-inside text-sm text-red-600">
            {blockingErrors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        {onBack && (
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
        )}
        <Button onClick={handleSubmit} disabled={!canSubmit}>
          Submit
        </Button>
      </div>
      {status && <p className="mt-2 text-sm text-mbzuai-navy/60">{status}</p>}
    </div>
  );
}
