const express = require("express");
const app = express();

const transactionRoutes = require("./routes/transactionRoutes");
const ocrRoutes = require("./routes/ocrRoutes");

app.use(express.json());

app.get("/", (req, res) => {
    res.send("hello from backend");
});

app.use("/api/transactions", transactionRoutes);
app.use("/api/ocr", ocrRoutes);

module.exports = app;