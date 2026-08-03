const nodemailer = require("nodemailer");

let EmailNotification, EmailPreference;
try {
  EmailNotification = require("../models/EmailNotification");
  EmailPreference   = require("../models/EmailPreference");
} catch (e) {
  console.warn("Email models not found:", e.message);
}

const getTransport = () => {
  if (process.env.BREVO_SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.BREVO_SMTP_HOST || "smtp-relay.brevo.com",
      port: parseInt(process.env.BREVO_SMTP_PORT) || 587,
      secure: false,
      auth: { user: process.env.BREVO_SMTP_USER, pass: process.env.BREVO_SMTP_PASS },
    });
  }
  if (process.env.GMAIL_APP_PASSWORD) {
    return nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });
  }
  throw new Error("No email transport configured.");
};

const getFromAddress = () => process.env.EMAIL_FROM || process.env.GMAIL_USER || process.env.BREVO_SMTP_USER;
const getFromName    = () => process.env.EMAIL_FROM_NAME || "Quibo Tech HRMS";
const getAppUrl      = () => process.env.APP_URL || "https://hrmsquibotech.vercel.app";
const getProvider    = () => process.env.BREVO_SMTP_PASS ? "brevo" : "nodemailer";


/* ============================================================
   BREVO REST API SENDER — used for checkout reminders since
   BREVO_API_KEY is the confirmed-working credential on this
   server (SMTP creds are unreliable/unset).
   ============================================================ */
const sendViaBrevoAPI = async ({ to, subject, html, text }) => {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error("BREVO_API_KEY not set in environment variables.");

  const fromEmail = process.env.EMAIL_FROM || "quibotechnologies@gmail.com";
  const fromName  = getFromName();

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: { name: fromName, email: fromEmail },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text || html.replace(/<[^>]*>/g, ""),
    }),
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

  console.log(`✅ Brevo API sent to ${to} | messageId: ${data.messageId}`);
  return data;
};

try {
  const t = getTransport();
  t.verify((err) => {
    if (err) console.error("SMTP failed:", err.message);
    else console.log("SMTP ready");
  });
} catch (err) {
  console.warn("Email transport not configured:", err.message);
}

const sendEmail = async ({ to, subject, html, text }) => {
  const transport = getTransport();
  const info = await transport.sendMail({
    from: `"${getFromName()}" <${getFromAddress()}>`,
    to, subject, html,
    text: text || html.replace(/<[^>]*>/g, ""),
  });
  console.log("Email sent to", to);
  return info;
};

const sendMessageNotification = async ({ message, conversation, recipients }) => {
  if (!recipients || recipients.length === 0) return;
  if (!EmailNotification || !EmailPreference) {
    console.warn("Email models not available");
    return;
  }
  const appUrl           = getAppUrl();
  const senderName       = (message.senderId && message.senderId.name) || "Someone";
  const isGroup          = conversation.type === "group";
  const conversationName = isGroup ? (conversation.name || "Group Chat") : senderName;
  const previewText      = message.content.length > 120 ? message.content.slice(0, 117) + "..." : message.content;
  const subject          = isGroup ? `${senderName} in ${conversationName}` : `New message from ${senderName}`;
  const provider         = getProvider();

  let transport;
  try { transport = getTransport(); }
  catch (err) { console.warn("Email transport not configured:", err.message); return; }

  for (const recipient of recipients) {
    const recipientEmail = recipient.email;
    if (!recipientEmail) continue;

    let pref = await EmailPreference.findOne({ userId: recipient._id });
    if (!pref) pref = await EmailPreference.create({ userId: recipient._id });

    if (!pref.emailNotifications || pref.digestMode === "off") {
      await EmailNotification.create({
        recipientId: recipient._id, recipientEmail,
        senderId: message.senderId._id, conversationId: conversation._id,
        messageId: message._id, subject, body: previewText, status: "skipped", provider,
      });
      continue;
    }

    const isMuted = pref.mutedConversations.map(String).includes(conversation._id.toString());
    if (isMuted) {
      await EmailNotification.create({
        recipientId: recipient._id, recipientEmail,
        senderId: message.senderId._id, conversationId: conversation._id,
        messageId: message._id, subject, body: previewText, status: "skipped", provider,
      });
      continue;
    }

    if (pref.lastEmailSentAt) {
      const mins = (Date.now() - new Date(pref.lastEmailSentAt).getTime()) / 60000;
      if (mins < pref.cooldownMinutes) continue;
    }

    const notifLog = await EmailNotification.create({
      recipientId: recipient._id, recipientEmail,
      senderId: message.senderId._id, conversationId: conversation._id,
      messageId: message._id, subject, body: previewText, status: "pending", provider,
    });

    try {
      const info = await transport.sendMail({
        from: `"${getFromName()}" <${getFromAddress()}>`,
        to: recipientEmail, subject,
        text: `${senderName} sent: ${previewText}\n\nOpen: ${appUrl}`,
        html: `<div style="font-family:Arial,sans-serif;padding:32px;max-width:520px;margin:0 auto"><h2 style="color:#f97316">New Message</h2><p><strong>${senderName}</strong> sent: ${previewText}</p><a href="${appUrl}" style="background:#f97316;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:16px">Open App</a></div>`,
      });
      await EmailNotification.findByIdAndUpdate(notifLog._id, { status: "sent", providerMessageId: info.messageId, sentAt: new Date() });
      await EmailPreference.findByIdAndUpdate(pref._id, { lastEmailSentAt: new Date() });
    } catch (err) {
      console.error("Email failed:", err.message);
      await EmailNotification.findByIdAndUpdate(notifLog._id, { status: "failed", errorMessage: err.message, retryCount: notifLog.retryCount + 1 });
    }
  }
};

const sendWelcomeEmail = async ({ name, email, role }) => {
  const appUrl = getAppUrl();
  try {
    await sendEmail({
      to: email,
      subject: `Welcome to Quibo Tech HRMS, ${name}!`,
      html: `<div style="font-family:Arial,sans-serif;padding:32px;max-width:520px;margin:0 auto"><h2 style="color:#f97316">Welcome, ${name}!</h2><p>Your <strong>${role}</strong> account is ready.</p><a href="${appUrl}" style="background:#f97316;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:16px">Go to Dashboard</a></div>`,
    });
  } catch (err) { console.error("Welcome email failed:", err.message); }
};

const sendLeaveStatusEmail = async ({ to, name, status, leaveType, fromDate, toDate, reason }) => {
  const appUrl = getAppUrl();
  const color  = status === "approved" ? "#16a34a" : "#dc2626";
  try {
    await sendEmail({
      to,
      subject: `Leave Request ${status} - Quibo Tech HRMS`,
      html: `<div style="font-family:Arial,sans-serif;padding:32px;max-width:520px;margin:0 auto"><h2 style="color:${color}">Leave ${status}</h2><p>Hi ${name}, your leave has been <strong>${status}</strong>.</p><p>Type: ${leaveType} | From: ${fromDate} | To: ${toDate}</p>${reason ? `<p>Reason: ${reason}</p>` : ""}<a href="${appUrl}/leaves" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:16px">View Details</a></div>`,
    });
  } catch (err) { console.error("Leave email failed:", err.message); }
};

const sendPayslipEmail = async ({ to, name, month, year }) => {
  const appUrl = getAppUrl();
  try {
    await sendEmail({
      to,
      subject: `Payslip for ${month} ${year} - Quibo Tech HRMS`,
      html: `<div style="font-family:Arial,sans-serif;padding:32px;max-width:520px;margin:0 auto"><h2 style="color:#2563eb">Payslip Ready</h2><p>Hi ${name}, your payslip for ${month} ${year} is ready.</p><a href="${appUrl}/payslips" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:16px">View Payslip</a></div>`,
    });
  } catch (err) { console.error("Payslip email failed:", err.message); }
};
const sendCheckoutReminderEmail = async ({ to, name, checkInTime }) => {
  const appUrl = getAppUrl();
  const html = `<div style="font-family:Arial,sans-serif;padding:32px;max-width:520px;margin:0 auto">
    <h2 style="color:#d97706">Forgot to check out?</h2>
    <p>Hi ${name},</p>
    <p>You checked in at <strong>${checkInTime}</strong> and it's been over 8 hours. If your work day is done, please remember to check out.</p>
    <a href="${appUrl}/attendance" style="background:#d97706;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:16px">Check Out Now</a>
  </div>`;

  // ✅ No try/catch here — let errors propagate to the caller
  // (job + controller) so a failed send is never reported as success.
  return await sendViaBrevoAPI({
    to,
    subject: `⏰ Reminder: You're still checked in — Quibo Tech HRMS`,
    html,
    text: `Hi ${name}, you checked in at ${checkInTime} and it's been over 8 hours. Please remember to check out: ${appUrl}/attendance`,
  });
};

const sendAttendanceAlertEmail = async ({ to, name, date, alertType }) => {
  const appUrl = getAppUrl();
  const msgs   = { late: "You were marked Late today.", absent: "You were marked Absent today.", miss: "You forgot to check out yesterday." };
  try {
    await sendEmail({
      to,
      subject: `Attendance Alert - ${date} | Quibo Tech HRMS`,
      html: `<div style="font-family:Arial,sans-serif;padding:32px;max-width:520px;margin:0 auto"><h2 style="color:#f59e0b">Attendance Alert</h2><p>Hi ${name},</p><p>${msgs[alertType] || "Attendance issue on your account."}</p><p>Date: ${date}</p><a href="${appUrl}/attendance" style="background:#f59e0b;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:16px">View Attendance</a></div>`,
    });
  } catch (err) { console.error("Attendance alert failed:", err.message); }
};

const sendPasswordResetEmail = async ({ to, name, resetToken }) => {
  const appUrl   = getAppUrl();
  const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;
  try {
    await sendEmail({
      to,
      subject: "Reset Your Quibo Tech HRMS Password",
      html: `<div style="font-family:Arial,sans-serif;padding:32px;max-width:520px;margin:0 auto"><h2 style="color:#dc2626">Password Reset</h2><p>Hi ${name}, click below to reset your password. Expires in 1 hour.</p><a href="${resetUrl}" style="background:#dc2626;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:16px">Reset Password</a></div>`,
    });
  } catch (err) { console.error("Password reset email failed:", err.message); }
};

module.exports = {
  sendEmail,
  sendMessageNotification,
  sendWelcomeEmail,
  sendLeaveStatusEmail,
  sendPayslipEmail,
  sendAttendanceAlertEmail,
  sendPasswordResetEmail,
  sendCheckoutReminderEmail,   // ← add this
};
