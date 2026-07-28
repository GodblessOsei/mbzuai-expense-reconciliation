const pool = require("../db/pool");

const createAdditionalSpending = async (req, res) => {
  try {
    const {
      budget_item_id,
      date,
      vendor_name,
      department,
      category,
      amount_aed,
      payment_method,
      reference_number,
      notes,
    } = req.body;

    if (
      !budget_item_id ||
      !date ||
      !vendor_name ||
      !department ||
      !category ||
      !amount_aed ||
      !payment_method
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    const result = await pool.query(
      `INSERT INTO additional_spending
        (budget_item_id, date, vendor_name, department, category, amount_aed, payment_method, reference_number, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        budget_item_id,
        date,
        vendor_name,
        department,
        category,
        amount_aed,
        payment_method,
        reference_number || null,
        notes || null,
      ]
    );

    const row = result.rows[0];
    return res.status(201).json({
      success: true,
      additionalSpending: {
        additionalSpendingId: row.additional_spending_id,
        budgetItemId: row.budget_item_id,
        date: row.date,
        vendorName: row.vendor_name,
        department: row.department,
        category: row.category,
        amountAed: row.amount_aed,
        paymentMethod: row.payment_method,
        referenceNumber: row.reference_number,
        notes: row.notes,
      },
    });
  } catch (error) {
    console.error("createAdditionalSpending error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const getAdditionalSpending = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, b.item_name AS budget_item_name
       FROM additional_spending a
       LEFT JOIN budget_items b ON b.budget_item_id = a.budget_item_id
       ORDER BY a.date DESC`
    );

    const entries = result.rows.map((row) => ({
      additionalSpendingId: row.additional_spending_id,
      budgetItemId: row.budget_item_id,
      budgetItemName: row.budget_item_name,
      date: row.date,
      vendorName: row.vendor_name,
      department: row.department,
      category: row.category,
      amountAed: row.amount_aed,
      paymentMethod: row.payment_method,
      referenceNumber: row.reference_number,
      notes: row.notes,
    }));

    return res.json({ success: true, entries });
  } catch (error) {
    console.error("getAdditionalSpending error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { createAdditionalSpending, getAdditionalSpending };
