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
            // RETURNING * means: After inserting the row, give me back the whole row.
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
                reconciliation_period_id,
                notes
            ]
        );
        res.status(201).json({
            success: true,
            transaction: result.rows[0],
        });
    } catch (error) {
        console.error(error.message);

        res.status(500).json({
            success: false,
            message: "Failed to create transaction", 
        });
    }
};

module.exports = {
    createTransaction,
};