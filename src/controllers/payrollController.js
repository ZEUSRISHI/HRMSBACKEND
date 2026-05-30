"use strict";
const Payroll    = require("../models/Payroll");
const User       = require("../models/User");
const Attendance = require("../models/Attendance");
const Leave      = require("../models/Leave");

/* ─── Email via Brevo ─────────────────────────────────────── */
async function sendPayslipEmail({
  to, name, role, month, periodStart, periodEnd,
  workingDays, presentDays, leaveDays, paidLeaveDays,
  basicSalary, earnedBasic, grossSalary, netSalary,
  status, paymentDate, paymentMode
}) {
  const apiKey    = process.env.BREVO_API_KEY;
  const fromEmail = process.env.EMAIL_FROM      || "quibotechnologies@gmail.com";
  const fromName  = process.env.EMAIL_FROM_NAME || "Quibo Tech HRMS";
  if (!apiKey) {
    console.warn("BREVO_API_KEY not set — skipping payslip email");
    return;
  }

  const fmt = (n) =>
    "₹" + (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

  const fmtDate = (d) => {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric"
      });
    } catch { return "—"; }
  };

  const monthLabel = (() => {
    try {
      const [y, m] = month.split("-");
      return new Date(y, m - 1, 1).toLocaleDateString("en-IN", {
        month: "long", year: "numeric"
      });
    } catch { return month; }
  })();

  const initials = name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  const absentDays = Math.max(0, workingDays - presentDays - leaveDays);
  const unpaidLeave = Math.max(0, leaveDays - paidLeaveDays);
  const perDay = workingDays > 0 ? basicSalary / workingDays : 0;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Payslip – ${monthLabel}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f0f4f8;padding:24px 8px}
  @media(max-width:600px){.hide-mob{display:none!important}}
</style>
</head>
<body>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8">
<tr><td align="center" style="padding:24px 8px">
  <table role="presentation" width="620" cellpadding="0" cellspacing="0"
    style="max-width:620px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,.12)">

    <!-- HEADER -->
    <tr><td style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#0f172a 100%);padding:28px 32px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:middle;padding-right:14px">
            <div style="width:48px;height:48px;background:linear-gradient(135deg,#f97316,#ea580c);border-radius:12px;text-align:center;line-height:48px;font-size:20px;font-weight:900;color:#fff">${initials}</div>
          </td>
          <td style="vertical-align:middle">
            <p style="font-size:18px;font-weight:800;color:#ffffff;margin:0">${name}</p>
            <p style="font-size:12px;color:rgba(148,163,184,.9);margin:3px 0 0;text-transform:capitalize">${role} · Quibo Technologies Pvt. Ltd.</p>
          </td>
          <td align="right" class="hide-mob">
            <div style="background:rgba(249,115,22,.15);border:1px solid rgba(249,115,22,.4);border-radius:20px;padding:6px 16px">
              <p style="font-size:10px;font-weight:900;color:#f97316;text-transform:uppercase;letter-spacing:2px;margin:0">PAY SLIP</p>
            </div>
          </td>
        </tr>
      </table>
      <div style="height:3px;background:linear-gradient(90deg,#f97316,#fb923c,#f97316);margin-top:20px"></div>
      <!-- META ROW -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 24px">
        <tr>
          <td style="text-align:center;border-right:1px solid rgba(255,255,255,.1);padding-right:16px">
            <p style="font-size:9px;color:rgba(148,163,184,.7);text-transform:uppercase;letter-spacing:1.5px;margin:0 0 4px">Pay Period</p>
            <p style="font-size:13px;font-weight:700;color:#fff;margin:0">${monthLabel}</p>
          </td>
          <td style="text-align:center;border-right:1px solid rgba(255,255,255,.1);padding:0 16px">
            <p style="font-size:9px;color:rgba(148,163,184,.7);text-transform:uppercase;letter-spacing:1.5px;margin:0 0 4px">Date Range</p>
            <p style="font-size:11px;font-weight:600;color:#e2e8f0;margin:0">${fmtDate(periodStart)} – ${fmtDate(periodEnd)}</p>
          </td>
          <td style="text-align:center;border-right:1px solid rgba(255,255,255,.1);padding:0 16px">
            <p style="font-size:9px;color:rgba(148,163,184,.7);text-transform:uppercase;letter-spacing:1.5px;margin:0 0 4px">Working / Present</p>
            <p style="font-size:13px;font-weight:700;color:#fff;margin:0">${workingDays}W / <span style="color:#4ade80">${presentDays}P</span></p>
          </td>
          <td style="text-align:center;padding-left:16px">
            <p style="font-size:9px;color:rgba(148,163,184,.7);text-transform:uppercase;letter-spacing:1.5px;margin:0 0 4px">Leave / Absent</p>
            <p style="font-size:13px;font-weight:700;color:#fff;margin:0"><span style="color:#fbbf24">${leaveDays}L</span> / <span style="color:#f87171">${absentDays}A</span></p>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- NET TAKE HOME -->
    <tr><td style="background:linear-gradient(135deg,#f97316,#ea580c);padding:20px 32px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <p style="font-size:11px;font-weight:700;color:rgba(255,255,255,.8);text-transform:uppercase;letter-spacing:1.5px;margin:0 0 4px">Net Take-Home Pay</p>
            <p style="font-size:36px;font-weight:900;color:#ffffff;margin:0;letter-spacing:-1px">${fmt(netSalary)}</p>
            <p style="font-size:11px;color:rgba(255,255,255,.75);margin:6px 0 0">
              ${paymentMode ? paymentMode.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase()) : "Bank Transfer"}
              ${paymentDate ? ` · Paid on ${fmtDate(paymentDate)}` : ""}
            </p>
          </td>
          <td align="right" class="hide-mob">
            <div style="background:rgba(255,255,255,.15);border-radius:12px;padding:10px 18px;text-align:center">
              <p style="font-size:10px;font-weight:800;color:rgba(255,255,255,.8);text-transform:uppercase;letter-spacing:1px;margin:0 0 3px">Status</p>
              <p style="font-size:14px;font-weight:900;color:#ffffff;margin:0;text-transform:uppercase">${status}</p>
            </div>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- SALARY BREAKDOWN -->
    <tr><td style="padding:28px 32px">
      <p style="font-size:10px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:2px;margin:0 0 16px;padding-bottom:8px;border-bottom:2px solid #f1f5f9">
        💰 Salary Breakdown
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${[
          ["Full Month Basic Salary", fmt(basicSalary), "#475569", "#1e293b"],
          [`Per Day Rate (÷ ${workingDays} working days)`, fmt(Math.round(perDay)), "#475569", "#1e293b"],
          [`Paid Days (${presentDays} present + ${Math.min(leaveDays, paidLeaveDays)} paid leave)`, String(presentDays + Math.min(leaveDays, paidLeaveDays)) + " days", "#475569", "#1e293b"],
          ...(unpaidLeave > 0 ? [[`Unpaid Leave Deduction (${unpaidLeave} day${unpaidLeave > 1 ? "s" : ""} × ${fmt(Math.round(perDay))})`, `- ${fmt(Math.round(perDay * unpaidLeave))}`, "#dc2626", "#dc2626"]] : []),
          ...(absentDays > 0 ? [[`Absent Deduction (${absentDays} day${absentDays > 1 ? "s" : ""} × ${fmt(Math.round(perDay))})`, `- ${fmt(Math.round(perDay * absentDays))}`, "#dc2626", "#dc2626"]] : []),
        ].map(([label, val, lc, vc]) => `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px">
          <tr>
            <td style="font-size:12px;color:${lc};padding:6px 0">${label}</td>
            <td align="right" style="font-size:12px;font-weight:700;color:${vc};padding:6px 0">${val}</td>
          </tr>
        </table>`).join("")}
        <div style="height:1px;background:#e2e8f0;margin:12px 0"></div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size:14px;font-weight:800;color:#1e293b">Earned Basic (Net Salary)</td>
            <td align="right" style="font-size:16px;font-weight:900;color:#16a34a">${fmt(netSalary)}</td>
          </tr>
        </table>
      </td></tr>

    <!-- FOOTER -->
    <tr><td style="background:linear-gradient(135deg,#0f172a,#1e3a5f);padding:20px 32px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <p style="font-size:11px;color:rgba(148,163,184,.8);margin:0 0 2px">NET SALARY PAYABLE</p>
            <p style="font-size:26px;font-weight:900;color:#ffffff;margin:0">${fmt(netSalary)}</p>
          </td>
          <td align="right" class="hide-mob">
            <p style="font-size:10px;color:rgba(148,163,184,.7);margin:0 0 2px;text-transform:uppercase;letter-spacing:1px">Full Month Basic</p>
            <p style="font-size:14px;font-weight:700;color:#e2e8f0;margin:0">${fmt(basicSalary)}</p>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- COMPANY INFO -->
    <tr><td style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <p style="font-size:12px;font-weight:800;color:#1e293b;margin:0">Quibo Technologies Pvt. Ltd.</p>
            <p style="font-size:10px;color:#94a3b8;margin:2px 0 0">System-generated payslip. No signature required.</p>
          </td>
          <td align="right" class="hide-mob">
            <p style="font-size:10px;color:#94a3b8;margin:0">Generated: ${new Date().toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}</p>
            <p style="font-size:10px;color:#cbd5e1;margin:2px 0 0">HRMS v1.0 · Confidential</p>
          </td>
        </tr>
      </table>
    </td></tr>

  </table>
</td></tr>
</table>
</body></html>`;

  try {
    const resp = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept":        "application/json",
        "api-key":       apiKey,
      },
      body: JSON.stringify({
        sender:      { name: fromName, email: fromEmail },
        to:          [{ email: to, name }],
        subject:     `[Quibo HRMS] Payslip for ${monthLabel} – ${fmt(netSalary)} Net Pay`,
        htmlContent: html,
        textContent: `Hi ${name},\n\nYour payslip for ${monthLabel} is ready.\n\nFull Basic: ${fmt(basicSalary)} | Earned (Net): ${fmt(netSalary)}\n\nQuibo Technologies Pvt. Ltd.`,
      }),
    });
    const data = await resp.json();
    if (!resp.ok) console.error("Brevo error:", data.message);
    else          console.log(`✅ Payslip sent to ${to}`);
  } catch (err) {
    console.error("sendPayslipEmail failed:", err.message);
  }
}

/* ─── Pure calculation — no DB calls ──────────────────────── */
function calcSalary({ basicSalary, workingDays, presentDays, leaveDays, paidLeaveDays }) {
  const wDays         = Math.max(1, Number(workingDays)  || 26);
  const pDays         = Math.max(0, Number(presentDays)  || 0);
  const lDays         = Math.max(0, Number(leaveDays)    || 0);
  const plDays        = Math.max(0, Number(paidLeaveDays)|| 1);
  const basic         = Math.max(0, Number(basicSalary)  || 0);

  const perDay           = basic / wDays;
  const effectivePaidLeave = Math.min(lDays, plDays);
  const paidDays         = pDays + effectivePaidLeave;
  const earnedBasic      = Math.round(perDay * paidDays);

  // No allowances or deductions — gross = net = earnedBasic
  return {
    earnedBasic,
    grossSalary: earnedBasic,
    netSalary:   earnedBasic,
  };
}

/* ─── Month helpers ───────────────────────────────────────── */
function monthBounds(monthStr) {
  const [year, month] = monthStr.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end   = new Date(year, month,     0);
  return { start, end };
}

function countWorkingDays(start, end) {
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    if (cur.getDay() !== 0) count++; // exclude Sundays
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/* ─── Attendance data helper ──────────────────────────────── */
async function getAttendanceData(userId, start, end, workingDays) {
  let leaveDays = 0;
  try {
    const leaves = await Leave.find({
      userId,
      status:    "approved",
      startDate: { $lte: end },
      endDate:   { $gte: start },
    });
    leaves.forEach(l => {
      const s = new Date(Math.max(new Date(l.startDate), start));
      const e = new Date(Math.min(new Date(l.endDate),   end));
      leaveDays += Math.ceil((e - s) / 86400000) + 1;
    });
  } catch (_) {}

  let presentDays = workingDays - leaveDays;
  try {
    const att = await Attendance.countDocuments({
      userId,
      date:   { $gte: start, $lte: end },
      status: "present",
    });
    if (att > 0) presentDays = att;
  } catch (_) {}

  return { leaveDays, presentDays: Math.max(0, presentDays) };
}

/* ═══════════════ CONTROLLERS ════════════════════════════════ */

/* ─── CREATE ─── */
const createPayroll = async (req, res) => {
  try {
    const {
      userId,
      month,
      basicSalary,
      paidLeaveDays = 1,
      paymentMode   = "bank_transfer",
      remarks       = "",
    } = req.body;

    if (!userId || !month || basicSalary === undefined)
      return res.status(400).json({ success: false, message: "userId, month and basicSalary are required." });

    const exists = await Payroll.findOne({ userId, month });
    if (exists)
      return res.status(409).json({ success: false, message: "Payroll already exists for this user/month." });

    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ success: false, message: "User not found." });

    const { start, end }             = monthBounds(month);
    const workingDays                = countWorkingDays(start, end);
    const { leaveDays, presentDays } = await getAttendanceData(userId, start, end, workingDays);

    const calc = calcSalary({
      basicSalary: Number(basicSalary),
      workingDays,
      presentDays,
      leaveDays,
      paidLeaveDays: Number(paidLeaveDays),
    });

    const payroll = await Payroll.create({
      userId,
      month,
      periodStart: start,
      periodEnd:   end,
      role:        user.role,
      workingDays,
      presentDays,
      leaveDays,
      paidLeaveDays: Number(paidLeaveDays),
      basicSalary:   Number(basicSalary),   // full month basic stored
      earnedBasic:   calc.earnedBasic,
      grossSalary:   calc.grossSalary,
      netSalary:     calc.netSalary,
      status:        "draft",
      paymentMode,
      remarks,
    });

    res.status(201).json({ success: true, payroll });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ─── GET ALL ─── */
const getAllPayroll = async (req, res) => {
  try {
    const { month, status, role, startDate, endDate } = req.query;
    const filter = {};
    if (month)  filter.month  = month;
    if (status) filter.status = status;
    if (role)   filter.role   = role;
    if (startDate && endDate) {
      filter.periodStart = { $gte: new Date(startDate) };
      filter.periodEnd   = { $lte: new Date(endDate)   };
    }
    const records = await Payroll.find(filter)
      .populate("userId", "name email role department")
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, records });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ─── GET MY ─── */
const getMyPayroll = async (req, res) => {
  try {
    const records = await Payroll.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, records });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ─── UPDATE ───
   Recalculates earnedBasic/gross/net from the stored basicSalary
   + whatever attendance fields are sent. Saves everything to DB.
─── */
const updatePayroll = async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id);
    if (!payroll)
      return res.status(404).json({ success: false, message: "Record not found." });

    // Pick fields that may change
    const workingDays  = req.body.workingDays  !== undefined ? Number(req.body.workingDays)  : payroll.workingDays;
    const presentDays  = req.body.presentDays  !== undefined ? Number(req.body.presentDays)  : payroll.presentDays;
    const leaveDays    = req.body.leaveDays    !== undefined ? Number(req.body.leaveDays)    : payroll.leaveDays;
    const paidLeaveDays= req.body.paidLeaveDays!== undefined ? Number(req.body.paidLeaveDays): payroll.paidLeaveDays;
    // basicSalary can be changed from the edit form
    const basicSalary  = req.body.basicSalary  !== undefined ? Number(req.body.basicSalary)  : payroll.basicSalary;

    // Always recalculate on update
    const calc = calcSalary({ basicSalary, workingDays, presentDays, leaveDays, paidLeaveDays });

    const updateData = {
      workingDays,
      presentDays,
      leaveDays,
      paidLeaveDays,
      basicSalary,
      earnedBasic:  calc.earnedBasic,
      grossSalary:  calc.grossSalary,
      netSalary:    calc.netSalary,
    };

    // Optional meta fields
    if (req.body.status      !== undefined) updateData.status      = req.body.status;
    if (req.body.paymentMode !== undefined) updateData.paymentMode = req.body.paymentMode;
    if (req.body.remarks     !== undefined) updateData.remarks     = req.body.remarks;

    const updated = await Payroll.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true }
    ).populate("userId", "name email role");

    res.status(200).json({ success: true, payroll: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ─── PROCESS ALL ─── */
const processPayroll = async (req, res) => {
  try {
    const { month } = req.body;
    const filter = month
      ? { status: { $in: ["draft", "pending"] }, month }
      : { status: { $in: ["draft", "pending"] } };

    const payrolls = await Payroll.find(filter).populate("userId", "name email role");
    let processed  = 0;
    const emailErrors = [];

    for (const p of payrolls) {
      p.status      = "processed";
      p.paymentDate = new Date();
      await p.save();
      processed++;

      if (p.userId?.email) {
        try {
          await sendPayslipEmail({
            to:           p.userId.email,
            name:         p.userId.name,
            role:         p.role,
            month:        p.month,
            periodStart:  p.periodStart,
            periodEnd:    p.periodEnd,
            workingDays:  p.workingDays,
            presentDays:  p.presentDays,
            leaveDays:    p.leaveDays,
            paidLeaveDays:p.paidLeaveDays,
            basicSalary:  p.basicSalary,
            earnedBasic:  p.earnedBasic,
            grossSalary:  p.grossSalary,
            netSalary:    p.netSalary,
            status:       p.status,
            paymentDate:  p.paymentDate,
            paymentMode:  p.paymentMode,
          });
        } catch (e) {
          emailErrors.push({ name: p.userId.name, error: e.message });
        }
      }
    }

    res.status(200).json({
      success: true,
      message: `${processed} payroll(s) processed. Emails sent.`,
      processed,
      emailErrors,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ─── MARK AS PAID ─── */
const markAsPaid = async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id).populate("userId", "name email role");
    if (!payroll)
      return res.status(404).json({ success: false, message: "Payroll not found." });

    payroll.status      = "paid";
    payroll.paymentDate = req.body.paymentDate ? new Date(req.body.paymentDate) : new Date();
    if (req.body.paymentMode) payroll.paymentMode = req.body.paymentMode;
    await payroll.save();

    if (payroll.userId?.email) {
      await sendPayslipEmail({
        to:           payroll.userId.email,
        name:         payroll.userId.name,
        role:         payroll.role,
        month:        payroll.month,
        periodStart:  payroll.periodStart,
        periodEnd:    payroll.periodEnd,
        workingDays:  payroll.workingDays,
        presentDays:  payroll.presentDays,
        leaveDays:    payroll.leaveDays,
        paidLeaveDays:payroll.paidLeaveDays,
        basicSalary:  payroll.basicSalary,
        earnedBasic:  payroll.earnedBasic,
        grossSalary:  payroll.grossSalary,
        netSalary:    payroll.netSalary,
        status:       payroll.status,
        paymentDate:  payroll.paymentDate,
        paymentMode:  payroll.paymentMode,
      });
    }

    res.status(200).json({ success: true, message: "Marked as paid. Email sent.", payroll });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ─── RESEND ─── */
const resendPayslip = async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id).populate("userId", "name email role");
    if (!payroll)
      return res.status(404).json({ success: false, message: "Payroll not found." });
    if (!payroll.userId?.email)
      return res.status(400).json({ success: false, message: "Employee email not found." });

    await sendPayslipEmail({
      to:           payroll.userId.email,
      name:         payroll.userId.name,
      role:         payroll.role,
      month:        payroll.month,
      periodStart:  payroll.periodStart,
      periodEnd:    payroll.periodEnd,
      workingDays:  payroll.workingDays,
      presentDays:  payroll.presentDays,
      leaveDays:    payroll.leaveDays,
      paidLeaveDays:payroll.paidLeaveDays,
      basicSalary:  payroll.basicSalary,
      earnedBasic:  payroll.earnedBasic,
      grossSalary:  payroll.grossSalary,
      netSalary:    payroll.netSalary,
      status:       payroll.status,
      paymentDate:  payroll.paymentDate,
      paymentMode:  payroll.paymentMode,
    });

    res.status(200).json({ success: true, message: `Payslip resent to ${payroll.userId.email}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ─── DELETE ─── */
const deletePayroll = async (req, res) => {
  try {
    await Payroll.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Payroll record deleted." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ─── BULK GENERATE ─── */
const bulkGeneratePayroll = async (req, res) => {
  try {
    const { month, paidLeaveDays = 1 } = req.body;
    if (!month)
      return res.status(400).json({ success: false, message: "month is required." });

    const users       = await User.find({ isActive: { $ne: false } });
    const { start, end } = monthBounds(month);
    const workingDays = countWorkingDays(start, end);
    const results     = { created: 0, skipped: 0, errors: [] };

    for (const user of users) {
      if (!user.basicSalary) { results.skipped++; continue; }

      const exists = await Payroll.findOne({ userId: user._id, month });
      if (exists) { results.skipped++; continue; }

      const { leaveDays, presentDays } = await getAttendanceData(user._id, start, end, workingDays);
      const calc = calcSalary({
        basicSalary:  user.basicSalary,
        workingDays,
        presentDays,
        leaveDays,
        paidLeaveDays: Number(paidLeaveDays),
      });

      try {
        await Payroll.create({
          userId:        user._id,
          month,
          periodStart:   start,
          periodEnd:     end,
          role:          user.role,
          workingDays,
          presentDays,
          leaveDays,
          paidLeaveDays: Number(paidLeaveDays),
          basicSalary:   user.basicSalary,
          earnedBasic:   calc.earnedBasic,
          grossSalary:   calc.grossSalary,
          netSalary:     calc.netSalary,
          status:        "draft",
        });
        results.created++;
      } catch (e) {
        results.errors.push({ user: user.name, error: e.message });
      }
    }

    res.status(200).json({ success: true, ...results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ─── BACKFILL ─── */
const backfillPayroll = async (req, res) => {
  try {
    const { months } = req.body;
    if (!months?.length)
      return res.status(400).json({ success: false, message: "months array required." });

    const users   = await User.find({ isActive: { $ne: false } });
    const summary = [];

    for (const month of months) {
      const { start, end } = monthBounds(month);
      const workingDays    = countWorkingDays(start, end);
      let created = 0, skipped = 0;

      for (const user of users) {
        if (!user.basicSalary) { skipped++; continue; }

        const exists = await Payroll.findOne({ userId: user._id, month });
        if (exists) { skipped++; continue; }

        const { leaveDays, presentDays } = await getAttendanceData(user._id, start, end, workingDays);
        const calc = calcSalary({
          basicSalary:  user.basicSalary,
          workingDays,
          presentDays,
          leaveDays,
          paidLeaveDays: 1,
        });

        await Payroll.create({
          userId:       user._id,
          month,
          periodStart:  start,
          periodEnd:    end,
          role:         user.role,
          workingDays,
          presentDays,
          leaveDays,
          paidLeaveDays: 1,
          basicSalary:  user.basicSalary,
          earnedBasic:  calc.earnedBasic,
          grossSalary:  calc.grossSalary,
          netSalary:    calc.netSalary,
          status:       "paid",
          paymentDate:  end,
        });
        created++;
      }
      summary.push({ month, created, skipped });
    }

    res.status(200).json({ success: true, summary });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  createPayroll,
  getAllPayroll,
  getMyPayroll,
  updatePayroll,
  deletePayroll,
  processPayroll,
  markAsPaid,
  resendPayslip,
  bulkGeneratePayroll,
  backfillPayroll,
};
