const Leave = require("../models/Leave");

const applyLeave = async (req, res) => {
  try {
    const { type, priority, startDate, endDate, reason, description } = req.body;

    const days =
      Math.ceil(
        (new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)
      ) + 1;

    const leave = await Leave.create({
      userId: req.user._id,
      type,
      priority,
      startDate,
      endDate,
      days,
      reason,
      description,
      status: "pending_manager",
    });

    res.status(201).json({ success: true, message: "Leave applied.", leave });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getMyLeaves = async (req, res) => {
  try {
    const leaves = await Leave.find({ userId: req.user._id }).sort({
      createdAt: -1,
    });
    res.status(200).json({ success: true, leaves });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getPendingLeaves = async (req, res) => {
  try {
    const role = req.user.role;
    let statusFilter;

    if (role === "manager") statusFilter = "pending_manager";
    else if (role === "hr") statusFilter = "pending_hr";
    else if (role === "admin")
      statusFilter = {
        $in: ["pending_manager", "pending_hr", "pending_admin"],
      };

    const leaves = await Leave.find({ status: statusFilter })
      .populate("userId", "name email role")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, leaves });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const approveLeave = async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id);
    if (!leave)
      return res
        .status(404)
        .json({ success: false, message: "Leave not found." });

    const role = req.user.role;
    if (role === "manager") leave.status = "pending_hr";
    else if (role === "hr") leave.status = "pending_admin";
    else if (role === "admin") leave.status = "approved";

    await leave.save();
    res.status(200).json({ success: true, message: "Leave approved.", leave });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const rejectLeave = async (req, res) => {
  try {
    const leave = await Leave.findByIdAndUpdate(
      req.params.id,
      { status: "rejected" },
      { new: true }
    );
    res.status(200).json({ success: true, message: "Leave rejected.", leave });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getAllLeaves = async (req, res) => {
  try {
    const leaves = await Leave.find()
      .populate("userId", "name email role")
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, leaves });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  applyLeave,
  getMyLeaves,
  getPendingLeaves,
  approveLeave,
  rejectLeave,
  getAllLeaves,
};