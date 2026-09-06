const express = require("express");
const cors = require("cors");

const app = express();

const requireAuth = require("./middleware/requireAuth");
const requireRole = require("./middleware/requireRole");
const camelCaseResponse = require("./middleware/camelCaseResponse");
const normalizeRequestBody = require("./middleware/normalizeRequestBody");

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

// Comma-separated exact origins, e.g. "https://mbzuai-reconciliation-web.onrender.com".
// Defaults to the Vite dev server so local work needs no env var.
//
// In the deployed setup this list is usually EMPTY and that is correct: the
// Render static site rewrites /api to this service (see render.yaml), so the
// browser only ever talks to one origin and CORS never enters the picture.
// It stays configured for the case where the frontend is pointed straight at
// this API instead — another host, a mobile client, or a local frontend run
// against the deployed backend.
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

// Render gives every pull-request preview its own hostname, so previews cannot
// be listed by hand. Opt in with CORS_ALLOW_RENDER_PREVIEWS=true.
const RENDER_PREVIEW = /^https:\/\/[a-z0-9-]+\.onrender\.com$/;
const allowPreviews = process.env.CORS_ALLOW_RENDER_PREVIEWS === "true";

const isAllowedOrigin = (origin) => {
  // No Origin header at all: curl, health checks, server-to-server. These are
  // not browser requests, so CORS has no say over them.
  if (!origin) return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  return allowPreviews && RENDER_PREVIEW.test(origin);
};

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) return callback(null, true);
      // Refuse by withholding the header, not by throwing: an Error here
      // becomes a 500 HTML page, which misreports a policy decision as a
      // server fault. Without the header the browser blocks it anyway.
      console.warn("CORS: blocked origin", origin);
      return callback(null, false);
    },
    // The download helpers read the filename from this header. Without
    // exposing it the browser hides it and every download is named "blob".
    exposedHeaders: ["Content-Disposition"],
  })
);
app.use(express.json());

// The API speaks camelCase; Postgres speaks snake_case. Translating here rather
// than in each controller is what keeps it consistent -- see the middleware for
// why, and note it renames keys without deciding which keys exist.
app.use(camelCaseResponse);
app.use(normalizeRequestBody);

// ---- Public --------------------------------------------------------------
// Signing in is the one door into the system, so it cannot sit behind the
// guard. Everything public must be mounted ABOVE the line below.
app.use("/api/auth", authRoutes);

// Liveness probe for the host's health check. Deliberately does NOT touch the
// database: this answers "is the process up", and a failing DB should surface
// as a request error, not as the platform killing and restarting the server.
app.get("/api/health", (req, res) => {
  return res.json({ status: "ok", uptime: process.uptime() });
});

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
