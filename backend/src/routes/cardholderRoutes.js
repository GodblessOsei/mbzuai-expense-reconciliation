const express = require("express");
const router = express.Router();

const requireRole = require("../middleware/requireRole");
const {
  getCardholders,
  createCardholder,
  assignCardholder,
  deactivateCardholder,
} = require("../controllers/cardholderController");

// Any signed-in user. RLAs need the FULL list to pick whose card they used.
router.get("/", getCardholders);

// Registering, handing out and retiring cards is manager work.
router.post("/", requireRole("manager"), createCardholder);
router.patch("/:cardholderId/assign", requireRole("manager"), assignCardholder);
router.patch(
  "/:cardholderId/deactivate",
  requireRole("manager"),
  deactivateCardholder
);

module.exports = router;
