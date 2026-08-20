require("dotenv").config();

const app = require("./app");
const pool = require("./db/pool");

const PORT = Number(process.env.PORT) || 5050;

const startServer = async () => {
  let server;

  try {
    const result = await pool.query("SELECT NOW()");
    console.log("database connected:", result.rows[0]);

    server = app.listen(PORT, () => {
      console.log(`server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Database connection failed:", error);
    process.exit(1);
  }

  // Render sends SIGTERM on every deploy and gives ~30s to wind down.
  // Without this, in-flight uploads and OCR calls are cut mid-request.
  const shutdown = async (signal) => {
    console.log(`${signal} received, shutting down`);
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
    // Backstop: never hang forever waiting on a stuck connection.
    setTimeout(() => process.exit(1), 25_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};

startServer();
