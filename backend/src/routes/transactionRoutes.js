const express = require("express");
const router = express.Router();

const requireRole = require("../middleware/requireRole");
const {
  createTransaction,
  getMyTransactions,
  getTransactionsByCardholder,
  getAllTransactions,
  generateTransactionPdf,
  getTransactionPdf,
  getTransactionFlags,
  updateTransactionStatus,
  updateTransaction,
  deleteTransaction,
  getTransactionAuditLogs,
} = require("../controllers/transactionController");

// requireAuth is applied globally in app.js, so req.user exists on every route
// below.

// ---- Any signed-in user --------------------------------------------------
router.post("/final-submit", createTransaction);

// An RLA's own view: everything they submitted, plus everything charged to the
// card they hold. Scoped server-side from the session, so there is no id in
// the path for anyone to change.
router.get("/mine", getMyTransactions);

router.get("/:id/flags", getTransactionFlags);

// ---- Manager only --------------------------------------------------------
// The full ledger, the receipt archive and every edit path. PDF view/download
// is manager-only by client rule; enforcing it here rather than by hiding a
// button is the difference between a rule and a guarantee.
router.get("/", requireRole("manager"), getAllTransactions);
router.get(
  "/cardholder/:cardholderId",
  requireRole("manager"),
  getTransactionsByCardholder
);
router.post("/:id/generate-pdf", requireRole("manager"), generateTransactionPdf);
router.get("/:id/pdf", requireRole("manager"), getTransactionPdf);
router.get("/:id/audit-logs", requireRole("manager"), getTransactionAuditLogs);
router.patch("/:id/delete", requireRole("manager"), deleteTransaction);
router.patch("/:id/status", requireRole("manager"), updateTransactionStatus);
router.patch("/:id", requireRole("manager"), updateTransaction);

module.exports = router;
