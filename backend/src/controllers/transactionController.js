const pool = require("../db/pool");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto")

const { generateCombinedReceiptPdf } = require("../services/pdfService");
const {
  getOrCreateReconciliationPeriod,
} = require("../services/reconciliationPeriodService");

const createTransaction = async (req, res) => {
  try {
    const {
      user_id,
      cardholder_id,
      purchase_date,
      vendor_name,
      invoice_number,
      category,
      department,
      amount_aed,
      original_currency,
      payment_method,
      reconciliation_period_id,
      notes,
      card_last_four, // for the card-match check
      card_digits_not_shown, //manager flag
      ocr_flags,
      receipt_file_ids, // for linking uploaded files
      is_split_payment,
      total_payment_parts,
      overall_order_total,
    } = req.body;
    // required-field validation
    if (
      !user_id ||
      !cardholder_id ||
      !purchase_date ||
      !vendor_name ||
      !invoice_number ||
      !amount_aed ||
      !original_currency ||
      (is_split_payment && (!total_payment_parts || !overall_order_total))
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required submission fields",
      });
    }

    // card-digit match check
    if (card_last_four) {
      const cardholderResult = await pool.query(
        `SELECT last_four_digits FROM cardholders WHERE cardholder_id = $1`,
        [cardholder_id]
      );

      if (cardholderResult.rows.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "Cardholder not found" });
      }

      const onFileDigits = cardholderResult.rows[0].last_four_digits;
      if (card_last_four !== onFileDigits) {
        return res.status(400).json({
          success: false,
          message:
            "Card digits do not match the selected cardholder's card on file",
        });
      }
    }

    // --- assign reconciliation period by purchase date ---
    const reconciliationPeriod =
      await getOrCreateReconciliationPeriod(purchase_date);
    const assignedPeriodId = reconciliationPeriod.reconciliation_period_id;

    // late submission check: more than 3 days after purchase
    const purchaseDateObj = new Date(purchase_date);
    const today = new Date();
    const daysSincePurchase = (today - purchaseDateObj) / (1000 * 60 * 60 * 24);
    const isLate = daysSincePurchase > 3;
    // --- end period assignment ---

    // --- create the transaction in db ---
    const result = await pool.query(
      `INSERT INTO transactions (
                user_id,
                cardholder_id,
                submission_date,
                purchase_date,
                vendor_name,
                invoice_number,
                category,
                department,
                amount_aed,
                original_currency,
                payment_method,
                reconciliation_period_id,
                is_split_payment,
                total_payment_parts,
                overall_order_total,
                notes
            )
            VALUES (
                $1, $2, NOW(), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
            )
            RETURNING *`,
      [
        user_id,
        cardholder_id,
        purchase_date,
        vendor_name,
        invoice_number,
        category,
        department,
        amount_aed,
        original_currency,
        payment_method,
        assignedPeriodId,
        is_split_payment,
        total_payment_parts || null,
        overall_order_total || null,
        notes,
      ]
    );

    const transaction = result.rows[0];

    // link uploaded receipt files to this transaction
    if (receipt_file_ids && receipt_file_ids.length > 0) {
      await pool.query(
        `UPDATE receipt_files SET transaction_id = $1 WHERE receipt_file_id = ANY($2)`,
        [transaction.transaction_id, receipt_file_ids]
      );
    }

    //  write management flags
    const flagsToCreate = [];

    // payment method not the prepaid card
    if (payment_method && payment_method !== "RLA prepaid card") {
      flagsToCreate.push("alternative_payment_method");
    }

    // card digits acknowledged as not on receipt
    if (card_digits_not_shown) {
      flagsToCreate.push("missing_card_digits");
    }

    if (isLate) {
      flagsToCreate.push("late_submission");
    }

    if (Array.isArray(ocr_flags)) {
      for (const flagType of ocr_flags) {
        flagsToCreate.push(flagType);
      }
    }

    if (is_split_payment) {
      flagsToCreate.push("split_payment");
    }
    for (const flagType of flagsToCreate) {
      await pool.query(
        `INSERT INTO flags (transaction_id, flag_type, resolved, created_at)
      VALUES ($1, $2, FALSE, NOW())`,
        [transaction.transaction_id, flagType]
      );
    }

    // set transaction status based on whether any flags were raised
    const status = flagsToCreate.length > 0 ? "flagged" : "submitted";

    await pool.query(
      `UPDATE transactions SET status = $1 WHERE transaction_id = $2`,
      [status, transaction.transaction_id]
    );

    // confirmation response
    return res.status(201).json({
      success: true,
      message: "Submission successful",
      confirmation: {
        transaction_id: transaction.transaction_id,
        vendor_name: transaction.vendor_name,
        invoice_number: transaction.invoice_number,
        amount_aed: transaction.amount_aed,
        original_currency: transaction.original_currency,
        cardholder_id: transaction.cardholder_id,
        submission_date: transaction.submission_date,
        reconciliation_period_id: transaction.reconciliation_period_id,
      },
    });
  } catch (error) {
    console.error("createTransaction error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to submit transaction",
    });
  }
};

const getAllTransactions = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.*, c.cardholder_name
       FROM transactions t
       LEFT JOIN cardholders c ON c.cardholder_id = t.cardholder_id
       ORDER BY t.submission_date DESC`
    );
    return res.status(200).json({ success: true, transactions: result.rows });
  } catch (error) {
    console.error(error.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch transactions" });
  }
};

const getTransactionsByCardholder = async (req, res) => {
  try {
    const { cardholderId } = req.params; //cardholderId for url parameter

    const result = await pool.query(
      `SELECT * FROM transactions
       WHERE cardholder_id = $1
       ORDER BY submission_date DESC`,
      [cardholderId]
    );

    return res.status(200).json({ success: true, transactions: result.rows });
  } catch (error) {
    console.error(error.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch transactions" });
  }
};

const generateTransactionPdf = async (req, res) => {
  try {
    const { id } = req.params;

    // get the transaction_id w/ cardholder name for the filename
    const txResult = await pool.query(
      `SELECT t.*, c.cardholder_name
       FROM transactions t
       LEFT JOIN cardholders c ON c.cardholder_id = t.cardholder_id
       WHERE t.transaction_id = $1`,
      [id]
    );
    if (txResult.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Transaction not found" });
    }
    const tx = txResult.rows[0];

    //get the transaction's receipt files
    const filesResult = await pool.query(
      `SELECT file_path FROM receipt_files WHERE transaction_id = $1`,
      [id]
    );
    if (filesResult.rows.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No receipt files to combine" });
    }
    const filePaths = filesResult.rows.map((r) => r.file_path);

    console.log("generator is:", typeof generateCombinedReceiptPdf);
    console.log("calling generator with:", {
      filePaths,
      purchaseDate: tx.purchase_date,
      vendorName: tx.vendor_name,
      amountAed: tx.amount_aed,
      cardholderName: tx.cardholder_name,
    });
    // call combined pdf generator from the service
    const { filePath } = await generateCombinedReceiptPdf({
      filePaths,
      purchaseDate: tx.purchase_date,
      vendorName: tx.vendor_name,
      amountAed: tx.amount_aed,
      cardholderName: tx.cardholder_name,
    });

    console.log("generator returned:", filePath);

    // store the path on the transaction
    await pool.query(
      `UPDATE transactions SET pdf_path = $1 WHERE transaction_id = $2`,
      [filePath, id]
    );

    return res
      .status(200)
      .json({ success: true, message: "PDF generated", pdf_path: filePath });
  } catch (error) {
    console.error("PDF generation error:", error.message);
    console.error("PDF generation error (full):", error);
    console.error("Stack:", error?.stack);
    console.error("Type:", typeof error, error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to generate PDF" });
  }
};

const getTransactionPdf = async (req, res) => {
  try {
    const { id } = req.params;
    const download = req.query.download === "true"; // ?download=true forces download

    const result = await pool.query(
      `SELECT pdf_path FROM transactions WHERE transaction_id = $1`,
      [id]
    );
    if (result.rows.length === 0 || !result.rows[0].pdf_path) {
      return res
        .status(404)
        .json({ success: false, message: "No PDF for this transaction" });
    }

    const pdfPath = result.rows[0].pdf_path;
    if (!fs.existsSync(pdfPath)) {
      return res
        .status(404)
        .json({ success: false, message: "PDF file missing on disk" });
    }

    if (download) {
      return res.download(pdfPath); // forces download with original filename
    }
    return res.sendFile(pdfPath); // opens/streams for viewing
  } catch (error) {
    console.error(error.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to retrieve PDF" });
  }
};

const VALID_STATUSES = ["submitted", "flagged", "reviewed", "packaged", "deleted"];

const getTransactionFlags = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT * FROM flags WHERE transaction_id = $1 ORDER BY created_at ASC`,
      [id]
    );
    return res.status(200).json({ success: true, flags: result.rows });
  } catch (error) {
    console.error("getTransactionFlags error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch flags" });
  }
};

const updateTransactionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!VALID_STATUSES.includes(status)) {
      return res
        .status(400)
        .json({
          success: false,
          message: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
        });
    }

    const result = await pool.query(
      `UPDATE transactions SET status = $1 WHERE transaction_id = $2 RETURNING *`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Transaction not found" });
    }

    return res.status(200).json({ success: true, transaction: result.rows[0] });
  } catch (error) {
    console.error("updateTransactionStatus error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update status" });
  }
};

const updateTransaction = async (req, res) => {
  try {
    const { id } = req.params;

    const editableFields = [
      "vendor_name",
      "purchase_date",
      "invoice_number",
      "category",
      "department",
      "amount_aed",
      "original_currency",
      "payment_method",
      "notes",
    ];

    const oldResult = await pool.query(
      `SELECT * FROM transactions WHERE transaction_id = $1`,
      [id]
    );

    if (oldResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }
    const oldTransaction = oldResult.rows[0];
    const fieldsToUpdate = {};
    const auditEntries = [];

    for (const field of editableFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        const oldValue = oldTransaction[field];
        const newValue = req.body[field];

        if (String(oldValue ?? "") !== String(newValue ?? "")) {
          fieldsToUpdate[field] = newValue;
          auditEntries.push({
            field_name: field,
            old_value: oldValue,
            new_value: newValue,
          });
        }
      }
    }
    if (auditEntries.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No changes detected",
        transaction: oldTransaction,
      });
    }

    const setClause = Object.keys(fieldsToUpdate)
      .map((field, index) => `${field} = $${index + 1}`)
      .join(", ");
    const values = Object.values(fieldsToUpdate);

    const updateResult = await pool.query(
      `UPDATE transactions
      SET ${setClause}
      WHERE transaction_id = $${values.length + 1}
      RETURNING *`,
      [...values, id]
    );
    const updatedTransaction = updateResult.rows[0];

    const editSessionId = crypto.randomUUID();
    for (const entry of auditEntries) {
      await pool.query(
        `INSERT INTO audit_logs (
          edit_session_id,
          transaction_id,
          user_id,
          action_type,
          field_name,
          old_value,
          new_value,
          editor,
          timestamp
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          editSessionId,
          id,
          null,
          "UPDATE",
          entry.field_name,
          entry.old_value,
          entry.new_value,
          "manager",
        ]
      );
    }
    return res.status(200).json({
      success: true,
      message: "Transaction updated",
      transaction: updatedTransaction,
      audit_logs_created: auditEntries.length,
    });
  } catch (error) {
    console.error("updateTransaction error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update transaction",
    });
  }
};

const deleteTransaction = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE transactions
       SET status = 'deleted',
            is_active = FALSE
       WHERE transaction_id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    return res.status(200).json({
      success: true,
      transaction: result.rows[0],
    });
  } catch (error) {
    console.error("deleteTransaction error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete transaction",
    });
  }
};

const getTransactionAuditLogs = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT *
       FROM audit_logs
       WHERE transaction_id = $1
       ORDER BY timestamp DESC, log_id DESC`,
      [id]
    );
    return res.status(200).json({
      success: true,
      audit_logs: result.rows,
    });
  } catch (error) {
    console.error("getTransactionAuditLogs error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch audit logs",
    });
  }
}

module.exports = {
  createTransaction,
  getTransactionsByCardholder,
  getAllTransactions,
  generateTransactionPdf,
  getTransactionPdf,
  getTransactionFlags,
  updateTransactionStatus,
  updateTransaction,
  deleteTransaction,
  getTransactionAuditLogs,
};
