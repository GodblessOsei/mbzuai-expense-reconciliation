const express = require("express");
const router = express.Router();

const { resolveFlag } = require("../controllers/flagController");

router.patch("/:flagId/resolve", resolveFlag);

module.exports = router;
