const pool = require("../db/pool");

const resolveFlag = async (req, res) => {
  try {
    const { flagId } = req.params;

    const result = await pool.query(
      `UPDATE flags SET resolved = TRUE WHERE flag_id = $1 RETURNING *`,
      [flagId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Flag not found" });
    }

    return res.status(200).json({ success: true, flag: result.rows[0] });
  } catch (error) {
    console.error("resolveFlag error:", error);
    return res.status(500).json({ success: false, message: "Failed to resolve flag" });
  }
};

module.exports = { resolveFlag };
