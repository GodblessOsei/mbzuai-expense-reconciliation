const express = require("express");
const cors = require("cors");

const app = express();

const transactionRoutes = require("./routes/transactionRoutes");
const ocrRoutes = require("./routes/ocrRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const cardholderRoutes = require("./routes/cardholderRoutes");
const reconciliationPeriodRoutes = require("./routes/reconciliationPeriodRoutes");
const flagRoutes = require("./routes/flagRoutes");

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());
app.use("/api/transactions", transactionRoutes);
app.use("/api/ocr", ocrRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/cardholders", cardholderRoutes);
app.use("/api/reconciliation-periods", reconciliationPeriodRoutes);
app.use("/api/flags", flagRoutes);

module.exports = app;
