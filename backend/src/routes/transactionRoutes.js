const express = require("express");
const router = express.Router();

const {
  createTransaction,
  getTransactionsByCardholder,
  getAllTransactions,
  generateTransactionPdf,
  getTransactionPdf,
} = require("../controllers/transactionController");

router.post("/final-submit", createTransaction);
router.get("/", getAllTransactions);
router.get("/cardholder/:cardholderId", getTransactionsByCardholder);
router.post("/:id/generate-pdf", generateTransactionPdf);
router.get("/:id/pdf", getTransactionPdf);

module.exports = router;
