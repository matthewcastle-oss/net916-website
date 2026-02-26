const sql = require("mssql");
const sgMail = require("@sendgrid/mail");

module.exports = async function (context, req) {
  try {
    // Only allow POST
    if (req.method !== "POST") {
      context.res = { status: 405, body: "Method Not Allowed" };
      return;
    }

    // Read body
    const {
      firstName,
      lastName,
      email,
      phone,
      subject,
      body
    } = req.body || {};

    // Basic validation
    if (!firstName || !lastName || !email || !subject || !body) {
      context.res = { status: 400, body: "Missing required fields." };
      return;
    }

    // Env vars
    const connStr = process.env.SQL_CONNECTION_STRING;
    const sendgridKey = process.env.SENDGRID_API_KEY;
    const mailFrom = process.env.MAIL_FROM;
    const hrEmailsRaw = process.env.HR_EMAILS;

    if (!connStr) throw new Error("Missing SQL_CONNECTION_STRING env var");
    if (!sendgridKey) throw new Error("Missing SENDGRID_API_KEY env var");
    if (!mailFrom) throw new Error("Missing MAIL_FROM env var");
    if (!hrEmailsRaw) throw new Error("Missing HR_EMAILS env var");

    const hrList = hrEmailsRaw
      .split(",")
      .map(x => x.trim())
      .filter(Boolean);

    if (hrList.length < 1) throw new Error("HR_EMAILS is empty/invalid");

    // --- 1) INSERT INTO SQL ---
    // NOTE: This assumes your table is dbo.Inquiries with columns:
    // FirstName, LastName, Email, Phone, Subject, Body
    // If your column names differ, change them here.
    const pool = await sql.connect(connStr);

    await pool.request()
      .input("FirstName", sql.NVarChar(50), firstName)
      .input("LastName", sql.NVarChar(50), lastName)
      .input("Email", sql.NVarChar(255), email)
      .input("Phone", sql.NVarChar(30), phone || null)
      .input("Subject", sql.NVarChar(200), subject)
      .input("Body", sql.NVarChar(sql.MAX), body)
      .query(`
        INSERT INTO dbo.Inquiries (FirstName, LastName, Email, Phone, Subject, Body)
        VALUES (@FirstName, @LastName, @Email, @Phone, @Subject, @Body)
      `);

    // --- 2) SEND EMAIL (SendGrid) ---
    sgMail.setApiKey(sendgridKey);

    const emailText =
`New Inquiry Received (Fun2Phish)

First Name: ${firstName}
Last Name: ${lastName}
Email: ${email}
Phone: ${phone || ""}
Subject: ${subject}

Message:
${body}
`;

    await sgMail.send({
      to: hrList,
      from: mailFrom,
      subject: `Fun2Phish Inquiry: ${subject}`,
      text: emailText
    });

    context.res = { status: 200, body: "Submitted! HR has been notified." };
  } catch (err) {
    context.log("Inquiry error:", err);
    context.res = { status: 500, body: "Server error. Check Function logs." };
  }
};
