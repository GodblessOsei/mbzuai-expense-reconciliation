const express = require("express");
const cors = require("cors");

const app = express();

// allow the React frontend (Vite dev server) to call this backend
app.use(cors({ origin: "http://localhost:5173" }));

// let the server read JSON request bodies
app.use(express.json());

// health check — proves the frontend can reach the backend
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

module.exports = app;
