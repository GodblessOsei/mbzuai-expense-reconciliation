const express = require("express");
const router = express.Router();
const {
  createAdditionalSpending,
  getAdditionalSpending,
} = require("../controllers/additionalSpendingController");

router.post("/", createAdditionalSpending);
router.get("/", getAdditionalSpending);

module.exports = router;
