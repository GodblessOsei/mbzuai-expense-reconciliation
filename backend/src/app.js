const express = require("express");
const cors = require("cors");

const app = express();

const requireAuth = require("./middleware/requireAuth");
const requireRole = require("./middleware/requireRole");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const ocrRoutes = require("./routes/ocrRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const cardholderRoutes = require("./routes/cardholderRoutes");
const reconciliationPeriodRoutes = require("./routes/reconciliationPeriodRoutes");
const flagRoutes = require("./routes/flagRoutes");
const budgetItemRoutes = require("./routes/budgetItemRoutes");
const spreadsheetRoutes = require("./routes/spreadsheetRoutes");
const packageRoutes = require("./routes/packageRoutes");
const additionalSpendingRoutes = require("./routes/additionalSpendingRoutes");
const budgetRoutes = require("./routes/budgetRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");

app.use(cors({ origin: "http://localhost:5173", exposedHeaders: ["Content-Disposition"] }));
app.use(express.json());

// ---- Public --------------------------------------------------------------
// Signing in is the one door into the system, so it cannot sit behind the
// guard. Everything public must be mounted ABOVE the line below.
app.use("/api/auth", authRoutes);

// ---- The guard -----------------------------------------------------------
// Everything past this line requires a valid session. Mounting it once at the
// boundary rather than route by route means any route added later is protected
// BY DEFAULT and has to be deliberately moved above to be exposed. Guarding
// routes individually means the next one someone adds is open until they
// remember to guard it.
app.use("/api", requireAuth);

// ---- Signed in, any role -------------------------------------------------
app.use("/api/transactions", transactionRoutes);
app.use("/api/ocr", ocrRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/cardholders", cardholderRoutes);
app.use("/api/reconciliation-periods", reconciliationPeriodRoutes);
app.use("/api/flags", flagRoutes);
app.use("/api/budget-items", budgetItemRoutes);

// ---- Manager only --------------------------------------------------------
// Budgets, exports and the receipt archive are management surfaces. The PDF
// and package downloads in particular were manager-only by UI convention --
// hiding a button is not access control, so the rule is enforced here.
app.use("/api/users", userRoutes); // gates itself, listed here for clarity
app.use("/api/spreadsheets", requireRole("manager"), spreadsheetRoutes);
app.use("/api/packages", requireRole("manager"), packageRoutes);
app.use("/api/additional-spending", requireRole("manager"), additionalSpendingRoutes);
app.use("/api/budgets", requireRole("manager"), budgetRoutes);
app.use("/api/dashboard", requireRole("manager"), dashboardRoutes);

module.exports = app;
