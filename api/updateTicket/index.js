const sql = require("mssql");

module.exports = async function (context, req) {
    try {
        if (req.method !== "POST") {
            context.res = { status: 405, body: "Method Not Allowed" };
            return;
        }

        const { id, status } = req.body || {};

        if (!id || !status) {
            context.res = { status: 400, body: "Missing required fields." };
            return;
        }

        const validStatuses = ["open", "in-progress", "resolved"];
        if (!validStatuses.includes(status)) {
            context.res = { status: 400, body: "Invalid status value." };
            return;
        }

        const connStr = process.env.SQL_CONNECTION_STRING;
        if (!connStr) throw new Error("Missing SQL_CONNECTION_STRING env var");

        await sql.connect(connStr);

        await sql.query`
            UPDATE tickets
            SET status = ${status}
            WHERE id = ${id}
        `;

        context.res = { status: 200, body: { message: "Ticket updated successfully!" } };

    } catch (err) {
        context.log.error(err);
        context.res = { status: 500, body: "Server error: " + err.message };
    }
};
