const express = require("express");
const cors = require("cors");
const healthRoutes = require("./routes/health");

const app = express();

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

app.use("/api", healthRoutes); // everything in health.js lives under /api

module.exports = app;
