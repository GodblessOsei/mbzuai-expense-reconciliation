const express = require("express");
const router = express.Router();

const { previewPackage, generateSpreadsheet, downloadSpreadsheet } = require("../controllers/spreadsheetController");

router.get("/preview", previewPackage);
router.post("/generate", generateSpreadsheet);
router.get("/download/:filename", downloadSpreadsheet);

module.exports = router;
