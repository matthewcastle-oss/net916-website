const sql = require("mssql");
const sgMail = require("@sendgrid/mail");

module.exports = async function (context, req) {
  try {
    const { employeeEmail, startDate, endDate, reason } = req.body || {};

    if (!employeeEmail || !startDate || !endDate || !reason) {
      context.res = { status: 400, body: "Missing required fields." };
      return;
    }

    const connStr = process.env.SQL_CONNECTION_STRING;
    const sendgridKey = process.env.SENDGRID_API_KEY;
    const mailFrom = process.env.MAIL_FROM;

    const hrList = (process.env.HR_EMAILS || "")
      .split(",")
      .map(x => x.trim())
      .filter(Boolean);

    if (!connStr) throw new Error("Missing SQL_CONNECTION_STRING");
    if (!sendgridKey) throw new Error("Missing SENDGRID_API_KEY");
    if (!mailFrom) throw new Error("Missing MAIL_FROM");
    if (hrList.length < 1) throw new Error("Missing/empty HR_EMAILS");

    // Insert into SQL
    const pool = await sql.connect(connStr);
    const result = await pool.request()
      .input("EmployeeEmail", sql.NVarChar(255), employeeEmail)
      .input("StartDate", sql.Date, startDate)
      .input("EndDate", sql.Date, endDate)
      .input("Reason", sql.NVarChar(500), reason)
      .query(`
        INSERT INTO dbo.TimeOffRequests (EmployeeEmail, StartDate, EndDate, Reason)
        OUTPUT INSERTED.RequestId
        VALUES (@EmployeeEmail, @StartDate, @EndDate, @Reason);
      `);

    const requestId = result.recordset?.[0]?.RequestId;

    // Email employee confirmation + HR notification
    sgMail.setApiKey(sendgridKey);

    const employeeText =
`Fun2Phish Time-Off Request Submitted

Request ID: ${requestId}
Employee Email: ${employeeEmail}
Start Date: ${startDate}
End Date: ${endDate}

Reason:
${reason}

Status: Submitted
`;

    await sgMail.send({
      to: employeeEmail,
      from: mailFrom,
      subject: `Time-Off Request Submitted (ID ${requestId})`,
      text: employeeText
    });

    const hrText =
`New Time-Off Request Submitted

Request ID: ${requestId}
Employee Email: ${employeeEmail}
Start Date: ${startDate}
End Date: ${endDate}

Reason:
${reason}
`;

    await sgMail.send({
      to: hrList,
      from: mailFrom,
      subject: `New Time-Off Request (ID ${requestId})`,
      text: hrText
    });

    context.res = { status: 200, body: `Submitted! Your Request ID is ${requestId}. A confirmation email was sent.` };
  } catch (err) {
    context.log("timeoff submit error:", err);
    context.res = { status: 500, body: "Server error. Check Function logs." };
  } finally {
    try { await sql.close(); } catch {}
  }
};
