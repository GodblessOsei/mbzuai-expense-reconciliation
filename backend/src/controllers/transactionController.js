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
            notes
        } = req.body;

        if (!user_id || !cardholder_id || !purchase_date || !vendor_name || !invoice_number || !amount_aed || !original_currency) {
            return res.status(400).json({
                success: false,
                message: "Missing required submission fields",
            });
        }

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
                notes
            ]
        );

        const transaction = result.rows[0];

        res.status(201).json({
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

        res.status(500).json({
            success: false,
            message: "Failed to submit transaction",
        });
    }
};

module.exports = {
    createTransaction,
};