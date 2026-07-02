const express = require("express");
const router = express.Router();

const {
  createTransaction,
  getTransactionsByCardholder,
  getAllTransactions,
  generateTransactionPdf,
  getTransactionPdf,
  getTransactionFlags,
  updateTransactionStatus,
  updateTransaction,
  deleteTransaction,
} = require("../controllers/transactionController");

router.post("/final-submit", createTransaction);
router.get("/", getAllTransactions);
router.get("/cardholder/:cardholderId", getTransactionsByCardholder);
router.post("/:id/generate-pdf", generateTransactionPdf);
router.get("/:id/pdf", getTransactionPdf);
router.get("/:id/flags", getTransactionFlags);
router.patch("/:id/delete", deleteTransaction);
router.patch("/:id/status", updateTransactionStatus);
router.patch("/:id", updateTransaction);

module.exports = router;
 