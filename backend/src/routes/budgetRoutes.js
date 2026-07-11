const express = require("express");
const router = express.Router();
const {
  getAnnualBudget,
  setAnnualBudget,
  getMonthlyBudgets,
  setMonthlyBudget,
} = require("../controllers/budgetController");

// Annual
router.get("/:year", getAnnualBudget);
router.post("/", setAnnualBudget);

// Monthly
router.get("/:year/monthly", getMonthlyBudgets);
router.post("/:year/monthly", setMonthlyBudget);

module.exports = router;
