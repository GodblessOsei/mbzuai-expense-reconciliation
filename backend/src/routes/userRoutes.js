const express = require("express");
const router = express.Router();

const requireRole = require("../middleware/requireRole");
const {
  getUsers,
  createUser,
  deactivateUser,
  reactivateUser,
  resetUserPassword,
} = require("../controllers/userController");

// requireAuth is already applied globally in app.js. Administering people is
// manager work, so the whole router is gated in one place rather than
// route by route.
router.use(requireRole("manager"));

router.get("/", getUsers);
router.post("/", createUser);
router.patch("/:userId/deactivate", deactivateUser);
router.patch("/:userId/reactivate", reactivateUser);
router.post("/:userId/reset-password", resetUserPassword);

module.exports = router;
