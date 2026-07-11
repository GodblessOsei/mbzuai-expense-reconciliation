const express = require("express");
const router = express.Router();

const {getBudgetItems} = require("../controllers/budgetItemController");

router.get("/", getBudgetItems);

module.exports = router;