const sql = require("mssql");
const nodemailer = require("nodemailer");

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

module.exports = async function (context, req) {
  try {
    const body = req.body || {};
    const firstName = (body.firstName || "").trim();
    const lastName  = (body.lastName || "").trim();
    const email     = (body.email || "").trim();
    const phone     = (body.phone || "").trim();
    const subject   = (body.subject || "").trim();
    const message   = (body.body || "").trim();

    // Basic validation
    if (!firstName || !lastName || !email || !subject || !message) {
      context.res = { status: 400, body: "Missing required fields." };
      return;
    }

    // 1) Insert into Azure SQL
    const pool = await sql.connect(requireEnv("SQL_CONNECTION_STRING"));
    await pool.request()
      .input("FirstName", sql.NVarChar(50), firstName)
      .input("LastName",  sql.NVarChar(50), lastName)
      .input("Email",     sql.NVarChar(255), email)
      .input("Phone",     sql.NVarChar(30), phone || null)
      .input("Subject",   sql.NVarChar(120), subject)
      .input("Body",      sql.NVarChar(sql.MAX), message)
      .query(`
        INSERT INTO dbo.Inquiries (FirstName, LastName, Email, Phone, Subject, Body)
        VALUES (@FirstName, @LastName, @Email, @Phone, @Subject, @Body);
      `);

    // 2) Email HR (to Proton addresses) with SQL data in body
    const hrList = requireEnv("HR_EMAILS")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    const from = requireEnv("MAIL_FROM");

    const emailBody =
`New Inquiry Submitted (saved to SQL)

First Name: ${firstName}
Last Name: ${lastName}
Email: ${email}
Phone: ${phone || "(none)"}
Subject: ${subject}

Message:
${message}
`;

    const transporter = nodemailer.createTransport({
      host: requireEnv("SMTP_HOST"),
      port: parseInt(requireEnv("SMTP_PORT"), 10),
      secure: false,
      auth: {
        user: requireEnv("SMTP_USERNAME"),
        pass: requireEnv("SMTP_PASSWORD")
      }
    });

    await transporter.sendMail({
      from,
      to: hrList,
      subject: `Fun2Phish Inquiry: ${subject}`,
      text: emailBody
    });

    context.res = { status: 200, body: "OK" };
  } catch (err) {
    context.log("Inquiry error:", err);
    context.res = { status: 500, body: "Server error. Check Function logs." };
  } finally {
    try { await sql.close(); } catch {}
  }
};
