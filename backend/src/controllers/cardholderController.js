const pool = require("../db/pool");

// GET /api/cardholders
// EVERY active card, for EVERY signed-in user. This is not an oversight: the
// client is explicit that RLAs may spend on each other's cards, so this list
// feeds the "whose card did you use?" picker on the submission form and must
// never be filtered by who is asking.
const getCardholders = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.cardholder_id, c.cardholder_name, c.last_four_digits,
              c.assigned_user_id, u.full_name AS assigned_user_name
         FROM cardholders c
         LEFT JOIN users u ON u.user_id = c.assigned_user_id
        WHERE c.is_active = TRUE
        ORDER BY c.cardholder_id`
    );

    return res.status(200).json({
      success: true,
      cardholders: result.rows.map((row) => ({
        cardholder_id: row.cardholder_id,
        cardholder_name: row.cardholder_name,
        last_four_digits: row.last_four_digits,
        assigned_user_id: row.assigned_user_id,
        assigned_user_name: row.assigned_user_name,
      })),
    });
  } catch (error) {
    console.error("getCardholders error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch cardholders" });
  }
};

// POST /api/cardholders   { lastFourDigits, cardholderName }
//
// Register a physical card the university has issued. This has to exist:
// every RLA must hold a card, so without a way to add cards the system caps
// out at however many were seeded and no new RLA can ever be created.
//
// Only the last four digits are ever stored — never the full number, CVV, PIN
// or a photo of the card.
const createCardholder = async (req, res) => {
  try {
    const { lastFourDigits, cardholderName } = req.body;

    if (!lastFourDigits || !/^\d{4}$/.test(String(lastFourDigits))) {
      return res.status(400).json({
        success: false,
        message: "Enter exactly the last four digits of the card",
      });
    }

    const duplicate = await pool.query(
      `SELECT cardholder_id, is_active FROM cardholders WHERE last_four_digits = $1`,
      [lastFourDigits]
    );
    if (duplicate.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: duplicate.rows[0].is_active
          ? "A card ending in those digits is already registered"
          : "A retired card ending in those digits exists — reactivate it instead",
      });
    }

    const result = await pool.query(
      `INSERT INTO cardholders (cardholder_name, last_four_digits)
       VALUES ($1, $2)
       RETURNING *`,
      // The label is cosmetic; it becomes the holder's name on assignment.
      [cardholderName?.trim() || `Card ${lastFourDigits}`, lastFourDigits]
    );

    const row = result.rows[0];
    return res.status(201).json({
      success: true,
      message: "Card registered",
      cardholder: {
        cardholderId: row.cardholder_id,
        cardholderName: row.cardholder_name,
        lastFourDigits: row.last_four_digits,
        assignedUserId: null,
      },
    });
  } catch (error) {
    console.error("createCardholder error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to register card" });
  }
};

// PATCH /api/cardholders/:cardholderId/assign   { userId }
// Hand a card to someone, or (userId: null) leave it unassigned.
//
// Kept separate from user administration on purpose: a card outlives whoever
// holds it. Deactivating a person must not retire their card, and reassigning
// a card must not touch anyone's account.
const assignCardholder = async (req, res) => {
  try {
    const cardholderId = Number(req.params.cardholderId);
    const { userId } = req.body;

    // A card in someone's hands cannot be quietly moved. Taking it would leave
    // the previous holder cardless, and an active RLA always holds a card --
    // so the manager has to free it deliberately first, by switching that
    // person off or giving them a different card.
    if (userId !== null && userId !== undefined) {
      const current = await pool.query(
        `SELECT u.user_id, u.full_name, u.is_active, c.last_four_digits
           FROM cardholders c
           JOIN users u ON u.user_id = c.assigned_user_id
          WHERE c.cardholder_id = $1`,
        [cardholderId]
      );

      const holder = current.rows[0];
      if (holder && holder.user_id !== Number(userId) && holder.is_active) {
        return res.status(409).json({
          success: false,
          message: `Card ${holder.last_four_digits} is held by ${holder.full_name}. Switch them off, or give them a different card, to free it.`,
        });
      }
    }

    if (userId !== null && userId !== undefined) {
      const userResult = await pool.query(
        `SELECT user_id, is_active, role FROM users WHERE user_id = $1`,
        [userId]
      );

      if (userResult.rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      const target = userResult.rows[0];

      if (!target.is_active) {
        return res.status(400).json({
          success: false,
          message: "Cannot assign a card to a deactivated user",
        });
      }

      // Cards belong to RLAs and only to RLAs. Managers review and administer
      // spending; they never hold a prepaid card themselves.
      if (target.role !== "rla") {
        return res.status(400).json({
          success: false,
          message: "Managers do not hold prepaid cards",
        });
      }
    }

    // assigned_at resets with each handover. Card-based visibility starts from
    // this date, so a new holder cannot browse the previous holder's receipts.
    //
    // cardholder_name follows the holder because it is what spreadsheets and
    // packages print. Releasing a card falls back to a neutral label so a
    // departed person's name does not linger in the "free cards" list.
    // One card per RLA. Everything downstream assumes it -- the dashboard
    // shows a single balance meter, and authService.findAssignedCard takes
    // LIMIT 1, so a second card would silently never be seen. Releasing the
    // old one here means the API cannot create a state the UI cannot show.
    if (userId !== null && userId !== undefined) {
      await pool.query(
        `UPDATE cardholders
            SET assigned_user_id = NULL,
                assigned_at      = NULL,
                cardholder_name  = 'Card ' || last_four_digits
          WHERE assigned_user_id = $1 AND cardholder_id <> $2`,
        [userId, cardholderId]
      );
    }

    // $1 is cast explicitly: it appears in an IS NULL test and a subquery,
    // which gives Postgres nothing to infer a type from ("could not determine
    // data type of parameter $1").
    const result = await pool.query(
      `UPDATE cardholders c
          SET assigned_user_id = $1::int,
              assigned_at      = CASE WHEN $1::int IS NULL THEN NULL ELSE CURRENT_DATE END,
              cardholder_name  = COALESCE(
                                   (SELECT full_name FROM users WHERE user_id = $1::int),
                                   'Card ' || c.last_four_digits
                                 )
        WHERE c.cardholder_id = $2
        RETURNING *`,
      [userId ?? null, cardholderId]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Card not found" });
    }

    const row = result.rows[0];
    return res.status(200).json({
      success: true,
      message: userId ? "Card assigned" : "Card unassigned",
      cardholder: {
        cardholderId: row.cardholder_id,
        cardholderName: row.cardholder_name,
        lastFourDigits: row.last_four_digits,
        assignedUserId: row.assigned_user_id,
        assignedAt: row.assigned_at,
      },
    });
  } catch (error) {
    console.error("assignCardholder error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to assign card" });
  }
};

// PATCH /api/cardholders/:cardholderId/deactivate
// Retire a physical card. Its transaction history is untouched and stays in
// every report -- this only removes it from the picker.
const deactivateCardholder = async (req, res) => {
  try {
    const cardholderId = Number(req.params.cardholderId);

    const result = await pool.query(
      `UPDATE cardholders SET is_active = FALSE WHERE cardholder_id = $1
       RETURNING cardholder_id, cardholder_name`,
      [cardholderId]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Card not found" });
    }

    return res
      .status(200)
      .json({ success: true, message: "Card retired" });
  } catch (error) {
    console.error("deactivateCardholder error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to retire card" });
  }
};

module.exports = {
  getCardholders,
  createCardholder,
  assignCardholder,
  deactivateCardholder,
};
