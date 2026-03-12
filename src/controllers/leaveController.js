const Leave = require("../models/Leave");
const User  = require("../models/User");

/* ============================================================
   APPLY LEAVE
   POST /api/leaves/apply
   ============================================================ */
const applyLeave = async (req, res) => {
  try {
    const {
      type,
      isEmergency,
      priority,
      startDate,
      endDate,
      reason,
      description,
      emergencyContact,
    } = req.body;

    if (!type || !startDate || !endDate || !reason) {
      return res.status(400).json({
        success: false,
        message: "type, startDate, endDate and reason are required.",
      });
    }

    const days =
      Math.ceil(
        (new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)
      ) + 1;

    const role = req.user.role;

    let initialStatus;

    if (isEmergency) {
      // Emergency leave always starts at pending_manager regardless of role
      initialStatus = "pending_manager";
    } else if (role === "employee") {
      // Employee: manager → hr → admin
      initialStatus = "pending_manager";
    } else {
      // Manager or HR applying: goes straight to admin
      initialStatus = "pending_admin";
    }

    const leave = await Leave.create({
      userId:           req.user._id,
      type,
      isEmergency:      !!isEmergency,
      priority:         priority || "medium",
      startDate,
      endDate,
      days,
      reason,
      description:      description || "",
      emergencyContact: emergencyContact || "",
      status:           initialStatus,
    });

    const populated = await Leave.findById(leave._id).populate(
      "userId",
      "name email role"
    );

    res.status(201).json({
      success: true,
      message: "Leave request submitted successfully.",
      leave:   populated,
    });
  } catch (err) {
    console.error("applyLeave error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   GET MY LEAVES (logged-in user's own leaves)
   GET /api/leaves/my
   ============================================================ */
const getMyLeaves = async (req, res) => {
  try {
    const leaves = await Leave.find({ userId: req.user._id })
      .populate("userId", "name email role")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, total: leaves.length, leaves });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   GET PENDING LEAVES (role-based queue)
   GET /api/leaves/pending

   Manager  → sees: pending_manager (non-emergency + emergency)
   HR       → sees: pending_hr
   Admin    → sees: pending_admin + all non-emergency approved/rejected
             (Admin does NOT see emergency leaves)
   ============================================================ */
const getPendingLeaves = async (req, res) => {
  try {
    const role = req.user.role;
    let query  = {};

    if (role === "manager") {
      query = { status: "pending_manager" };
    } else if (role === "hr") {
      query = { status: "pending_hr" };
    } else if (role === "admin") {
      // Admin sees pending_admin queue only
      // Emergency leaves NEVER reach admin
      query = {
        status:      "pending_admin",
        isEmergency: false,
      };
    }

    const leaves = await Leave.find(query)
      .populate("userId", "name email role department")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, total: leaves.length, leaves });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   GET ALL LEAVES
   GET /api/leaves/all

   Admin → ALL leaves (including approved/rejected) EXCEPT emergency
   HR    → ALL non-emergency leaves
   ============================================================ */
const getAllLeaves = async (req, res) => {
  try {
    const role  = req.user.role;
    let   query = {};

    if (role === "admin") {
      // Admin sees every leave EXCEPT emergency ones that are still at manager stage
      // (emergency leaves that are approved/rejected by manager are also visible)
      query = {
        $or: [
          { isEmergency: false },
          {
            isEmergency: true,
            status: { $in: ["emergency_approved", "rejected"] },
          },
        ],
      };
    } else if (role === "hr") {
      // HR sees all non-emergency leaves
      query = { isEmergency: false };
    }

    const leaves = await Leave.find(query)
      .populate("userId", "name email role department")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, total: leaves.length, leaves });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   APPROVE LEAVE
   PUT /api/leaves/:id/approve

   Manager approving:
     - Emergency → emergency_approved (FINAL — does not go to admin)
     - Normal    → pending_hr

   HR approving:
     - Normal    → pending_admin

   Admin approving:
     - Normal    → approved (FINAL)
   ============================================================ */
const approveLeave = async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id);

    if (!leave) {
      return res
        .status(404)
        .json({ success: false, message: "Leave not found." });
    }

    const role = req.user.role;

    // Validate that this role is allowed to act on current status
    const validAction =
      (role === "manager" && leave.status === "pending_manager") ||
      (role === "hr"      && leave.status === "pending_hr")      ||
      (role === "admin"   && leave.status === "pending_admin");

    if (!validAction) {
      return res.status(403).json({
        success: false,
        message: `You cannot approve a leave with status '${leave.status}'.`,
      });
    }

    if (role === "manager") {
      if (leave.isEmergency) {
        // Emergency leave approved by manager → FINAL
        leave.status           = "emergency_approved";
        leave.approvedByManager = req.user._id;
      } else {
        // Normal leave → escalate to HR
        leave.status           = "pending_hr";
        leave.approvedByManager = req.user._id;
      }
    } else if (role === "hr") {
      // Escalate to admin
      leave.status       = "pending_admin";
      leave.approvedByHR  = req.user._id;
    } else if (role === "admin") {
      // Final approval
      leave.status           = "approved";
      leave.approvedByAdmin   = req.user._id;
    }

    await leave.save();

    const populated = await Leave.findById(leave._id).populate(
      "userId",
      "name email role"
    );

    res.status(200).json({
      success: true,
      message: "Leave approved successfully.",
      leave:   populated,
    });
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
      return res
        .status(404)
        .json({ success: false, message: "Leave not found." });
    }

    const role = req.user.role;

    const validAction =
      (role === "manager" && leave.status === "pending_manager") ||
      (role === "hr"      && leave.status === "pending_hr")      ||
      (role === "admin"   && leave.status === "pending_admin");

    if (!validAction) {
      return res.status(403).json({
        success: false,
        message: `You cannot reject a leave with status '${leave.status}'.`,
      });
    }

    leave.status           = "rejected";
    leave.rejectedBy        = req.user._id;
    leave.rejectedAt        = new Date();
    leave.rejectionReason   = req.body.reason || "";

    await leave.save();

    const populated = await Leave.findById(leave._id).populate(
      "userId",
      "name email role"
    );

    res.status(200).json({
      success: true,
      message: "Leave rejected.",
      leave:   populated,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   EXPORTS
   ============================================================ */
module.exports = {
  applyLeave,
  getMyLeaves,
  getPendingLeaves,
  getAllLeaves,
  approveLeave,
  rejectLeave,
};