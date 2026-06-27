const express = require("express");
const router = express.Router();
const { getCardholders } = require("../controllers/cardholderController");

router.get("/", getCardholders); // GET /api/cardholders

module.exports = router;
