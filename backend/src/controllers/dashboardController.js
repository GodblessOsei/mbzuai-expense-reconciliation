const pool = require("../db/pool");

const dateFilter = (year, month) => {
  const clauses = [];
  if (year) clauses.push(`EXTRACT(YEAR FROM t.purchase_date) = ${parseInt(year, 10)}`);
  if (month) clauses.push(`EXTRACT(MONTH FROM t.purchase_date) = ${parseInt(month, 10)}`);
  return clauses.length ? `AND ${clauses.join(" AND ")}` : "";
};

const spendingByCategory = async (req, res) => {
  try {
    const { year, month } = req.query;
    const result = await pool.query(
      `SELECT
         t.category                  AS name,
         COALESCE(SUM(t.amount_aed), 0) AS total_aed,
         COUNT(*)                    AS transaction_count
       FROM transactions t
       WHERE t.is_active = true
         ${dateFilter(year, month)}
       GROUP BY t.category
       ORDER BY total_aed DESC`
    );

    return res.json({
      success: true,
      data: result.rows.map((r) => ({
        name: r.name,
        totalAed: parseFloat(r.total_aed),
        transactionCount: parseInt(r.transaction_count),
      })),
    });
  } catch (error) {
    console.error("spendingByCategory error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const spendingByCardholder = async (req, res) => {
  try {
    const { year, month } = req.query;
    const result = await pool.query(
      `SELECT
         c.cardholder_name           AS name,
         COALESCE(SUM(t.amount_aed), 0) AS total_aed,
         COUNT(*)                    AS transaction_count
       FROM transactions t
       JOIN cardholders c ON c.cardholder_id = t.cardholder_id
       WHERE t.is_active = true
         ${dateFilter(year, month)}
       GROUP BY c.cardholder_name
       ORDER BY total_aed DESC`
    );

    return res.json({
      success: true,
      data: result.rows.map((r) => ({
        name: r.name,
        totalAed: parseFloat(r.total_aed),
        transactionCount: parseInt(r.transaction_count),
      })),
    });
  } catch (error) {
    console.error("spendingByCardholder error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const spendingByDepartment = async (req, res) => {
  try {
    const { year, month } = req.query;
    const result = await pool.query(
      `SELECT
         t.department                AS name,
         COALESCE(SUM(t.amount_aed), 0) AS total_aed,
         COUNT(*)                    AS transaction_count
       FROM transactions t
       WHERE t.is_active = true
         ${dateFilter(year, month)}
       GROUP BY t.department
       ORDER BY total_aed DESC`
    );

    return res.json({
      success: true,
      data: result.rows.map((r) => ({
        name: r.name,
        totalAed: parseFloat(r.total_aed),
        transactionCount: parseInt(r.transaction_count),
      })),
    });
  } catch (error) {
    console.error("spendingByDepartment error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const spendingByVendor = async (req, res) => {
  try {
    const { year, month } = req.query;
    const result = await pool.query(
      `SELECT
         t.vendor_name               AS name,
         COALESCE(SUM(t.amount_aed), 0) AS total_aed,
         COUNT(*)                    AS transaction_count
       FROM transactions t
       WHERE t.is_active = true
         ${dateFilter(year, month)}
       GROUP BY t.vendor_name
       ORDER BY total_aed DESC`
    );

    return res.json({
      success: true,
      data: result.rows.map((r) => ({
        name: r.name,
        totalAed: parseFloat(r.total_aed),
        transactionCount: parseInt(r.transaction_count),
      })),
    });
  } catch (error) {
    console.error("spendingByVendor error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const spendingByBudgetItem = async (req, res) => {
  try {
    const { year, month } = req.query;
    const result = await pool.query(
      `SELECT
         b.item_name                 AS name,
         COALESCE(SUM(t.amount_aed), 0) AS total_aed,
         COUNT(t.transaction_id)     AS transaction_count
       FROM budget_items b
       LEFT JOIN transactions t
         ON t.budget_item_id = b.budget_item_id
        AND t.is_active = true
        ${dateFilter(year, month)}
       WHERE b.is_active = true
       GROUP BY b.item_name
       ORDER BY total_aed DESC`
    );

    return res.json({
      success: true,
      data: result.rows.map((r) => ({
        name: r.name,
        totalAed: parseFloat(r.total_aed),
        transactionCount: parseInt(r.transaction_count),
      })),
    });
  } catch (error) {
    console.error("spendingByBudgetItem error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  spendingByCategory,
  spendingByCardholder,
  spendingByDepartment,
  spendingByVendor,
  spendingByBudgetItem,
};
