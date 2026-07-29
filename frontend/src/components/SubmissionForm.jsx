import { useState, useEffect } from "react";
import apiClient from "../api/client";
import { useAuth } from "../context/AuthContext";
import Button from "./Button";

const FLAG_MESSAGES = {
  ocr_card_mismatch:
    "The card digits differ across the uploaded receipts — please check they belong to the same card.",
  ocr_currency_mismatch:
    "The receipts show different currencies — please verify the amounts.",
  multi_file_submission: "This submission includes multiple files.", // non-blocking; context for the manager
};

export default function SubmissionForm({
  extractedData,
  uploadedFiles,
  managerFlags = [], // { type, blocking } objects
  reviewNotices = [],
  onSubmitted,
  onBack,
}) {
  const [status, setStatus] = useState("");
  const [budgetItems, setBudgetItems] = useState([]);
  const { user, assignedCard } = useAuth();

  // Whose card was used. This is a fact about the PURCHASE, not about who is
  // signed in — RLAs are free to use each other's cards, so it is asked here
  // rather than being inferred from identity.
  const [cardholders, setCardholders] = useState([]);
  const [cardholderId, setCardholderId] = useState(
    assignedCard ? String(assignedCard.cardholderId) : ""
  );

  const [form, setForm] = useState({
    vendorName: "",
    purchaseDate: "",
    invoiceNumber: "",
    amountAed: "",
    currency: "AED",
    cardLastFour: "",
    paymentMethod: "RLA prepaid card",
    category: "",
    budgetItemId: "",
    customCategory: "",
    department: "Residential Life",
    customDepartment: "",
    isSplitPayment: false,
    totalPaymentParts: "",
    paymentPartNumber: "",
    overallOrderTotal: "",
    purchaseDescription: "",
    notes: "",
  });

  const [cardDigitsNotShown, setCardDigitsNotShown] = useState(false); // acknowledgment
  const [ocrFlagsAcknowledged, setOcrFlagsAcknowledged] = useState(false);

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

  const getFieldErrors = () => {
    const errors = [];

    if (!cardholderId) errors.push("Select whose card was used");
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
    
    if (!form.budgetItemId) errors.push("Select what the purchase was for");

    // if "Other", the description is required
    if (form.category === "Other" && !form.customCategory.trim()) {
      errors.push("Please describe the category");
    }

    if (!form.purchaseDescription.trim()) errors.push("Purchase description is required");

    if (form.isSplitPayment) {
      if (!form.totalPaymentParts.trim()) errors.push("Total payment parts is required");
      if (!form.paymentPartNumber.trim()) errors.push("Part number is required for split payments");
      if (!form.overallOrderTotal.trim()) errors.push("Overall order total is required");
    }
    return errors;
  };

  // blocking OCR flags (from receipt cross-checks)
  const blockingFlags = managerFlags.filter((f) => f.blocking);
  const hasBlockingFlags = blockingFlags.length > 0;

  // blocking flags gate submission UNTIL the RLA acknowledges them
  const flagsBlockSubmission = hasBlockingFlags && !ocrFlagsAcknowledged;

  // field errors show in the generic panel; OCR flags show in their own panel.
  // Both count toward whether the form can submit, but each renders in ONE place only.
  const fieldErrors = getFieldErrors();
  const canSubmit = fieldErrors.length === 0 && !flagsBlockSubmission;

  const handleSubmit = async () => {
    if (!canSubmit) {
      setStatus("Resolve the blocking issues first.");
      return;
    }
    try {
      setStatus("Submitting...");
      // No user_id is sent. The backend reads the submitter from the verified
      // session — a submitter the client could name would be a claim, not a
      // fact, and it is the only accountability anchor now that cards are
      // shared.
      const res = await apiClient.post("/transactions/final-submit", {
        cardholder_id: Number(cardholderId),
        card_last_four: form.cardLastFour,
        card_digits_not_shown: cardDigitsNotShown,
        vendor_name: form.vendorName,
        purchase_date: form.purchaseDate,
        invoice_number: form.invoiceNumber,
        category: form.category,
        budget_item_id: form.budgetItemId,
        department: form.department,
        amount_aed: form.amountAed,
        original_currency: form.currency,
        payment_method: form.paymentMethod,
        purchase_description: form.purchaseDescription,
        is_split_payment: form.isSplitPayment,
        total_payment_parts: form.totalPaymentParts,
        payment_part_number: form.paymentPartNumber || null,
        overall_order_total: form.overallOrderTotal,
        notes: form.notes,
        receipt_file_ids: uploadedFiles.map((f) => f.receipt_file_id),
        ocr_flags: managerFlags.map((f) => f.type), // types only -> DB rows
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

  // Run this function once when the component first appears
  useEffect(() => {
    apiClient
    .get("/budget-items")
    .then((res) => setBudgetItems(res.data.budgetItems || []))
    .catch((err) => console.error("Failed to load budget items:", err));
  }, []);

  // Every active card, unfiltered. Deliberately not narrowed to this user's
  // own card — borrowing is a supported case, not an exception to work around.
  useEffect(() => {
    apiClient
      .get("/cardholders")
      .then((res) => setCardholders(res.data.cardholders || []))
      .catch((err) => console.error("Failed to load cardholders:", err));
  }, []);

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
        <span className="font-semibold text-mbzuai-navy">{user.fullName}</span>
      </p>

      {/* Whose card was used. Defaults to their own so the ordinary case is
          one click, but any card can be chosen — the client is explicit that
          RLAs use each other's cards. */}
      <div className="mt-5">
        <label htmlFor="cardholderId" className={labelClass}>
          Whose card did you use?
        </label>
        <select
          id="cardholderId"
          value={cardholderId}
          onChange={(e) => setCardholderId(e.target.value)}
          className={inputClass}
        >
          <option value="">Select a card…</option>
          {cardholders.map((c) => (
            <option key={c.cardholder_id} value={c.cardholder_id}>
              {c.cardholder_name} •••• {c.last_four_digits}
              {assignedCard && c.cardholder_id === assignedCard.cardholderId
                ? " (yours)"
                : ""}
            </option>
          ))}
        </select>
        {assignedCard &&
          cardholderId &&
          Number(cardholderId) !== assignedCard.cardholderId && (
            <p className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              This will be recorded against someone else’s card. It will still
              be filed under your name as the submitter.
            </p>
          )}
      </div>

      {reviewNotices.length > 0 && (
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm font-medium text-amber-800">
            Please double-check — some details were extracted by AI:
          </p>
          <ul className="mt-1 list-disc list-inside text-sm text-amber-700">
            {reviewNotices.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}

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
          <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Total Parts</label>
              <input
                name="totalPaymentParts"
                type="number"
                min="2"
                value={form.totalPaymentParts}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>This Part Number</label>
              <input
                name="paymentPartNumber"
                type="number"
                min="1"
                value={form.paymentPartNumber}
                onChange={handleChange}
                className={inputClass}
                placeholder="e.g. 1"
              />
            </div>
            <div>
              <label className={labelClass}>Overall Order Total (AED)</label>
              <input
                name="overallOrderTotal"
                value={form.overallOrderTotal}
                onChange={handleChange}
                className={inputClass}
              />
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

        <div>
          <label className={labelClass}>Purchase For</label>
          <select
            name="budgetItemId"
            value={form.budgetItemId}
            onChange={handleChange}
            className={inputClass}
            >
              <option value="">Select purchase purpose</option>
              {budgetItems.map((item) => (
                <option key={item.budget_item_id} value={item.budget_item_id}>
                  {item.item_name}
                </option>
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
          <label className={labelClass}>Purchase Description <span className="text-red-500">*</span></label>
          <textarea
            name="purchaseDescription"
            value={form.purchaseDescription}
            onChange={handleChange}
            rows={2}
            placeholder="Briefly describe what was purchased and why"
            className={inputClass}
          />
        </div>
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

      {/* generic field errors (missing/invalid fields only) */}
      {fieldErrors.length > 0 && (
        <div className="mt-5 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm font-medium text-red-700">
            Resolve these before submitting:
          </p>
          <ul className="mt-1 list-disc list-inside text-sm text-red-600">
            {fieldErrors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* OCR blocking flags — shown here only, with the acknowledge checkbox */}
      {hasBlockingFlags && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm font-medium text-red-700">
            Receipt check flagged an issue:
          </p>
          <ul className="mt-1 list-disc list-inside text-sm text-red-600">
            {blockingFlags.map((f, i) => (
              <li key={i}>{FLAG_MESSAGES[f.type] || f.type}</li>
            ))}
          </ul>
          <label className="mt-3 flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={ocrFlagsAcknowledged}
              onChange={(e) => setOcrFlagsAcknowledged(e.target.checked)}
              className="mt-1 w-4 h-4 accent-mbzuai-navy"
            />
            <span className="text-sm text-red-700">
              I've reviewed these receipts and confirm the details are correct.
              (This will still be flagged for manager review.)
            </span>
          </label>
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
