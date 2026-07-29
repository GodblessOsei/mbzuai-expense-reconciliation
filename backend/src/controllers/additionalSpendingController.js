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

    // The author is stamped from the session, not sent by the client. This is
    // the whole reason managers have individual logins rather than a shared
    // password: a name that anyone could type is a claim, not a fact, and a
    // disputed spending figure needs a fact.
    const result = await pool.query(
      `INSERT INTO additional_spending
        (budget_item_id, date, vendor_name, department, category, amount_aed, payment_method, reference_number, notes, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
        req.user.userId,
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
        createdByUserId: row.created_by_user_id,
        createdByName: req.user.fullName,
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
      `SELECT a.*, b.item_name AS budget_item_name,
              u.full_name AS created_by_name
       FROM additional_spending a
       LEFT JOIN budget_items b ON b.budget_item_id = a.budget_item_id
       LEFT JOIN users u ON u.user_id = a.created_by_user_id
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
      // Null for rows entered before logins existed — there is genuinely no
      // record of who added those, and inventing one would be worse.
      createdByUserId: row.created_by_user_id,
      createdByName: row.created_by_name,
      createdAt: row.created_at,
    }));

    return res.json({ success: true, entries });
  } catch (error) {
    console.error("getAdditionalSpending error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { createAdditionalSpending, getAdditionalSpending };
