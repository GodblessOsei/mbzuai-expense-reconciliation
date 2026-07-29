const express = require("express");
const router = express.Router();

const requireAuth = require("../middleware/requireAuth");
const {
  login,
  getMe,
  changePassword,
} = require("../controllers/authController");

// Public — this is the one door into the system, so it cannot sit behind
// requireAuth. Mounted in app.js BEFORE the global guard for that reason.
router.post("/login", login);

// Signed-in, any role.
router.get("/me", requireAuth, getMe);
router.post("/change-password", requireAuth, changePassword);

module.exports = router;
