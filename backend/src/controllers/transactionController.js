const pool = require("../db/pool");

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
      receipt_file_ids, // for linking uploaded files
    } = req.body;
    // --- required-field validation ---
    if (
      !user_id ||
      !cardholder_id ||
      !purchase_date ||
      !vendor_name ||
      !invoice_number ||
      !amount_aed ||
      !original_currency
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required submission fields",
      });
    }

    // --- card-digit match check ---
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
                notes
            )
            VALUES (
                $1, $2, NOW(), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
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
        reconciliation_period_id || null,
        notes,
      ]
    );

    const transaction = result.rows[0];

    // link uploaded receipt files to this transaction ---
    if (receipt_file_ids && receipt_file_ids.length > 0) {
      await pool.query(
        `UPDATE receipt_files SET transaction_id = $1 WHERE receipt_file_id = ANY($2)`,
        [transaction.transaction_id, receipt_file_ids]
      );
    }

    // --- write management flags ---
    const flagsToCreate = [];

    // payment method not the prepaid card
    if (payment_method && payment_method !== "RLA prepaid card") {
      flagsToCreate.push("alternative_payment_method");
    }

    // card digits acknowledged as not on receipt
    if (card_digits_not_shown) {
      flagsToCreate.push("missing_card_digits");
    }

    for (const flagType of flagsToCreate) {
      await pool.query(
        `INSERT INTO flags (transaction_id, flag_type, resolved, created_at)
      VALUES ($1, $2, FALSE, NOW())`,
        [transaction.transaction_id, flagType]
      );
    }

    // --- confirmation response ---
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
    console.error(error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to submit transaction",
    });
  }
};

module.exports = {
  createTransaction,
};
