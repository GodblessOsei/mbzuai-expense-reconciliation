const express = require("express");
const router = express.Router();

const {extractReceipt} = require("../controllers/ocrController");

router.post("/extract", extractReceipt);

module.exports = router;