const express = require("express");
const router = express.Router();

const { createTransaction } = require("../controllers/transactionController");

router.post("/final-submit", createTransaction);

module.exports = router;