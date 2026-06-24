const app = require("./app");
const pool = require("./db/pool");

const startServer = async () => {
    try {
        const result = await pool.query("SELECT NOW()");
        console.log("database connected:", result.rows[0]);

        app.listen(5050, () => {
            console.log("server is running on port 5050");
        });
    } catch (error) {
        console.error("Database connection failed:", error.message);
    }
};

startServer();