const sql = require("mssql");

module.exports = async function (context, req) {
    try {
        if (req.method !== "GET") {
            context.res = { status: 405, body: "Method Not Allowed" };
            return;
        }

        const connStr = process.env.SQL_CONNECTION_STRING;
        if (!connStr) throw new Error("Missing SQL_CONNECTION_STRING env var");

        await sql.connect(connStr);

        const result = await sql.query`
            SELECT id, name, issue, priority, status, submittedAt
            FROM tickets
            ORDER BY submittedAt DESC
        `;

        context.res = {
            status: 200,
            body: result.recordset,
            headers: { "Content-Type": "application/json" }
        };

    } catch (err) {
        context.log.error(err);
        context.res = { status: 500, body: "Server error: " + err.message };
    }
};
