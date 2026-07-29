// Manager-only administration of people.
//
// Every route here sits behind requireRole("manager"). Managers are exact
// peers: any manager may add, deactivate or reset any other, including each
// other. That is deliberate -- they all have identical access already, so
// there is no privilege for one to escalate to, and it removes the
// single-administrator bottleneck when someone is locked out.

const pool = require("../db/pool");
const authService = require("../services/authService");

const VALID_ROLES = ["rla", "manager"];

// Naive on purpose: this catches typos, it is not trying to prove an address
// is deliverable. There is no mail being sent.
const looksLikeEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// GET /api/users?role=rla&active=true
const getUsers = async (req, res) => {
  try {
    const { role, active } = req.query;

    const conditions = [];
    const values = [];

    if (role) {
      values.push(role);
      conditions.push(`u.role = $${values.length}`);
    }
    if (active === "true" || active === "false") {
      values.push(active === "true");
      conditions.push(`u.is_active = $${values.length}`);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    // The card each person currently holds comes along for the ride so the
    // admin screen can show "Jose — card 8593" in one request.
    const result = await pool.query(
      `SELECT u.user_id, u.full_name, u.email, u.role, u.is_active,
              u.must_change_password, u.created_at, u.deactivated_at,
              c.cardholder_id, c.cardholder_name, c.last_four_digits
         FROM users u
         LEFT JOIN cardholders c
           ON c.assigned_user_id = u.user_id AND c.is_active = TRUE
         ${whereClause}
         ORDER BY u.is_active DESC, u.role, u.full_name`,
      values
    );

    return res.status(200).json({
      success: true,
      users: result.rows.map((row) => ({
        userId: row.user_id,
        fullName: row.full_name,
        email: row.email,
        role: row.role,
        isActive: row.is_active,
        mustChangePassword: row.must_change_password,
        createdAt: row.created_at,
        deactivatedAt: row.deactivated_at,
        assignedCard: row.cardholder_id
          ? {
              cardholderId: row.cardholder_id,
              cardholderName: row.cardholder_name,
              lastFourDigits: row.last_four_digits,
            }
          : null,
      })),
    });
  } catch (error) {
    console.error("getUsers error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch users" });
  }
};

// POST /api/users
// Creates the person and returns a one-time temporary password for the manager
// to hand over. There is no mail server, so the manager IS the delivery
// mechanism -- which works because this is a handful of people in one building
// who know each other by sight.
const createUser = async (req, res) => {
  try {
    // A new RLA arrives with either a card already in the system, or a brand
    // new one the manager types the last four digits of. Cards are not a fixed
    // pool -- there is no cap, so adding an RLA is never blocked on supply.
    const { fullName, email, role, cardholderId, newCardLastFour } = req.body;

    if (!fullName || !email || !role) {
      return res.status(400).json({
        success: false,
        message: "Full name, email and role are required",
      });
    }

    if (!VALID_ROLES.includes(role)) {
      return res
        .status(400)
        .json({ success: false, message: "Role must be 'rla' or 'manager'" });
    }

    // Cards belong to RLAs and only to RLAs. An RLA cannot exist without one --
    // they are the people who spend, and the card is what they spend on.
    // Managers review and administer; they never hold a prepaid card.
    if (role === "rla" && !cardholderId && !newCardLastFour) {
      return res.status(400).json({
        success: false,
        message: "An RLA must be given a card",
      });
    }

    if (role === "manager" && (cardholderId || newCardLastFour)) {
      return res.status(400).json({
        success: false,
        message: "Managers do not hold prepaid cards",
      });
    }

    if (newCardLastFour && !/^\d{4}$/.test(String(newCardLastFour))) {
      return res.status(400).json({
        success: false,
        message: "Enter exactly the last four digits of the new card",
      });
    }

    const normalizedEmail = authService.normalizeEmail(email);
    if (!looksLikeEmail(normalizedEmail)) {
      return res
        .status(400)
        .json({ success: false, message: "That does not look like an email address" });
    }

    const existing = await authService.findUserByEmail(normalizedEmail);
    if (existing) {
      // Deliberately explicit here, unlike login: a manager adding someone
      // needs to know the account already exists, and they are already trusted.
      return res.status(409).json({
        success: false,
        message: existing.is_active
          ? "Someone with that email already exists"
          : "A deactivated account with that email exists — reactivate it instead",
      });
    }

    // Check the card BEFORE creating anyone. Creating the account first and
    // then discovering the card is unusable would leave a cardless RLA behind
    // -- exactly the state this endpoint refuses to create.
    if (cardholderId) {
      const card = await pool.query(
        `SELECT c.is_active, u.full_name AS holder_name, u.is_active AS holder_active,
                c.last_four_digits
           FROM cardholders c
           LEFT JOIN users u ON u.user_id = c.assigned_user_id
          WHERE c.cardholder_id = $1`,
        [cardholderId]
      );

      if (card.rows.length === 0) {
        return res.status(404).json({ success: false, message: "Card not found" });
      }

      const { is_active, holder_name, holder_active, last_four_digits } = card.rows[0];

      if (!is_active) {
        return res
          .status(400)
          .json({ success: false, message: "That card has been retired" });
      }
      if (holder_name && holder_active) {
        return res.status(409).json({
          success: false,
          message: `Card ${last_four_digits} is held by ${holder_name}. Switch them off, or give them a different card, to free it.`,
        });
      }
    }

    if (newCardLastFour) {
      const duplicate = await pool.query(
        `SELECT is_active FROM cardholders WHERE last_four_digits = $1`,
        [newCardLastFour]
      );
      if (duplicate.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: duplicate.rows[0].is_active
            ? `A card ending ${newCardLastFour} is already registered — pick it from the list instead`
            : `A retired card ending ${newCardLastFour} exists`,
        });
      }
    }

    const temporaryPassword = authService.generateTemporaryPassword();

    const result = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role, must_change_password)
       VALUES ($1, $2, $3, $4, TRUE)
       RETURNING *`,
      [
        String(fullName).trim(),
        normalizedEmail,
        await authService.hashPassword(temporaryPassword),
        role,
      ]
    );

    const user = result.rows[0];

    // cardholder_name follows the holder in both branches -- it is the name
    // spreadsheets and packages print, so a card must never keep a stale label.
    if (newCardLastFour) {
      await pool.query(
        `INSERT INTO cardholders (cardholder_name, last_four_digits, assigned_user_id, assigned_at)
         VALUES ($1, $2, $3, CURRENT_DATE)`,
        [user.full_name, newCardLastFour, user.user_id]
      );
    } else if (cardholderId) {
      await pool.query(
        `UPDATE cardholders
            SET assigned_user_id = $1,
                assigned_at      = CURRENT_DATE,
                cardholder_name  = $2
          WHERE cardholder_id = $3`,
        [user.user_id, user.full_name, cardholderId]
      );
    }

    return res.status(201).json({
      success: true,
      user: authService.toPublicUser(user),
      // Shown once, never retrievable again -- only the hash is stored.
      temporaryPassword,
    });
  } catch (error) {
    console.error("createUser error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create user" });
  }
};

// PATCH /api/users/:userId/deactivate
// Switching someone OFF, never deleting them. Transactions and audit_logs
// reference user_id, so a delete would either fail on the constraint or
// quietly rewrite financial history. Everything they submitted stays exactly
// as it was, with their name on it.
const deactivateUser = async (req, res) => {
  try {
    const userId = Number(req.params.userId);

    // This single check is also the lockout guard, which is worth spelling out
    // because it looks like it only covers a self-inflicted mistake.
    //
    // requireRole guarantees the caller is an active manager. So whenever a
    // manager is being deactivated, the caller is a DIFFERENT active manager
    // who survives the operation -- there is always at least one manager left
    // standing. The system cannot be locked out through this endpoint, and a
    // separate "is this the last manager?" count would be unreachable code.
    if (userId === req.user.userId) {
      return res.status(400).json({
        success: false,
        message: "You cannot deactivate your own account",
      });
    }

    const target = await authService.findUserById(userId);
    if (!target) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const result = await pool.query(
      `UPDATE users
          SET is_active = FALSE, deactivated_at = NOW()
        WHERE user_id = $1
        RETURNING *`,
      [userId]
    );

    // RELEASE the card, do not retire it. Those are different things:
    // retiring destroys a card's future, releasing just hands it back so the
    // replacement RLA can be given it. The card keeps its number, its limit
    // and every transaction ever charged to it.
    //
    // Without this, a departed RLA's card stays bound to a disabled account
    // and their successor cannot be created at all -- an RLA must have a card.
    const released = await pool.query(
      `UPDATE cardholders
          SET assigned_user_id = NULL,
              assigned_at      = NULL,
              -- Reset the label too, exactly as assignCardholder does on
              -- release, so a departed person's name does not linger on a
              -- free card in the "give them a card" list.
              cardholder_name  = 'Card ' || last_four_digits
        WHERE assigned_user_id = $1
        RETURNING last_four_digits`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      message: released.rows.length
        ? `User deactivated — card ${released.rows[0].last_four_digits} is now free to reassign`
        : "User deactivated",
      user: authService.toPublicUser(result.rows[0]),
      releasedCards: released.rows.map((r) => r.last_four_digits),
    });
  } catch (error) {
    console.error("deactivateUser error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to deactivate user" });
  }
};

// PATCH /api/users/:userId/reactivate
const reactivateUser = async (req, res) => {
  try {
    const userId = Number(req.params.userId);

    const result = await pool.query(
      `UPDATE users
          SET is_active = TRUE, deactivated_at = NULL
        WHERE user_id = $1
        RETURNING *`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.status(200).json({
      success: true,
      message: "User reactivated",
      user: authService.toPublicUser(result.rows[0]),
    });
  } catch (error) {
    console.error("reactivateUser error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to reactivate user" });
  }
};

// POST /api/users/:userId/reset-password
// The reset path for everyone. RLAs are reset by a manager; managers are reset
// by each other. No current password is required because the manager is not
// proving they are the target -- they are an administrator acting on someone
// else's account, and every manager already has full access to everything.
const resetUserPassword = async (req, res) => {
  try {
    const userId = Number(req.params.userId);

    const target = await authService.findUserById(userId);
    if (!target) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const temporaryPassword = authService.generateTemporaryPassword();

    await pool.query(
      `UPDATE users
          SET password_hash = $1, must_change_password = TRUE
        WHERE user_id = $2`,
      [await authService.hashPassword(temporaryPassword), userId]
    );

    return res.status(200).json({
      success: true,
      message: `Temporary password issued for ${target.full_name}`,
      temporaryPassword,
    });
  } catch (error) {
    console.error("resetUserPassword error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to reset password" });
  }
};

module.exports = {
  getUsers,
  createUser,
  deactivateUser,
  reactivateUser,
  resetUserPassword,
};
