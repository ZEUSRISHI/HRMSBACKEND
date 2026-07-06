const axios = require("axios");

const getAppUrl = () => process.env.CLIENT_URL || "https://hrmsquibotech.vercel.app";

const sendContractExpiryEmail = async ({
  toEmail,
  toName,
  contractType,
  entityName,
  expiryDate,
  daysLeft,
}) => {
  const appUrl = getAppUrl();

  const urgencyColor =
    daysLeft <= 3  ? "#dc2626" :
    daysLeft <= 7  ? "#d97706" :
    daysLeft <= 14 ? "#ca8a04" : "#16a34a";

  const urgencyBg =
    daysLeft <= 3  ? "#fef2f2" :
    daysLeft <= 7  ? "#fffbeb" :
    daysLeft <= 14 ? "#fefce8" : "#f0fdf4";

  const urgencyLabel =
    daysLeft === 0 ? "Expires TODAY" :
    daysLeft === 1 ? "1 Day Left — Urgent" :
    `${daysLeft} Days Left`;

  const formattedDate = new Date(expiryDate).toLocaleDateString("en-IN", {
    day:   "2-digit",
    month: "long",
    year:  "numeric",
  });

  const reminderNumber =
    daysLeft <= 1  ? "final" :
    daysLeft <= 3  ? "4th"   :
    daysLeft <= 7  ? "3rd"   :
    daysLeft <= 14 ? "2nd"   : "1st";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
          style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- HEADER -->
          <tr>
            <td style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 60%,#0f172a 100%);padding:36px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="display:inline-block;background:rgba(249,115,22,0.15);border:1px solid rgba(249,115,22,0.3);border-radius:8px;padding:6px 14px;margin-bottom:16px;">
                      <span style="color:#fb923c;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Contract Management</span>
                    </div>
                    <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;line-height:1.3;">
                      Quibo Tech HRMS
                    </h1>
                    <p style="margin:6px 0 0;color:rgba(255,255,255,0.5);font-size:13px;">
                      Automated Contract Expiry Notification
                    </p>
                  </td>
                  <td align="right" style="vertical-align:top;">
                    <div style="background:${urgencyBg};border:2px solid ${urgencyColor};border-radius:50px;padding:8px 16px;display:inline-block;">
                      <span style="color:${urgencyColor};font-size:13px;font-weight:700;">${urgencyLabel}</span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ALERT BANNER -->
          <tr>
            <td style="background:${urgencyBg};border-bottom:3px solid ${urgencyColor};padding:16px 40px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right:12px;font-size:24px;">⚠️</td>
                  <td>
                    <p style="margin:0;color:${urgencyColor};font-size:14px;font-weight:700;">
                      Action Required — Contract expiring in ${daysLeft === 0 ? "less than 24 hours" : `${daysLeft} day${daysLeft === 1 ? "" : "s"}`}
                    </p>
                    <p style="margin:2px 0 0;color:${urgencyColor};font-size:12px;opacity:0.8;">
                      Please log in to the HRMS portal to renew or update the contract.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 8px;color:#6b7280;font-size:14px;">
                Hello, <strong style="color:#111827;">${toName}</strong>
              </p>
              <p style="margin:0 0 28px;color:#6b7280;font-size:14px;line-height:1.6;">
                This is an automated reminder from the Quibo Tech HRMS system. The following
                <strong style="color:#111827;">${contractType}</strong> contract requires your attention.
              </p>

              <!-- CONTRACT DETAILS CARD -->
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:28px;">
                <div style="background:#1e293b;padding:14px 20px;">
                  <p style="margin:0;color:#94a3b8;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Contract Details</p>
                </div>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;">
                      <p style="margin:0;color:#9ca3af;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Entity / Name</p>
                      <p style="margin:4px 0 0;color:#111827;font-size:15px;font-weight:700;">${entityName}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;">
                      <p style="margin:0;color:#9ca3af;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Contract Type</p>
                      <p style="margin:4px 0 0;color:#111827;font-size:15px;font-weight:600;">${contractType}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;">
                      <p style="margin:0;color:#9ca3af;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Expiry Date</p>
                      <p style="margin:4px 0 0;color:#111827;font-size:15px;font-weight:600;">📅 ${formattedDate}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:14px 20px;">
                      <p style="margin:0;color:#9ca3af;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Days Remaining</p>
                      <p style="margin:6px 0 0;">
                        <span style="background:${urgencyBg};color:${urgencyColor};font-size:14px;font-weight:800;padding:6px 16px;border-radius:20px;border:1px solid ${urgencyColor};display:inline-block;">
                          ${urgencyLabel}
                        </span>
                      </p>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- REMINDER SCHEDULE -->
              <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px 20px;margin-bottom:28px;">
                <p style="margin:0;color:#1e40af;font-size:13px;font-weight:600;">📋 Reminder Schedule</p>
                <p style="margin:6px 0 0;color:#3b82f6;font-size:12px;line-height:1.6;">
                  Automated reminders are sent at <strong>30 days → 14 days → 7 days → 3 days → 1 day</strong> before expiry.
                  This is the <strong>${reminderNumber}</strong> reminder for this contract.
                </p>
              </div>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="border-radius:10px;overflow:hidden;">
                    <a href="${appUrl}"
                       style="display:inline-block;background:linear-gradient(135deg,#f97316,#ea580c);color:#ffffff;text-decoration:none;padding:16px 32px;font-size:15px;font-weight:700;border-radius:10px;letter-spacing:0.3px;">
                      Open HRMS Portal &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
                If you have already renewed this contract, you can disregard this message.
                For support, contact your HRMS administrator.
              </p>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0;color:#6b7280;font-size:12px;font-weight:600;">Quibo Technologies</p>
                    <p style="margin:3px 0 0;color:#9ca3af;font-size:11px;">Chennai, Tamil Nadu, India</p>
                  </td>
                  <td align="right">
                    <p style="margin:0;color:#9ca3af;font-size:11px;">
                      &copy; ${new Date().getFullYear()} Quibo Technologies.<br/>All rights reserved.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding-top:12px;border-top:1px solid #e2e8f0;">
                    <p style="margin:8px 0 0;color:#d1d5db;font-size:11px;text-align:center;">
                      This is an automated system message from Quibo Tech HRMS. Please do not reply to this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const response = await axios.post(
    "https://api.brevo.com/v3/smtp/email",
    {
      sender:   {
        name:  "Quibo Tech HRMS",
        email: process.env.BREVO_SENDER_EMAIL,
      },
      to: [{ email: toEmail, name: toName }],
      subject: `⚠️ Contract Expiry Alert — ${entityName} (${urgencyLabel})`,
      htmlContent: html,
    },
    {
      headers: {
        "api-key":      process.env.BREVO_API_KEY,
        "Content-Type": "application/json",
        "Accept":       "application/json",
      },
    }
  );

  console.log(`✅ [contractReminderService] Email sent to ${toEmail} | messageId: ${response.data.messageId}`);
  return response.data;
};

module.exports = { sendContractExpiryEmail };