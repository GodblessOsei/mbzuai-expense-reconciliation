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

// includes inactive items too, for the manager management page
const getAllBudgetItems = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT budget_item_id, item_name, is_active
            FROM budget_items
            ORDER BY item_name ASC`
        );
        return res.status(200).json({
            success: true,
            budgetItems: result.rows,
        });
    } catch (error) {
        console.error("getAllBudgetItems error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch budget items",
        });
    }
};

const createBudgetItem = async (req, res) => {
    try {
        const { item_name } = req.body;

        if (!item_name || !item_name.trim()) {
            return res.status(400).json({ success: false, message: "item_name is required" });
        }

        const result = await pool.query(
            `INSERT INTO budget_items (item_name, is_active)
             VALUES ($1, TRUE)
             RETURNING budget_item_id, item_name, is_active`,
            [item_name.trim()]
        );

        return res.status(201).json({ success: true, budgetItem: result.rows[0] });
    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({ success: false, message: "A budget item with this name already exists" });
        }
        console.error("createBudgetItem error:", error);
        return res.status(500).json({ success: false, message: "Failed to create budget item" });
    }
};

const updateBudgetItem = async (req, res) => {
    try {
        const { id } = req.params;
        const { item_name, is_active } = req.body;

        if (item_name === undefined && is_active === undefined) {
            return res.status(400).json({ success: false, message: "Nothing to update" });
        }

        const fields = [];
        const values = [];
        if (item_name !== undefined) {
            fields.push(`item_name = $${fields.length + 1}`);
            values.push(item_name.trim());
        }
        if (is_active !== undefined) {
            fields.push(`is_active = $${fields.length + 1}`);
            values.push(is_active);
        }
        values.push(id);

        const result = await pool.query(
            `UPDATE budget_items SET ${fields.join(", ")}
             WHERE budget_item_id = $${values.length}
             RETURNING budget_item_id, item_name, is_active`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Budget item not found" });
        }

        return res.status(200).json({ success: true, budgetItem: result.rows[0] });
    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({ success: false, message: "A budget item with this name already exists" });
        }
        console.error("updateBudgetItem error:", error);
        return res.status(500).json({ success: false, message: "Failed to update budget item" });
    }
};

module.exports = {
    getBudgetItems,
    getAllBudgetItems,
    createBudgetItem,
    updateBudgetItem,
};