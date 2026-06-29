const express = require("express");
const router = express.Router();

const {
  getReconciliationPeriods,
} = require("../controllers/reconciliationPeriodController");

router.get("/", getReconciliationPeriods);

module.exports = router;
