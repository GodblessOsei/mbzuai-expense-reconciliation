const express = require("express");
const router = express.Router();
const upload = require("../config/multer");
const { uploadReceipts } = require("../controllers/uploadController");

// POST /api/uploads  — "files" is the field name the frontend must use
router.post("/", upload.array("files"), uploadReceipts);

module.exports = router;
