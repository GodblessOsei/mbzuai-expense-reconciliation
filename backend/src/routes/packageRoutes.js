const express = require("express");
const router = express.Router();
const { getCurrentPeriod, downloadPackage } = require("../controllers/packageController");

router.get("/current-period", getCurrentPeriod);
router.post("/download", downloadPackage);

module.exports = router;
