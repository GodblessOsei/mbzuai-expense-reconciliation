const pool = require("../db/pool");

const getBudgetItems = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT budget_item_id, item_name
            FROM budget_items
            WHERE is_active = TRUE
            ORDER BY item_name ASC`
        );
        return res.status(200).json({
            success: true,
            budgetItems: result.rows,
        });
    } catch (error) {
        console.error(error.message);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch budget items",
        });
    }
};

module.exports = {
    getBudgetItems,
};