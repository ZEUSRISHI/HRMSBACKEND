"use strict";

const nodemailer = require("nodemailer");
const User       = require("../models/User");
const EmailLog   = require("../models/EmailLog");

/* ============================================================
   NODEMAILER TRANSPORTER — Gmail SSL port 465
   Works locally AND on Render/any cloud host
   ============================================================ */
function createTransporter() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass) {
    throw new Error(
      "EMAIL_USER or EMAIL_PASS not set in environment variables."
    );
  }

  return nodemailer.createTransport({
    host:   "smtp.gmail.com",
    port:   465,
    secure: true,
    auth:   { user, pass },
    tls:    { rejectUnauthorized: false },
  });
}

/* ============================================================
   SEND EMAIL
   ============================================================ */
async function sendViaMail({ to, subject, html, text }) {
  const transporter = createTransporter();
  const fromName    = process.env.EMAIL_FROM_NAME || "Quibo Tech HRMS";
  const fromEmail   = process.env.EMAIL_USER;

  console.log(`📧 Sending via Gmail → ${to} | Subject: ${subject}`);

  const info = await transporter.sendMail({
    from:    `"${fromName}" <${fromEmail}>`,
    to,
    subject,
    html:    html || undefined,
    text:    text || undefined,
  });

  console.log(`✅ Email sent: ${info.messageId}`);
  return { messageId: info.messageId, response: info.response };
}

/* ============================================================
   HTML EMAIL TEMPLATE
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
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");

  const initials = senderName
    .split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const now = new Date().toLocaleString("en-IN", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata",
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${subject}</title>
  <style>
    *{box-sizing:border-box}
    body{margin:0;padding:0;background:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
    @media(max-width:600px){
      .container{width:100%!important}
      .body-pad{padding:24px 16px!important}
      .hide-mobile{display:none!important}
    }
  </style>
</head>
<body style="background:#e2e8f0;padding:24px 8px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center">
  <table class="container" role="presentation" width="600" cellpadding="0" cellspacing="0"
    style="max-width:600px;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.10)">

    <tr><td style="background:linear-gradient(135deg,#334155,#475569);padding:20px 32px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:middle">
          <span style="font-size:17px;font-weight:800;color:#fff">Quibo Tech</span>
          <span style="font-size:10px;color:rgba(203,213,225,.9);letter-spacing:2px;text-transform:uppercase;margin-left:8px">HRMS</span>
        </td>
        <td align="right" style="vertical-align:middle">
          <span style="background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.3);border-radius:20px;padding:6px 12px;font-size:11px;color:#fff;font-weight:700">
            ${isTeam ? "📢 BROADCAST" : "✉️ DIRECT"}
          </span>
        </td>
      </tr></table>
    </td></tr>

    ${pri.show ? `<tr><td style="background:${pri.headerBg};padding:10px 32px">
      <p style="margin:0;font-size:12px;font-weight:800;color:#fff;text-transform:uppercase">
        ${pri.icon} ${pri.label} — Immediate Attention Required
      </p>
    </td></tr>` : ""}

    <tr><td style="background:linear-gradient(180deg,#475569,#f1f5f9);padding:28px 32px 0">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:middle;padding-right:14px">
          <div style="width:52px;height:52px;background:linear-gradient(135deg,#64748b,#94a3b8);border-radius:50%;text-align:center;line-height:52px;font-size:18px;font-weight:800;color:#fff">
            ${initials}
          </div>
        </td>
        <td style="vertical-align:middle">
          <p style="margin:0 0 2px;font-size:10px;color:rgba(203,213,225,.95);text-transform:uppercase;letter-spacing:1px">
            ${isTeam ? "Team Broadcast from" : "Message from"}
          </p>
          <p style="margin:0 0 2px;font-size:17px;font-weight:800;color:#fff">${senderName}</p>
          <p style="margin:0;font-size:11px;color:rgba(203,213,184,.85)">${senderRole} · Quibo Tech HRMS</p>
        </td>
      </tr></table>
    </td></tr>

    <tr><td class="body-pad" style="background:#fff;padding:32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0">
      <p style="margin:0 0 6px;font-size:22px;font-weight:800;color:#0f172a">Hi ${recipientName} 👋</p>
      <p style="margin:0 0 24px;font-size:13px;color:#64748b">
        You have a new ${isTeam ? "broadcast" : "message"} from your team.
      </p>
      <div style="background:linear-gradient(135deg,#f1f5f9,#e2e8f0);border:1px solid #cbd5e1;border-radius:12px;padding:14px 18px;margin-bottom:20px">
        <p style="margin:0 0 5px;font-size:9px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:1.5px">Subject</p>
        <p style="margin:0;font-size:16px;font-weight:700;color:#1e293b">${subject}</p>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #475569;border-radius:0 12px 12px 0;padding:20px 20px 20px 18px;margin-bottom:24px">
        <p style="margin:0 0 8px;font-size:9px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px">Message</p>
        <p style="margin:0;font-size:14px;color:#334155;line-height:1.85">${bodyHtml}</p>
      </div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:middle">
          <p style="margin:0 0 3px;font-size:12px;color:#94a3b8">Sent via <strong style="color:#475569">Quibo Tech HRMS</strong></p>
          <p style="margin:0;font-size:11px;color:#cbd5e1">🕐 ${now} IST</p>
        </td>
        <td class="hide-mobile" align="right" style="vertical-align:middle">
          <span style="background:linear-gradient(135deg,#475569,#64748b);border-radius:20px;padding:7px 16px;font-size:11px;font-weight:800;color:#fff">
            ${isTeam ? "📢 BROADCAST" : "✉️ DIRECT"}
          </span>
        </td>
      </tr></table>
    </td></tr>

    <tr><td style="background:#334155;padding:22px 32px;border-radius:0 0 16px 16px">
      <p style="margin:0 0 5px;font-size:13px;font-weight:700;color:#e2e8f0">Quibo Technologies Pvt. Ltd.</p>
      <p style="margin:0 0 4px;font-size:11px;color:rgba(148,163,184,.8)">© 2026 All rights reserved.</p>
      <p style="margin:0;font-size:10px;color:rgba(100,116,139,.8)">This is an internal HRMS communication. Please do not reply.</p>
    </td></tr>

  </table>
</td></tr></table>
</body></html>`;
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

    const senderName = req.user?.name || "HRMS Admin";
    const senderRole = req.user?.role || "admin";

    const recipientDocs = await User.find({ email: { $in: to } }).select("name email");
    const nameMap = Object.fromEntries(recipientDocs.map((u) => [u.email, u.name]));

    const errors = [];
    for (const email of to) {
      const recipientName = nameMap[email] || email.split("@")[0];
      try {
        await sendViaMail({
          to:      email,
          subject: `[Quibo HRMS] ${subject}`,
          html:    buildTemplate({ recipientName, senderName, senderRole, subject, body, priority, isTeam: false }),
          text:    `Hi ${recipientName},\n\n${body}\n\n— ${senderName} (${senderRole})\nQuibo Tech HRMS`,
        });
      } catch (e) {
        console.error(`❌ Failed to send to ${email}:`, e.message);
        errors.push({ email, error: e.message });
      }
    }

    const sentCount = to.length - errors.length;

    await EmailLog.create({
      sentBy: req.user._id,
      type:   "direct",
      to, cc, subject, body, priority,
      status: errors.length === to.length ? "failed" : "sent",
      error:  errors.length ? JSON.stringify(errors) : undefined,
    });

    if (errors.length === to.length) {
      return res.status(500).json({
        success: false,
        message: `Failed to send: ${errors[0]?.error}`,
        errors,
      });
    }

    res.json({
      success:        true,
      message:        `Email sent to ${sentCount} recipient(s)${errors.length ? `, ${errors.length} failed` : ""}`,
      recipientCount: sentCount,
    });
  } catch (err) {
    console.error("Send email error:", err.message);
    try {
      await EmailLog.create({
        sentBy:   req.user._id,
        type:     "direct",
        to:       req.body.to       || [],
        subject:  req.body.subject  || "",
        body:     req.body.body     || "",
        priority: req.body.priority || "normal",
        status:   "failed",
        error:    err.message,
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

    const senderName = req.user?.name || "HRMS Admin";
    const senderRole = req.user?.role || "admin";

    const errors = [];
    for (const user of recipients) {
      try {
        await sendViaMail({
          to:      user.email,
          subject: `[Quibo HRMS Broadcast] ${subject}`,
          html:    buildTemplate({ recipientName: user.name, senderName, senderRole, subject, body, priority, isTeam: true }),
          text:    `Hi ${user.name},\n\n${body}\n\n— ${senderName} (${senderRole})\nQuibo Tech HRMS`,
        });
      } catch (e) {
        console.error(`❌ Failed to send to ${user.email}:`, e.message);
        errors.push({ email: user.email, error: e.message });
      }
    }

    const sentCount = recipients.length - errors.length;

    await EmailLog.create({
      sentBy: req.user._id,
      type:   "team",
      roles,
      to:     recipients.map((u) => u.email),
      subject, body, priority,
      status: errors.length === recipients.length ? "failed" : "sent",
      error:  errors.length ? JSON.stringify(errors) : undefined,
    });

    if (errors.length === recipients.length) {
      return res.status(500).json({
        success: false,
        message: `All emails failed: ${errors[0]?.error}`,
        errors,
      });
    }

    res.json({
      success:        true,
      message:        `Email sent to ${sentCount} team member(s)`,
      recipientCount: sentCount,
    });
  } catch (err) {
    console.error("Send team email error:", err.message);
    res.status(500).json({ success: false, message: err.message || "Failed to send team email" });
  }
};

/* ============================================================
   TEST CONNECTION
   ============================================================ */
exports.testSmtp = async (req, res) => {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  console.log("🧪 testSmtp called");
  console.log("  EMAIL_USER:", user ? `SET ✅ (${user})` : "MISSING ❌");
  console.log("  EMAIL_PASS:", pass ? `SET ✅ (length=${pass.length})` : "MISSING ❌");

  if (!user || !pass) {
    return res.status(500).json({
      success: false,
      message: "EMAIL_USER or EMAIL_PASS not set in environment variables.",
    });
  }

  try {
    const transporter = createTransporter();

    // Verify connection first
    await transporter.verify();
    console.log("✅ SMTP connection verified");

    // Send test email
    const info = await transporter.sendMail({
      from:    `"${process.env.EMAIL_FROM_NAME || "Quibo Tech HRMS"}" <${user}>`,
      to:      user,   // send to self as test
      subject: "[Test] Quibo HRMS Gmail OK ✅",
      html:    "<h2>✅ Gmail connected!</h2><p>Quibo Tech HRMS email system is working correctly via Nodemailer.</p>",
      text:    "Gmail connected and working correctly from Quibo Tech HRMS.",
    });

    console.log("✅ Test email sent:", info.messageId);
    res.json({
      success:   true,
      message:   "Gmail connected! Test email sent successfully.",
      messageId: info.messageId,
    });
  } catch (err) {
    console.error("❌ testSmtp failed:", err.message);
    res.status(500).json({
      success: false,
      message: err.message,
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
