const express = require("express");
const router = express.Router();

const {
  getBudgetItems,
  getAllBudgetItems,
  createBudgetItem,
  updateBudgetItem,
} = require("../controllers/budgetItemController");

router.get("/", getBudgetItems);
router.get("/all", getAllBudgetItems);
router.post("/", createBudgetItem);
router.patch("/:id", updateBudgetItem);

module.exports = router;