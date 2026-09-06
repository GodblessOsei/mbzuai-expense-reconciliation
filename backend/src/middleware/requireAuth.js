// Establishes WHO is making this request.
//
// Mounted once in app.js across the whole /api surface, so every route added
// from now on is protected by default and has to opt out to be public.
// Guarding routes one at a time means the next route someone adds is public
// until they remember -- that difference is the entire security posture.

const authService = require("../services/authService");

const requireAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "Sign in to continue" });
    }

    let payload;
    try {
      payload = authService.verifyToken(token);
    } catch (error) {
      // Expired or tampered-with. Not a server fault, so no error log --
      // this fires routinely whenever a token ages out.
      return res
        .status(401)
        .json({ success: false, message: "Your session has expired" });
    }

    // Re-read the user on every request rather than trusting the token's copy.
    // Costs one indexed lookup and makes deactivation instant instead of
    // "whenever their token happens to expire".
    const user = await authService.findUserById(payload.userId);

    if (!user || !user.is_active) {
      return res
        .status(401)
        .json({ success: false, message: "This account is no longer active" });
    }

    req.user = {
      userId: user.user_id,
      fullName: user.full_name,
      username: user.username,
      role: user.role,
      mustChangePassword: user.must_change_password,
    };

    return next();
  } catch (error) {
    console.error("requireAuth error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Could not verify your session" });
  }
};

module.exports = requireAuth;
