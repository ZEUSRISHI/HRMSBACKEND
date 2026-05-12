// controllers/emailCommController.js
"use strict";

const nodemailer = require("nodemailer");
const User       = require("../models/User");
const EmailLog   = require("../models/EmailLog");

/* ============================================================
   NODEMAILER TRANSPORTER
   - Local (.env SMTP_PORT=465): uses SSL, works on your machine
   - Render (.env SMTP_PORT=587): uses STARTTLS, works on Render
   ============================================================ */
function getTransporter() {
  const pass = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s/g, "");
  if (!process.env.GMAIL_USER || !pass) {
    throw new Error("GMAIL_USER or GMAIL_APP_PASSWORD environment variable is not set");
  }

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,          // force SSL, never STARTTLS
    auth: {
      user: process.env.GMAIL_USER,
      pass,
    },
    tls: {
      rejectUnauthorized: false,
      minVersion: "TLSv1.2",
    },
    connectionTimeout: 30000,
    greetingTimeout:   30000,
    socketTimeout:     45000,
    family: 4,
    pool: false,
    maxConnections: 1,
  });
}

/* ============================================================
   TEST CONNECTION
   ============================================================ */
async function testGmailConnection() {
  const transporter = getTransporter();
  await transporter.verify();
}

/* ============================================================
   HTML EMAIL TEMPLATE — Mobile-First Responsive Grey Theme
   ============================================================ */
function buildTemplate({
  recipientName = "Team Member",
  senderName,
  senderRole = "Admin",
  subject,
  body,
  priority = "normal",
  isTeam = false,
}) {
  const pri = {
    normal: { icon: "🟢", label: "Normal Priority",  headerBg: "#475569", show: false },
    medium: { icon: "🟡", label: "Medium Priority",  headerBg: "#d97706", show: true  },
    high:   { icon: "🔴", label: "High Priority",    headerBg: "#dc2626", show: true  },
  }[priority] || { icon: "🟢", label: "Normal Priority", headerBg: "#475569", show: false };

  const bodyHtml = String(body)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");

  const initials = senderName
    .split(" ")
    .map(n => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const now = new Date().toLocaleString("en-IN", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata",
  });

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no" />
  <title>${subject}</title>
  <!--[if mso]>
  <noscript>
    <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
  </noscript>
  <![endif]-->
  <style>
    * { box-sizing: border-box; }
    body, table, td, p, a, li, blockquote {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { border: 0; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
    body { margin: 0 !important; padding: 0 !important; background-color: #e2e8f0; width: 100% !important; }

    @media only screen and (max-width: 600px) {
      .email-wrapper { width: 100% !important; }
      .email-container { width: 100% !important; max-width: 100% !important; }
      .brand-bar { padding: 18px 20px !important; }
      .brand-name { font-size: 16px !important; }
      .brand-sub { font-size: 10px !important; letter-spacing: 1px !important; }
      .badge-pill { padding: 5px 10px !important; font-size: 10px !important; }
      .hero-section { padding: 24px 20px 0 !important; }
      .avatar-circle { width: 44px !important; height: 44px !important; line-height: 44px !important; font-size: 16px !important; }
      .sender-from { font-size: 10px !important; }
      .sender-name { font-size: 15px !important; }
      .sender-role { font-size: 11px !important; }
      .body-card { padding: 24px 20px !important; }
      .greeting { font-size: 20px !important; }
      .greeting-sub { font-size: 13px !important; margin-bottom: 20px !important; }
      .subject-box { padding: 14px 16px !important; margin-bottom: 18px !important; }
      .subject-label { font-size: 9px !important; }
      .subject-text { font-size: 15px !important; }
      .message-box { padding: 18px 16px !important; margin-bottom: 20px !important; }
      .message-label { font-size: 9px !important; }
      .message-text { font-size: 14px !important; line-height: 1.8 !important; }
      .meta-table { display: block !important; }
      .meta-left { display: block !important; width: 100% !important; margin-bottom: 12px !important; }
      .meta-right { display: block !important; width: 100% !important; text-align: left !important; }
      .meta-badge { display: inline-block !important; }
      .footer-section { padding: 20px 20px !important; }
      .footer-brand { font-size: 12px !important; }
      .footer-copy { font-size: 10px !important; }
      .footer-note { font-size: 10px !important; }
      .priority-banner { padding: 10px 20px !important; }
      .priority-text { font-size: 11px !important; }
      .logo-box { width: 38px !important; height: 38px !important; line-height: 38px !important; font-size: 17px !important; border-radius: 10px !important; }
      .hide-mobile { display: none !important; }
    }

    @media only screen and (max-width: 400px) {
      .greeting { font-size: 18px !important; }
      .subject-text { font-size: 14px !important; }
      .brand-name { font-size: 15px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#e2e8f0;width:100%;">

<div style="display:none;font-size:1px;color:#e2e8f0;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
  ${isTeam ? "Team broadcast" : "New message"} from ${senderName} · Quibo Tech HRMS · ${subject}
</div>

<table class="email-wrapper" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#e2e8f0;padding:24px 8px;">
<tr><td align="center">

  <table class="email-container" role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">

    <tr>
      <td style="background:linear-gradient(90deg,#334155,#64748b,#94a3b8,#64748b,#334155);height:4px;font-size:0;line-height:0;">&nbsp;</td>
    </tr>

    <tr>
      <td class="brand-bar" style="background:linear-gradient(135deg,#334155 0%,#475569 100%);padding:20px 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="vertical-align:middle;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:10px;">
                    <div class="logo-box" style="width:42px;height:42px;background:linear-gradient(135deg,#64748b,#94a3b8);border-radius:11px;text-align:center;line-height:42px;font-size:18px;font-weight:900;color:#ffffff;">Q</div>
                  </td>
                  <td style="vertical-align:middle;">
                    <p class="brand-name" style="margin:0;font-size:17px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;line-height:1.2;">Quibo Tech</p>
                    <p class="brand-sub" style="margin:0;font-size:10px;color:rgba(203,213,225,0.9);letter-spacing:2px;text-transform:uppercase;line-height:1.4;">HRMS Platform</p>
                  </td>
                </tr>
              </table>
            </td>
            <td align="right" style="vertical-align:middle;">
              <div class="badge-pill" style="display:inline-block;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);border-radius:20px;padding:6px 12px;">
                <span style="font-size:11px;color:rgba(255,255,255,0.95);font-weight:700;white-space:nowrap;">${isTeam ? "📢 BROADCAST" : "✉️ DIRECT"}</span>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    ${pri.show ? `
    <tr>
      <td class="priority-banner" style="background:${pri.headerBg};padding:10px 32px;">
        <p class="priority-text" style="margin:0;font-size:12px;font-weight:800;color:#ffffff;letter-spacing:0.5px;text-transform:uppercase;">${pri.icon} ${pri.label} — Immediate Attention Required</p>
      </td>
    </tr>` : ""}

    <tr>
      <td class="hero-section" style="background:linear-gradient(180deg,#475569 0%,#f1f5f9 100%);padding:28px 32px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="vertical-align:middle;padding-right:14px;width:60px;">
              <div class="avatar-circle" style="width:52px;height:52px;background:linear-gradient(135deg,#64748b,#94a3b8);border-radius:50%;text-align:center;line-height:52px;font-size:18px;font-weight:800;color:#ffffff;box-shadow:0 6px 20px rgba(71,85,105,0.4);">${initials}</div>
            </td>
            <td style="vertical-align:middle;">
              <p class="sender-from" style="margin:0 0 2px;font-size:10px;color:rgba(203,213,225,0.95);text-transform:uppercase;letter-spacing:1px;">${isTeam ? "Team Broadcast from" : "Message from"}</p>
              <p class="sender-name" style="margin:0 0 2px;font-size:17px;font-weight:800;color:#ffffff;line-height:1.2;">${senderName}</p>
              <p class="sender-role" style="margin:0;font-size:11px;color:rgba(203,213,225,0.85);text-transform:capitalize;">${senderRole} &middot; Quibo Tech HRMS</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td class="body-card" style="background:#ffffff;padding:32px 32px 28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">

        <p class="greeting" style="margin:0 0 6px;font-size:22px;font-weight:800;color:#0f172a;line-height:1.25;">Hi ${recipientName} 👋</p>
        <p class="greeting-sub" style="margin:0 0 24px;font-size:13px;color:#64748b;line-height:1.5;">You have a new ${isTeam ? "broadcast" : "message"} from your team.</p>

        <div class="subject-box" style="background:linear-gradient(135deg,#f1f5f9,#e2e8f0);border:1px solid #cbd5e1;border-radius:12px;padding:14px 18px;margin-bottom:20px;">
          <p class="subject-label" style="margin:0 0 5px;font-size:9px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:1.5px;">Subject</p>
          <p class="subject-text" style="margin:0;font-size:16px;font-weight:700;color:#1e293b;line-height:1.4;word-break:break-word;">${subject}</p>
        </div>

        <div class="message-box" style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #475569;border-radius:0 12px 12px 0;padding:20px 20px 20px 18px;margin-bottom:24px;">
          <p class="message-label" style="margin:0 0 8px;font-size:9px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;">Message</p>
          <p class="message-text" style="margin:0;font-size:14px;color:#334155;line-height:1.85;word-break:break-word;">${bodyHtml}</p>
        </div>

        <div style="height:1px;background:#f1f5f9;margin-bottom:20px;"></div>

        <table class="meta-table" role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td class="meta-left" style="vertical-align:middle;">
              <p style="margin:0 0 3px;font-size:12px;color:#94a3b8;line-height:1.4;">Sent via <strong style="color:#475569;">Quibo Tech HRMS</strong></p>
              <p style="margin:0;font-size:11px;color:#cbd5e1;line-height:1.4;">🕐 ${now} IST</p>
            </td>
            <td class="meta-right" align="right" style="vertical-align:middle;">
              <div class="meta-badge" style="display:inline-block;background:linear-gradient(135deg,#475569,#64748b);border-radius:20px;padding:7px 16px;">
                <span style="font-size:11px;font-weight:800;color:#ffffff;letter-spacing:0.5px;white-space:nowrap;">${isTeam ? "📢 BROADCAST" : "✉️ DIRECT"}</span>
              </div>
            </td>
          </tr>
        </table>

      </td>
    </tr>

    <tr>
      <td class="footer-section" style="background:#334155;padding:22px 32px;border-radius:0 0 16px 16px;border-left:1px solid rgba(148,163,184,0.15);border-right:1px solid rgba(148,163,184,0.15);border-bottom:1px solid rgba(148,163,184,0.15);">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="vertical-align:middle;">
              <p class="footer-brand" style="margin:0 0 5px;font-size:13px;font-weight:700;color:#e2e8f0;line-height:1.3;">Quibo Technologies Pvt. Ltd.</p>
              <p class="footer-copy" style="margin:0 0 4px;font-size:11px;color:rgba(148,163,184,0.8);line-height:1.4;">© 2026 All rights reserved.</p>
              <p class="footer-note" style="margin:0;font-size:10px;color:rgba(100,116,139,0.8);line-height:1.5;">This is an internal HRMS communication.<br/>Please do not reply to this email.</p>
            </td>
            <td class="hide-mobile" align="right" style="vertical-align:middle;padding-left:16px;">
              <div style="width:34px;height:34px;background:rgba(255,255,255,0.1);border-radius:9px;text-align:center;line-height:34px;font-size:15px;font-weight:900;color:#e2e8f0;">Q</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td style="background:linear-gradient(90deg,#334155,#64748b,#94a3b8,#64748b,#334155);height:3px;font-size:0;line-height:0;">&nbsp;</td>
    </tr>

  </table>

</td></tr>
</table>

</body>
</html>`;
}

/* ============================================================
   GET DIRECTORY
   ============================================================ */
exports.getDirectory = async (req, res) => {
  try {
    const users = await User.find({ isActive: true })
      .select("name email role department designation")
      .sort({ role: 1, name: 1 });
    res.json({ success: true, users });
  } catch (err) {
    console.error("Directory error:", err.message);
    res.status(500).json({ success: false, message: "Failed to load directory" });
  }
};

/* ============================================================
   SEND DIRECT EMAIL
   ============================================================ */
exports.sendEmail = async (req, res) => {
  try {
    const { to, cc = [], subject, body, priority = "normal" } = req.body;

    if (!to?.length)      return res.status(400).json({ success: false, message: "At least one recipient required" });
    if (!subject?.trim()) return res.status(400).json({ success: false, message: "Subject is required" });
    if (!body?.trim())    return res.status(400).json({ success: false, message: "Message body is required" });

    const senderName  = req.user?.name || "HRMS Admin";
    const senderRole  = req.user?.role || "admin";
    const transporter = getTransporter();

    const recipientDocs = await User.find({ email: { $in: to } }).select("name email");
    const nameMap = Object.fromEntries(recipientDocs.map(u => [u.email, u.name]));

    let lastMsgId = "";
    for (const email of to) {
      const recipientName = nameMap[email] || email.split("@")[0];

      const info = await transporter.sendMail({
        from:    `"${process.env.EMAIL_FROM_NAME || "Quibo Tech HRMS"}" <${process.env.GMAIL_USER}>`,
        to:      email,
        cc:      cc.length ? cc.join(", ") : undefined,
        subject: `[Quibo HRMS] ${subject}`,
        html:    buildTemplate({ recipientName, senderName, senderRole, subject, body, priority, isTeam: false }),
        text:    `Hi ${recipientName},\n\n${body}\n\n— ${senderName} (${senderRole})\nQuibo Tech HRMS`,
      });

      lastMsgId = info.messageId || "";
    }

    await EmailLog.create({
      sentBy: req.user._id, type: "direct",
      to, cc, subject, body, priority,
      status: "sent", messageId: lastMsgId,
    });

    res.json({
      success: true,
      message: `Email sent to ${to.length} recipient(s)`,
      recipientCount: to.length,
      messageId: lastMsgId,
    });
  } catch (err) {
    console.error("Send email error:", err.message);
    try {
      await EmailLog.create({
        sentBy: req.user._id, type: "direct",
        to: req.body.to || [], subject: req.body.subject || "",
        body: req.body.body || "", priority: req.body.priority || "normal",
        status: "failed", error: err.message,
      });
    } catch (_) {}
    res.status(500).json({ success: false, message: err.message || "Failed to send email" });
  }
};

/* ============================================================
   SEND TEAM EMAIL
   ============================================================ */
exports.sendToTeam = async (req, res) => {
  try {
    const { roles, subject, body, priority = "normal" } = req.body;

    if (!roles?.length)   return res.status(400).json({ success: false, message: "Select at least one role" });
    if (!subject?.trim()) return res.status(400).json({ success: false, message: "Subject is required" });
    if (!body?.trim())    return res.status(400).json({ success: false, message: "Message body is required" });

    const recipients = await User.find({ role: { $in: roles }, isActive: true }).select("name email");
    if (!recipients.length)
      return res.status(400).json({ success: false, message: "No active members found for selected roles" });

    const senderName  = req.user?.name || "HRMS Admin";
    const senderRole  = req.user?.role || "admin";
    const transporter = getTransporter();

    for (const user of recipients) {
      await transporter.sendMail({
        from:    `"${process.env.EMAIL_FROM_NAME || "Quibo Tech HRMS"}" <${process.env.GMAIL_USER}>`,
        to:      user.email,
        subject: `[Quibo HRMS Broadcast] ${subject}`,
        html:    buildTemplate({ recipientName: user.name, senderName, senderRole, subject, body, priority, isTeam: true }),
        text:    `Hi ${user.name},\n\n${body}\n\n— ${senderName} (${senderRole})\nQuibo Tech HRMS`,
      });
    }

    await EmailLog.create({
      sentBy: req.user._id, type: "team",
      roles, to: recipients.map(u => u.email),
      subject, body, priority, status: "sent",
    });

    res.json({
      success: true,
      message: `Email sent to ${recipients.length} team member(s)`,
      recipientCount: recipients.length,
    });
  } catch (err) {
    console.error("Send team email error:", err.message);
    res.status(500).json({ success: false, message: err.message || "Failed to send team email" });
  }
};

/* ============================================================
   TEST SMTP — with full error details for debugging
   ============================================================ */
exports.testSmtp = async (req, res) => {
  try {
    const pass = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s/g, "");
    if (!process.env.GMAIL_USER || !pass) {
      return res.status(500).json({ success: false, message: "GMAIL_USER or GMAIL_APP_PASSWORD not set" });
    }
    await testGmailConnection();
    res.json({ success: true, message: "Gmail SMTP connected successfully" });
  } catch (err) {
    console.error("Gmail SMTP test failed:", err);
    res.status(500).json({
      success:      false,
      message:      err.message,
      code:         err.code         || null,
      command:      err.command      || null,
      responseCode: err.responseCode || null,
      response:     err.response     || null,
    });
  }
};

/* ============================================================
   GET LOGS
   ============================================================ */
exports.getLogs = async (req, res) => {
  try {
    const filter = req.user.role === "admin" ? {} : { sentBy: req.user._id };
    const logs   = await EmailLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("sentBy", "name email role");
    res.json({ success: true, logs });
  } catch (err) {
    console.error("Get logs error:", err.message);
    res.status(500).json({ success: false, message: "Failed to load logs" });
  }
};
