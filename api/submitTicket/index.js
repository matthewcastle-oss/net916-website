const sql = require("mssql");

module.exports = async function (context, req) {
    try {
        if (req.method !== "POST") {
            context.res = { status: 405, body: "Method Not Allowed" };
            return;
        }

        const { name, issue, priority } = req.body || {};

        if (!name || !issue || !priority) {
            context.res = { status: 400, body: "Missing required fields." };
            return;
        }

        const connStr = process.env.SQL_CONNECTION_STRING;
        if (!connStr) throw new Error("Missing SQL_CONNECTION_STRING env var");

        await sql.connect(connStr);

        await sql.query`
            INSERT INTO tickets (name, issue, priority, status, submittedAt)
            VALUES (${name}, ${issue}, ${priority}, 'open', GETDATE())
        `;

        context.res = { status: 200, body: { message: "Ticket submitted successfully!" } };

    } catch (err) {
        context.log.error(err);
        context.res = { status: 500, body: "Server error: " + err.message };
    }
};
