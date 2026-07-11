const pool = require("../db/pool");

// --- ANNUAL BUDGET ---

const getAnnualBudget = async (req, res) => {
  try {
    const { year } = req.params;

    const result = await pool.query(
      `SELECT
         b.budget_id,
         b.year,
         b.planned_amount,
         COALESCE(SUM(t.amount_aed), 0) AS actual_amount
       FROM budgets b
       LEFT JOIN transactions t
         ON EXTRACT(YEAR FROM t.purchase_date) = b.year
        AND t.is_active = true
       WHERE b.year = $1
       GROUP BY b.budget_id`,
      [year]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "No budget found for this year" });
    }

    const row = result.rows[0];
    return res.json({
      success: true,
      budget: {
        budgetId: row.budget_id,
        year: row.year,
        plannedAmount: row.planned_amount,
        actualAmount: row.actual_amount,
        remainingAmount: row.planned_amount - row.actual_amount,
        percentageSpent:
          row.planned_amount > 0
            ? ((row.actual_amount / row.planned_amount) * 100).toFixed(1)
            : "0.0",
      },
    });
  } catch (error) {
    console.error("getAnnualBudget error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const setAnnualBudget = async (req, res) => {
  try {
    const { year, planned_amount } = req.body;

    if (!year || !planned_amount) {
      return res.status(400).json({ success: false, message: "year and planned_amount are required" });
    }

    const result = await pool.query(
      `INSERT INTO budgets (year, planned_amount)
       VALUES ($1, $2)
       ON CONFLICT (year) DO UPDATE SET planned_amount = EXCLUDED.planned_amount
       RETURNING *`,
      [year, planned_amount]
    );

    const row = result.rows[0];
    return res.status(201).json({
      success: true,
      budget: {
        budgetId: row.budget_id,
        year: row.year,
        plannedAmount: row.planned_amount,
      },
    });
  } catch (error) {
    console.error("setAnnualBudget error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// --- MONTHLY BUDGETS ---

const getMonthlyBudgets = async (req, res) => {
  try {
    const { year } = req.params;

    const result = await pool.query(
      `SELECT
         mb.monthly_budget_id,
         mb.year,
         mb.month,
         mb.planned_amount,
         COALESCE(SUM(t.amount_aed), 0) AS actual_amount
       FROM monthly_budgets mb
       LEFT JOIN transactions t
         ON EXTRACT(YEAR  FROM t.purchase_date) = mb.year
        AND EXTRACT(MONTH FROM t.purchase_date) = mb.month
        AND t.is_active = true
       WHERE mb.year = $1
       GROUP BY mb.monthly_budget_id
       ORDER BY mb.month`,
      [year]
    );

    const months = result.rows.map((row) => ({
      monthlyBudgetId: row.monthly_budget_id,
      year: row.year,
      month: row.month,
      plannedAmount: row.planned_amount,
      actualAmount: row.actual_amount,
      variance: row.planned_amount - row.actual_amount,
    }));

    return res.json({ success: true, months });
  } catch (error) {
    console.error("getMonthlyBudgets error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const setMonthlyBudget = async (req, res) => {
  try {
    const { year } = req.params;
    const { month, planned_amount } = req.body;

    if (!month || !planned_amount) {
      return res.status(400).json({ success: false, message: "month and planned_amount are required" });
    }

    const result = await pool.query(
      `INSERT INTO monthly_budgets (year, month, planned_amount)
       VALUES ($1, $2, $3)
       ON CONFLICT (year, month) DO UPDATE SET planned_amount = EXCLUDED.planned_amount
       RETURNING *`,
      [year, month, planned_amount]
    );

    const row = result.rows[0];
    return res.status(201).json({
      success: true,
      monthlyBudget: {
        monthlyBudgetId: row.monthly_budget_id,
        year: row.year,
        month: row.month,
        plannedAmount: row.planned_amount,
      },
    });
  } catch (error) {
    console.error("setMonthlyBudget error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  getAnnualBudget,
  setAnnualBudget,
  getMonthlyBudgets,
  setMonthlyBudget,
};
