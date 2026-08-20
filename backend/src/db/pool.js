const { Pool } = require("pg");

//get environment variables
const env = (name) => {
  const value = process.env[name];
  return value === undefined || value === "" ? undefined : value;
};

// for local development, the .env file is loaded by server.js before this runs.
// in production, the Render dashboard sets the environment variables directly.
const CONNECTION_STRING = env("DATABASE_URL");

// ssl reqirement for hosted Postgres,
// but not for local development with a local Postgres instance
const useSsl = env("DB_SSL")
  ? env("DB_SSL") === "true"
  : Boolean(CONNECTION_STRING);

// three cases for SSL:
// 1) local dev, no SSL,
// 2) hosted Postgres with a CA cert,
// 3) hosted Postgres without a CA cert. The last case is the default for Render's Postgres service,
//  and it is also what Supabase uses.
// The `rejectUnauthorized: false` option is what allows the connection to succeed without a CA cert.
const ssl = useSsl
  ? env("DB_SSL_CA")
    ? { ca: env("DB_SSL_CA") }
    : { rejectUnauthorized: false }
  : false;

const pool = new Pool({
  ...(CONNECTION_STRING
    ? { connectionString: CONNECTION_STRING }
    : {
        // for local development, the .env file is loaded by app.js before this runs.
        host: env("DB_HOST") || "localhost",
        port: Number(env("DB_PORT")) || 5432,
        database: env("DB_NAME") || "postgres",
        user: env("DB_USER"),
        password: env("DB_PASSWORD"),
      }),
  ssl,

  max: Number(env("DB_POOL_MAX")) || 10,

  // the pooler will wait this long for a free connection before throwing an error
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
});

pool.on("error", (error) => {
  console.error("idle postgres client error:", error);
});

module.exports = pool;
