// controllers/leaveController.js
const Leave = require("../models/Leave");

/* ============================================================
   APPROVAL FLOW RULES
   ─────────────────────────────────────────────────────────────
   Employee (normal)    → pending_hr → pending_manager → pending_admin → approved
   Employee (emergency) → pending_manager → emergency_approved
   HR                   → pending_admin → approved
   Manager              → pending_admin → approved
   ============================================================ */

const initialStatus = (applicantRole, isEmergency) => {
  if (applicantRole === "hr")      return "pending_admin";
  if (applicantRole === "manager") return "pending_admin";
  if (applicantRole === "employee" && isEmergency) return "pending_manager";
  return "pending_hr";
};

const nextStatus = (currentStatus, isEmergency) => {
  if (currentStatus === "pending_hr")      return "pending_manager";
  if (currentStatus === "pending_manager") return isEmergency ? "emergency_approved" : "pending_admin";
  if (currentStatus === "pending_admin")   return "approved";
  return "approved";
};

const canApprove = (actorRole, leave) => {
  if (actorRole === "hr"      && leave.status === "pending_hr")      return true;
  if (actorRole === "manager" && leave.status === "pending_manager") return true;
  if (actorRole === "admin"   && leave.status === "pending_admin")   return true;
  return false;
};

/* ============================================================
   APPLY FOR LEAVE
   POST /api/leaves/apply
   ============================================================ */
const applyLeave = async (req, res) => {
  try {
    const {
      type, isEmergency, priority,
      startDate, endDate, reason, description, emergencyContact,
    } = req.body;

    const applicantRole = req.user.role;
    const status = initialStatus(applicantRole, isEmergency);

    const start = new Date(startDate);
    const end   = new Date(endDate);
    const days  = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1);

    const leave = await Leave.create({
      userId: req.user._id,
      type,
      isEmergency: !!isEmergency,
      priority: priority || "medium",
      startDate,
      endDate,
      days,
      reason,
      description,
      emergencyContact,
      status,
      source: "api",
    });

    res.status(201).json({ success: true, message: "Leave request submitted.", leave });
  } catch (err) {
    console.error("applyLeave error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   APPROVE LEAVE
   PUT /api/leaves/:id/approve
   ============================================================ */
const approveLeave = async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id);
    if (!leave) {
      return res.status(404).json({ success: false, message: "Leave not found." });
    }

    if (!canApprove(req.user.role, leave)) {
      return res.status(403).json({
        success: false,
        message: `You (${req.user.role}) cannot approve a leave in status "${leave.status}".`,
      });
    }

    // Track approver at each stage
    if (req.user.role === "hr")      leave.approvedByHR      = req.user._id;
    if (req.user.role === "manager") leave.approvedByManager = req.user._id;
    if (req.user.role === "admin")   leave.approvedByAdmin   = req.user._id;

    leave.status = nextStatus(leave.status, leave.isEmergency);
    await leave.save();

    res.status(200).json({ success: true, message: "Leave approved.", leave });
  } catch (err) {
    console.error("approveLeave error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   REJECT LEAVE
   PUT /api/leaves/:id/reject
   ============================================================ */
const rejectLeave = async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id);
    if (!leave) {
      return res.status(404).json({ success: false, message: "Leave not found." });
    }

    if (!canApprove(req.user.role, leave)) {
      return res.status(403).json({
        success: false,
        message: `You (${req.user.role}) cannot reject a leave in status "${leave.status}".`,
      });
    }

    leave.status      = "rejected";
    leave.rejectedBy  = req.user._id;
    leave.rejectedAt  = new Date();
    leave.rejectionReason = req.body.rejectionReason || "";
    await leave.save();

    res.status(200).json({ success: true, message: "Leave rejected.", leave });
  } catch (err) {
    console.error("rejectLeave error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   GET MY LEAVES
   GET /api/leaves/my
   ============================================================ */
const getMyLeaves = async (req, res) => {
  try {
    const leaves = await Leave.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, leaves });
  } catch (err) {
    console.error("getMyLeaves error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   GET PENDING LEAVES FOR CURRENT ROLE
   GET /api/leaves/pending
   ─────────────────────────────────────────────────────────────
   HR      → pending_hr
   Manager → pending_manager
   Admin   → pending_admin
   ============================================================ */
const getPendingLeaves = async (req, res) => {
  try {
    const role = req.user.role;
    let statusFilter;

    if (role === "hr")           statusFilter = "pending_hr";
    else if (role === "manager") statusFilter = "pending_manager";
    else if (role === "admin")   statusFilter = "pending_admin";
    else return res.status(403).json({ success: false, message: "Not authorized." });

    const leaves = await Leave.find({ status: statusFilter })
      .populate("userId", "name email role department")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, leaves });
  } catch (err) {
    console.error("getPendingLeaves error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   GET ALL LEAVES  (Admin only)
   GET /api/leaves/all
   ============================================================ */
const getAllLeaves = async (req, res) => {
  try {
    const leaves = await Leave.find()
      .populate("userId", "name email role department")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, leaves });
  } catch (err) {
    console.error("getAllLeaves error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   MANUAL LEAVE ENTRY  (Admin only)
   POST /api/leaves/manual
   Body: { employeeName, type, startDate, endDate, reason, status, priority }
   Saves the record directly to DB — no approval flow needed.
   ============================================================ */
const addManualLeave = async (req, res) => {
  try {
    const {
      employeeName,
      type,
      startDate,
      endDate,
      reason,
      status,
      priority,
    } = req.body;

    // ── validation ──
    if (!employeeName || !employeeName.trim()) {
      return res.status(400).json({ success: false, message: "Employee name is required." });
    }
    if (!type) {
      return res.status(400).json({ success: false, message: "Leave type is required." });
    }
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: "Start date and end date are required." });
    }
    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: "Reason is required." });
    }

    // Only previous dates allowed
    const today = new Date().toISOString().split("T")[0];
    if (endDate >= today) {
      return res.status(400).json({
        success: false,
        message: "Manual leave entry is only allowed for previous dates.",
      });
    }
    if (startDate > endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date cannot be after end date.",
      });
    }

    const start = new Date(startDate);
    const end   = new Date(endDate);
    const days  = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const leave = await Leave.create({
      employeeName: employeeName.trim(),
      type,
      startDate,
      endDate,
      days,
      reason:    reason.trim(),
      status:    status   || "approved",
      priority:  priority || "medium",
      source:    "manual",
      enteredBy: req.user?.name ?? "Admin",
      enteredAt: new Date(),
      // userId intentionally omitted — manual entry has no linked User doc
    });

    res.status(201).json({
      success: true,
      message: "Manual leave record saved.",
      leave,
    });
  } catch (err) {
    console.error("addManualLeave error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   EXPORTS
   ============================================================ */
module.exports = {
  applyLeave,
  approveLeave,
  rejectLeave,
  getMyLeaves,
  getPendingLeaves,
  getAllLeaves,
  addManualLeave,
};
