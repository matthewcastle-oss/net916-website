const sql = require("mssql");
const sgMail = require("@sendgrid/mail");

module.exports = async function (context, req) {
  try {
    const { requestId, status, managerNote } = req.body || {};

    if (!requestId || !status || !["Approved", "Denied"].includes(status)) {
      context.res = { status: 400, body: "requestId and valid status (Approved/Denied) required." };
      return;
    }

    const connStr = process.env.SQL_CONNECTION_STRING;
    const sendgridKey = process.env.SENDGRID_API_KEY;
    const mailFrom = process.env.MAIL_FROM;

    if (!connStr) throw new Error("Missing SQL_CONNECTION_STRING");
    if (!sendgridKey) throw new Error("Missing SENDGRID_API_KEY");
    if (!mailFrom) throw new Error("Missing MAIL_FROM");

    // Update status + get employee email
    const pool = await sql.connect(connStr);
    const result = await pool.request()
      .input("RequestId", sql.Int, requestId)
      .input("Status", sql.NVarChar(20), status)
      .input("ManagerNote", sql.NVarChar(500), managerNote || null)
      .query(`
        UPDATE dbo.TimeOffRequests
        SET Status = @Status,
            ManagerNote = @ManagerNote,
            UpdatedAt = SYSUTCDATETIME()
        WHERE RequestId = @RequestId;

        SELECT EmployeeEmail, StartDate, EndDate, Reason, Status, ManagerNote
        FROM dbo.TimeOffRequests
        WHERE RequestId = @RequestId;
      `);

    const row = result.recordset?.[0];
    if (!row) {
      context.res = { status: 404, body: "Request ID not found." };
      return;
    }

    // Email employee decision
    sgMail.setApiKey(sendgridKey);

    const text =
`Fun2Phish Time-Off Request Update

Request ID: ${requestId}
Status: ${row.Status}

Employee Email: ${row.EmployeeEmail}
Start Date: ${row.StartDate?.toISOString?.().slice(0,10) || row.StartDate}
End Date: ${row.EndDate?.toISOString?.().slice(0,10) || row.EndDate}

Manager Note:
${row.ManagerNote || "(none)"}
`;

    await sgMail.send({
      to: row.EmployeeEmail,
      from: mailFrom,
      subject: `Time-Off Request ${row.Status} (ID ${requestId})`,
      text
    });

    context.res = { status: 200, body: `Decision saved. Employee notified (${row.EmployeeEmail}).` };
  } catch (err) {
    context.log("timeoff decision error:", err);
    context.res = { status: 500, body: "Server error. Check Function logs." };
  } finally {
    try { await sql.close(); } catch {}
  }
};
