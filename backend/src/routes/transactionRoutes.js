const express = require("express");
const router = express.Router();

const {
  createTransaction,
  getTransactionsByCardholder,
} = require("../controllers/transactionController");

router.post("/final-submit", createTransaction);
router.get("/cardholder/:cardholderId", getTransactionsByCardholder);

module.exports = router;
