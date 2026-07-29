// Establishes WHAT the signed-in person may do.
//
// Always mounted after requireAuth, which is what puts req.user there.
//
// All managers see exactly the same thing -- there is no per-manager scoping
// anywhere in this system. So this is a single global gate, not the start of a
// permissions matrix.

const requireRole =
  (...allowedRoles) =>
  (req, res, next) => {
    if (!req.user) {
      // Only reachable if this is mounted before requireAuth -- a wiring bug,
      // not a user error, so it is worth shouting about in the log.
      console.error(
        "requireRole was reached without req.user — check middleware order in app.js"
      );
      return res
        .status(401)
        .json({ success: false, message: "Sign in to continue" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this",
      });
    }

    return next();
  };

module.exports = requireRole;
