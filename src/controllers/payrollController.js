const Payroll  = require("../models/Payroll");
const User     = require("../models/User");
const Leave    = require("../models/Leave");        // adjust path if needed
const Attendance = require("../models/Attendance"); // adjust path if needed

/* ─── helpers ─────────────────────────────────────────────── */

/** Return the first and last date of a "YYYY-MM" string */
function monthBounds(monthStr) {
  const [year, month] = monthStr.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end   = new Date(year, month, 0);          // last day of month
  return { start, end };
}

/** Count weekdays (Mon–Sat) in a date range (typical startup: 26 days) */
function countWorkingDays(start, end) {
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const d = cur.getDay();
    if (d !== 0) count++;   // exclude Sundays only (6-day week)
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/** Role-based salary structure (CTC bands for startups) */
function getRoleStructure(role, basicSalary) {
  const structures = {
    admin:    { pfRate: 0.12, esiRate: 0.0075, hraRate: 0.40, travelAllowance: 3000, medicalAllowance: 1250 },
    hr:       { pfRate: 0.12, esiRate: 0.0075, hraRate: 0.40, travelAllowance: 2000, medicalAllowance: 1250 },
    manager:  { pfRate: 0.12, esiRate: 0.0075, hraRate: 0.40, travelAllowance: 2500, medicalAllowance: 1250 },
    employee: { pfRate: 0.12, esiRate: 0.0075, hraRate: 0.40, travelAllowance: 1500, medicalAllowance: 1250 },
    intern:   { pfRate: 0.00, esiRate: 0.00,   hraRate: 0.20, travelAllowance: 500,  medicalAllowance: 0    },
  };
  return structures[role?.toLowerCase()] || structures.employee;
}

/** Build full salary breakdown */
function calculateSalary({ basicSalary, role, workingDays, presentDays, leaveDays, paidLeaveDays, extraAllowances = {}, extraDeductions = {} }) {
  const struct = getRoleStructure(role, basicSalary);

  // per-day salary for loss-of-pay calc
  const perDay = workingDays > 0 ? basicSalary / workingDays : 0;
  const unpaidLeaves = Math.max(0, leaveDays - paidLeaveDays);
  const leaveDeduction = Math.round(perDay * unpaidLeaves);

  // Earned basic (proportional to present days + paid leaves)
  const earnedBasic = Math.round(perDay * (presentDays + paidLeaveDays));

  // Allowances
  const hra     = Math.round(earnedBasic * struct.hraRate);
  const travel  = struct.travelAllowance;
  const medical = struct.medicalAllowance;
  const special = extraAllowances.special || 0;
  const otherA  = extraAllowances.other   || 0;

  const grossSalary = earnedBasic + hra + travel + medical + special + otherA;

  // Deductions
  const pf  = Math.round(earnedBasic * struct.pfRate);
  const esi = grossSalary <= 21000 ? Math.round(grossSalary * struct.esiRate) : 0;
  const tds = extraDeductions.tds   || 0;
  const otherD = extraDeductions.other || 0;

  const totalDeductions = pf + esi + tds + leaveDeduction + otherD;
  const netSalary = Math.max(0, grossSalary - totalDeductions);

  return {
    earnedBasic,
    allowances: { hra, travel, medical, special, other: otherA },
    deductions: { pf, esi, tds, leaveDeduction, other: otherD },
    grossSalary,
    totalDeductions,
    netSalary,
  };
}

/* ─── CREATE ───────────────────────────────────────────────── */
const createPayroll = async (req, res) => {
  try {
    const {
      userId, month,
      basicSalary,
      extraAllowances = {},
      extraDeductions = {},
      paidLeaveDays   = 1,    // e.g. 1 casual leave per month paid
      paymentMode     = "bank_transfer",
      remarks         = "",
    } = req.body;

    if (!userId || !month || !basicSalary)
      return res.status(400).json({ success: false, message: "userId, month and basicSalary are required." });

    // Prevent duplicate
    const exists = await Payroll.findOne({ userId, month });
    if (exists)
      return res.status(409).json({ success: false, message: "Payroll for this user and month already exists." });

    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ success: false, message: "User not found." });

    const { start, end } = monthBounds(month);
    const workingDays = countWorkingDays(start, end);

    // Fetch approved leaves for this month
    let leaveDays = 0;
    try {
      const leaves = await Leave.find({
        userId,
        status: "approved",
        startDate: { $lte: end },
        endDate:   { $gte: start },
      });
      leaves.forEach((l) => {
        const s = new Date(Math.max(l.startDate, start));
        const e = new Date(Math.min(l.endDate,   end));
        const diff = Math.ceil((e - s) / (1000 * 60 * 60 * 24)) + 1;
        leaveDays += diff;
      });
    } catch (_) { /* Leave model may not exist yet */ }

    // Fetch attendance for this month
    let presentDays = workingDays - leaveDays;
    try {
      const att = await Attendance.countDocuments({
        userId,
        date: { $gte: start, $lte: end },
        status: "present",
      });
      if (att > 0) presentDays = att;
    } catch (_) { /* Attendance model may not exist yet */ }

    presentDays = Math.max(0, presentDays);

    const calc = calculateSalary({
      basicSalary: Number(basicSalary),
      role: user.role,
      workingDays,
      presentDays,
      leaveDays,
      paidLeaveDays: Number(paidLeaveDays),
      extraAllowances,
      extraDeductions,
    });

    const payroll = await Payroll.create({
      userId,
      month,
      periodStart:    start,
      periodEnd:      end,
      role:           user.role,
      workingDays,
      presentDays,
      leaveDays,
      paidLeaveDays:  Number(paidLeaveDays),
      basicSalary:    calc.earnedBasic,
      allowances:     calc.allowances,
      deductions:     calc.deductions,
      grossSalary:    calc.grossSalary,
      totalDeductions:calc.totalDeductions,
      netSalary:      calc.netSalary,
      status:         "draft",
      paymentMode,
      remarks,
    });

    res.status(201).json({ success: true, payroll });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ─── GET ALL (admin / hr) ─────────────────────────────────── */
const getAllPayroll = async (req, res) => {
  try {
    const { month, status, role, startDate, endDate } = req.query;
    const filter = {};

    if (month)     filter.month  = month;
    if (status)    filter.status = status;
    if (role)      filter.role   = role;
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

/* ─── GET MY ───────────────────────────────────────────────── */
const getMyPayroll = async (req, res) => {
  try {
    const records = await Payroll.find({ userId: req.user._id })
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, records });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ─── PROCESS ALL PENDING ──────────────────────────────────── */
const processPayroll = async (req, res) => {
  try {
    const { month } = req.body;
    const filter = month
      ? { status: { $in: ["draft", "pending"] }, month }
      : { status: { $in: ["draft", "pending"] } };

    const result = await Payroll.updateMany(filter, {
      status: "processed",
      paymentDate: new Date(),
    });

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} payroll(s) processed successfully.`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ─── UPDATE ───────────────────────────────────────────────── */
const updatePayroll = async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id);
    if (!payroll)
      return res.status(404).json({ success: false, message: "Record not found." });

    // If salary components change, recalculate
    if (
      req.body.basicSalary  !== undefined ||
      req.body.allowances   !== undefined ||
      req.body.deductions   !== undefined ||
      req.body.leaveDays    !== undefined ||
      req.body.presentDays  !== undefined
    ) {
      const calc = calculateSalary({
        basicSalary:    req.body.basicSalary   ?? payroll.basicSalary,
        role:           payroll.role,
        workingDays:    req.body.workingDays   ?? payroll.workingDays,
        presentDays:    req.body.presentDays   ?? payroll.presentDays,
        leaveDays:      req.body.leaveDays     ?? payroll.leaveDays,
        paidLeaveDays:  req.body.paidLeaveDays ?? payroll.paidLeaveDays,
        extraAllowances: req.body.allowances   ?? {},
        extraDeductions: req.body.deductions   ?? {},
      });

      req.body.grossSalary    = calc.grossSalary;
      req.body.totalDeductions= calc.totalDeductions;
      req.body.netSalary      = calc.netSalary;
      if (req.body.allowances === undefined) req.body.allowances = calc.allowances;
      if (req.body.deductions === undefined) req.body.deductions = calc.deductions;
    }

    const updated = await Payroll.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    ).populate("userId", "name email role");

    res.status(200).json({ success: true, payroll: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ─── DELETE ───────────────────────────────────────────────── */
const deletePayroll = async (req, res) => {
  try {
    await Payroll.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Payroll record deleted." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ─── BULK CREATE for a month (auto-generate for all employees) */
const bulkGeneratePayroll = async (req, res) => {
  try {
    const { month, paidLeaveDays = 1 } = req.body;
    if (!month)
      return res.status(400).json({ success: false, message: "month is required." });

    const users = await User.find({ isActive: { $ne: false } });
    const { start, end } = monthBounds(month);
    const workingDays = countWorkingDays(start, end);

    const results = { created: 0, skipped: 0, errors: [] };

    for (const user of users) {
      if (!user.basicSalary) { results.skipped++; continue; }

      const exists = await Payroll.findOne({ userId: user._id, month });
      if (exists)  { results.skipped++; continue; }

      let leaveDays = 0;
      try {
        const leaves = await Leave.find({
          userId: user._id,
          status: "approved",
          startDate: { $lte: end },
          endDate:   { $gte: start },
        });
        leaves.forEach((l) => {
          const s = new Date(Math.max(new Date(l.startDate), start));
          const e = new Date(Math.min(new Date(l.endDate),   end));
          leaveDays += Math.ceil((e - s) / (1000 * 60 * 60 * 24)) + 1;
        });
      } catch (_) {}

      let presentDays = workingDays - leaveDays;
      try {
        const att = await Attendance.countDocuments({
          userId: user._id,
          date: { $gte: start, $lte: end },
          status: "present",
        });
        if (att > 0) presentDays = att;
      } catch (_) {}

      presentDays = Math.max(0, presentDays);

      const calc = calculateSalary({
        basicSalary: user.basicSalary,
        role: user.role,
        workingDays,
        presentDays,
        leaveDays,
        paidLeaveDays: Number(paidLeaveDays),
      });

      try {
        await Payroll.create({
          userId:         user._id,
          month,
          periodStart:    start,
          periodEnd:      end,
          role:           user.role,
          workingDays,
          presentDays,
          leaveDays,
          paidLeaveDays:  Number(paidLeaveDays),
          basicSalary:    calc.earnedBasic,
          allowances:     calc.allowances,
          deductions:     calc.deductions,
          grossSalary:    calc.grossSalary,
          totalDeductions:calc.totalDeductions,
          netSalary:      calc.netSalary,
          status:         "draft",
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

module.exports = {
  createPayroll,
  getAllPayroll,
  getMyPayroll,
  processPayroll,
  updatePayroll,
  deletePayroll,
  bulkGeneratePayroll,
};
