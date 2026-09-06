const pool = require("../db/pool");
const authService = require("../services/authService");

const MIN_PASSWORD_LENGTH = 8;

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Username and password are required" });
    }

    const user = await authService.findUserByUsername(username);

    // One message for "no such account", "wrong password" and "deactivated".
    // Distinguishing them tells an outsider which usernames are real accounts.
    const rejection = {
      success: false,
      message: "Incorrect username or password",
    };

    if (!user || !user.is_active) {
      return res.status(401).json(rejection);
    }

    const passwordMatches = await authService.verifyPassword(
      password,
      user.password_hash
    );
    if (!passwordMatches) {
      return res.status(401).json(rejection);
    }

    return res.status(200).json({
      success: true,
      token: authService.signToken(user),
      user: authService.toPublicUser(user),
      assignedCard: await authService.findAssignedCard(user.user_id),
    });
  } catch (error) {
    console.error("login error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Could not sign you in" });
  }
};

// GET /api/auth/me
// The frontend calls this on every page load to rehydrate from a stored token.
// This is what makes a signed-in session survive a browser refresh.
const getMe = async (req, res) => {
  try {
    const user = await authService.findUserById(req.user.userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Account not found" });
    }

    return res.status(200).json({
      success: true,
      user: authService.toPublicUser(user),
      assignedCard: await authService.findAssignedCard(user.user_id),
    });
  } catch (error) {
    console.error("getMe error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Could not load your account" });
  }
};

// POST /api/auth/change-password
// Changing your OWN password, which is why it demands the current one. A
// manager resetting SOMEONE ELSE's password is a different endpoint
// (userController.resetUserPassword) and deliberately cannot be reached here.
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current and new password are both required",
      });
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `New password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      });
    }

    const user = await authService.findUserById(req.user.userId);

    const currentMatches = await authService.verifyPassword(
      currentPassword,
      user.password_hash
    );
    if (!currentMatches) {
      return res
        .status(401)
        .json({ success: false, message: "Current password is incorrect" });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from the current one",
      });
    }

    await pool.query(
      `UPDATE users
          SET password_hash = $1, must_change_password = FALSE
        WHERE user_id = $2`,
      [await authService.hashPassword(newPassword), req.user.userId]
    );

    return res
      .status(200)
      .json({ success: true, message: "Password updated" });
  } catch (error) {
    console.error("changePassword error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Could not update your password" });
  }
};

module.exports = { login, getMe, changePassword };
