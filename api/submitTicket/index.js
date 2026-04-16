const sql = require("mssql");
const sgMail = require("@sendgrid/mail");

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
        const sendgridKey = process.env.SENDGRID_API_KEY;
        const mailFrom = process.env.MAIL_FROM;

        if (!connStr) throw new Error("Missing SQL_CONNECTION_STRING env var");
        if (!sendgridKey) throw new Error("Missing SENDGRID_API_KEY env var");
        if (!mailFrom) throw new Error("Missing MAIL_FROM env var");

        // Save ticket to SQL
        await sql.connect(connStr);
        await sql.query`
            INSERT INTO tickets (name, issue, priority, status, submittedAt)
            VALUES (${name}, ${issue}, ${priority}, 'open', GETDATE())
        `;

        // Send email notification
        sgMail.setApiKey(sendgridKey);
        await sgMail.send({
            to: "mcastle@fun2phish.tech",
            from: mailFrom,
            subject: `New helpdesk ticket — ${priority} priority`,
            html: `
                <h2>New IT Helpdesk Ticket</h2>
                <p><strong>From:</strong> ${name}</p>
                <p><strong>Priority:</strong> ${priority}</p>
                <p><strong>Issue:</strong></p>
                <p>${issue}</p>
                <hr>
                <p>View all tickets at <a href="https://www.fun2phish.tech/intranet/tickets.html">the dashboard</a>.</p>
            `
        });

        context.res = { status: 200, body: { message: "Ticket submitted successfully!" } };

    } catch (err) {
        context.log.error(err);
        context.res = { status: 500, body: "Server error: " + err.message };
    }
};
