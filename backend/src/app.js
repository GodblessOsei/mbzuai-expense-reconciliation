const express = require("express");
const cors = require("cors");

const app = express();

const transactionRoutes = require("./routes/transactionRoutes");
const ocrRoutes = require("./routes/ocrRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const cardholderRoutes = require("./routes/cardholderRoutes");
const reconciliationPeriodRoutes = require("./routes/reconciliationPeriodRoutes");
const flagRoutes = require("./routes/flagRoutes");
const budgetItemRoutes = require("./routes/budgetItemRoutes");
const spreadsheetRoutes = require("./routes/spreadsheetRoutes");
const packageRoutes = require("./routes/packageRoutes");

app.use(cors({ origin: "http://localhost:5173", exposedHeaders: ["Content-Disposition"] }));
app.use(express.json());
app.use("/api/transactions", transactionRoutes);
app.use("/api/ocr", ocrRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/cardholders", cardholderRoutes);
app.use("/api/reconciliation-periods", reconciliationPeriodRoutes);
app.use("/api/flags", flagRoutes);
app.use("/api/budget-items", budgetItemRoutes);
app.use("/api/spreadsheets", spreadsheetRoutes);
app.use("/api/packages", packageRoutes);

module.exports = app;
