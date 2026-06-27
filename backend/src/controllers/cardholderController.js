const pool = require("../db/pool");

const getCardholders = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT cardholder_id, cardholder_name FROM cardholders ORDER BY cardholder_id`
    );
    res.status(200).json({ success: true, cardholders: result.rows });
  } catch (error) {
    console.error(error.message);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch cardholders" });
  }
};

module.exports = { getCardholders };
