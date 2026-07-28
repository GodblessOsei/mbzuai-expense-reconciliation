const pool = require("../db/pool");

const dateFilter = (column, year, month) => {
  const clauses = [];
  if (year) clauses.push(`EXTRACT(YEAR FROM ${column}) = ${parseInt(year, 10)}`);
  if (month) clauses.push(`EXTRACT(MONTH FROM ${column}) = ${parseInt(month, 10)}`);
  return clauses.length ? `AND ${clauses.join(" AND ")}` : "";
};

// Spending by category/department/vendor/purchase-for combines prepaid-card
// transactions with additional_spending (e.g. cash/other payment methods),
// so these totals reconcile with the Annual/Monthly budget "actual" figures.
// Cardholder breakdown stays transactions-only: additional_spending isn't
// tied to a specific cardholder.
const spendingByCategory = async (req, res) => {
  try {
    const { year, month } = req.query;
    const result = await pool.query(
      `WITH combined AS (
         SELECT category, amount_aed FROM transactions
         WHERE is_active = true ${dateFilter("purchase_date", year, month)}
         UNION ALL
         SELECT category, amount_aed FROM additional_spending
         WHERE true ${dateFilter("date", year, month)}
       )
       SELECT
         category                    AS name,
         COALESCE(SUM(amount_aed), 0) AS total_aed,
         COUNT(*)                    AS transaction_count
       FROM combined
       GROUP BY category
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
         ${dateFilter("t.purchase_date", year, month)}
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
      `WITH combined AS (
         SELECT department, amount_aed FROM transactions
         WHERE is_active = true ${dateFilter("purchase_date", year, month)}
         UNION ALL
         SELECT department, amount_aed FROM additional_spending
         WHERE true ${dateFilter("date", year, month)}
       )
       SELECT
         department                  AS name,
         COALESCE(SUM(amount_aed), 0) AS total_aed,
         COUNT(*)                    AS transaction_count
       FROM combined
       GROUP BY department
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
      `WITH combined AS (
         SELECT vendor_name, amount_aed FROM transactions
         WHERE is_active = true ${dateFilter("purchase_date", year, month)}
         UNION ALL
         SELECT vendor_name, amount_aed FROM additional_spending
         WHERE true ${dateFilter("date", year, month)}
       )
       SELECT
         vendor_name                 AS name,
         COALESCE(SUM(amount_aed), 0) AS total_aed,
         COUNT(*)                    AS transaction_count
       FROM combined
       GROUP BY vendor_name
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
      `WITH combined AS (
         SELECT budget_item_id, amount_aed FROM transactions
         WHERE is_active = true ${dateFilter("purchase_date", year, month)}
         UNION ALL
         SELECT budget_item_id, amount_aed FROM additional_spending
         WHERE true ${dateFilter("date", year, month)}
       )
       SELECT
         b.item_name                 AS name,
         COALESCE(SUM(c.amount_aed), 0) AS total_aed,
         COUNT(c.amount_aed)         AS transaction_count
       FROM budget_items b
       LEFT JOIN combined c ON c.budget_item_id = b.budget_item_id
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
