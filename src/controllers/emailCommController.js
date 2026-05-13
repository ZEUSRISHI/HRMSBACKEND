"use strict";

const User     = require("../models/User");
const EmailLog = require("../models/EmailLog");

async function sendViaBrevo({ to, subject, html, text }) {
  const apiKey    = process.env.BREVO_API_KEY;
  const fromEmail = process.env.EMAIL_FROM      || "quibotechnologies@gmail.com";
  const fromName  = process.env.EMAIL_FROM_NAME || "Quibo Tech HRMS";

  if (!apiKey) throw new Error("BREVO_API_KEY not set in environment variables.");

  console.log(`📧 Brevo → ${to} | Subject: ${subject}`);

  const payload = {
    sender:      { name: fromName, email: fromEmail },
    to:          [{ email: to }],
    subject,
    htmlContent: html || `<p>${text}</p>`,
    textContent: text || "",
  };

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method:  "POST",
    headers: {
      "Accept":       "application/json",
      "Content-Type": "application/json",
      "api-key":      apiKey,
    },
    body: JSON.stringify(payload),
  });

  const contentType = response.headers.get("content-type") || "";
  let data;
  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    const raw = await response.text();
    throw new Error(`Brevo non-JSON response (HTTP ${response.status}): ${raw.slice(0, 200)}`);
  }

  if (!response.ok) {
    throw new Error(data.message || data.code || `Brevo HTTP ${response.status}`);
  }

  console.log(`✅ Brevo sent to ${to} | messageId: ${data.messageId}`);
  return data;
}

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
        await sendViaBrevo({
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
      sentBy:   req.user._id,
      type:     "direct",
      to, cc, subject, body, priority,
      status:   errors.length === to.length ? "failed" : "sent",
      error:    errors.length ? JSON.stringify(errors) : undefined,
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
        await sendViaBrevo({
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
      sentBy:   req.user._id,
      type:     "team",
      roles,
      to:       recipients.map((u) => u.email),
      subject, body, priority,
      status:   errors.length === recipients.length ? "failed" : "sent",
      error:    errors.length ? JSON.stringify(errors) : undefined,
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
   TEST BREVO — always returns 200, never throws 500
   ============================================================ */
exports.testSmtp = async (req, res) => {
  const apiKey = process.env.BREVO_API_KEY;

  console.log("🧪 testBrevo called");
  console.log("  BREVO_API_KEY:", apiKey ? `SET ✅ (length=${apiKey.length})` : "MISSING ❌");

  if (!apiKey) {
    return res.status(200).json({
      success: false,
      message: "BREVO_API_KEY not set in environment variables.",
    });
  }

  try {
    const response = await fetch("https://api.brevo.com/v3/account", {
      method:  "GET",
      headers: {
        "Accept":  "application/json",
        "api-key": apiKey,
      },
    });

    let data;
    try {
      data = await response.json();
    } catch (_) {
      return res.status(200).json({
        success: false,
        message: `Brevo returned non-JSON (HTTP ${response.status})`,
      });
    }

    console.log("Brevo account check:", JSON.stringify(data));

    if (!response.ok) {
      return res.status(200).json({
        success: false,
        message: data.message || `Brevo API error (HTTP ${response.status}) — API key may be disabled or invalid. Regenerate it at app.brevo.com`,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Brevo connected! Account: ${data.email || data.companyName || "verified"}`,
      plan:    data.plan?.[0]?.type || "free",
      email:   data.email,
    });
  } catch (err) {
    console.error("❌ testBrevo failed:", err.message);
    return res.status(200).json({
      success: false,
      message: err.message || "Could not reach Brevo API",
    });
  }
};

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
