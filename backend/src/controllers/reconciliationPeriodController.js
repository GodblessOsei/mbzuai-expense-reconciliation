const pool = require("../db/pool");

const getReconciliationPeriods = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT reconciliation_period_id, start_date, end_date
       FROM reconciliation_periods
       ORDER BY end_date ASC`
    );
    return res.status(200).json({ success: true, periods: result.rows });
  } catch (error) {
    console.error(error.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch periods" });
  }
};

module.exports = { getReconciliationPeriods };
