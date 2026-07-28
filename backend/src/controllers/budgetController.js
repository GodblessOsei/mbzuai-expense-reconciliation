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
         COALESCE(
           (SELECT SUM(amount_aed) FROM transactions
             WHERE is_active = true AND EXTRACT(YEAR FROM purchase_date) = b.year), 0
         ) + COALESCE(
           (SELECT SUM(amount_aed) FROM additional_spending
             WHERE EXTRACT(YEAR FROM date) = b.year), 0
         ) AS actual_amount
       FROM budgets b
       WHERE b.year = $1`,
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
      `WITH activity_months AS (
         SELECT DISTINCT EXTRACT(MONTH FROM purchase_date)::int AS month
         FROM transactions
         WHERE is_active = true AND EXTRACT(YEAR FROM purchase_date) = $1
         UNION
         SELECT DISTINCT EXTRACT(MONTH FROM date)::int AS month
         FROM additional_spending
         WHERE EXTRACT(YEAR FROM date) = $1
       ),
       relevant_months AS (
         SELECT month FROM activity_months
         UNION
         SELECT month FROM monthly_budgets WHERE year = $1
       ),
       transaction_totals AS (
         SELECT EXTRACT(MONTH FROM purchase_date)::int AS month, SUM(amount_aed) AS total
         FROM transactions
         WHERE is_active = true AND EXTRACT(YEAR FROM purchase_date) = $1
         GROUP BY 1
       ),
       additional_totals AS (
         SELECT EXTRACT(MONTH FROM date)::int AS month, SUM(amount_aed) AS total
         FROM additional_spending
         WHERE EXTRACT(YEAR FROM date) = $1
         GROUP BY 1
       )
       SELECT
         mb.monthly_budget_id,
         $1::int                                            AS year,
         rm.month,
         COALESCE(mb.planned_amount, 0)                      AS planned_amount,
         COALESCE(tt.total, 0) + COALESCE(at.total, 0)        AS actual_amount
       FROM relevant_months rm
       LEFT JOIN monthly_budgets mb
         ON mb.year = $1 AND mb.month = rm.month
       LEFT JOIN transaction_totals tt ON tt.month = rm.month
       LEFT JOIN additional_totals  at ON at.month = rm.month
       ORDER BY rm.month`,
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
