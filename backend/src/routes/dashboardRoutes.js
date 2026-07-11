const express = require("express");
const router = express.Router();
const {
  spendingByCategory,
  spendingByCardholder,
  spendingByDepartment,
  spendingByVendor,
  spendingByEvent,
} = require("../controllers/dashboardController");

router.get("/spending-by-category",    spendingByCategory);
router.get("/spending-by-cardholder",  spendingByCardholder);
router.get("/spending-by-department",  spendingByDepartment);
router.get("/spending-by-vendor",      spendingByVendor);
router.get("/spending-by-event",       spendingByEvent);

module.exports = router;
