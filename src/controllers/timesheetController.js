const Timesheet = require("../models/Timesheet");

const addTimesheet = async (req, res) => {
  try {
    const sheet = await Timesheet.create({
      employeeId: req.user._id,
      employeeName: req.user.name,
      ...req.body,
    });
    res.status(201).json({ success: true, sheet });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getMyTimesheets = async (req, res) => {
  try {
    const sheets = await Timesheet.find({ employeeId: req.user._id }).sort({
      date: -1,
    });
    res.status(200).json({ success: true, sheets });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getAllTimesheets = async (req, res) => {
  try {
    const sheets = await Timesheet.find()
      .populate("employeeId", "name email role")
      .sort({ date: -1 });
    res.status(200).json({ success: true, sheets });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const approveTimesheet = async (req, res) => {
  try {
    const sheet = await Timesheet.findByIdAndUpdate(
      req.params.id,
      { status: "approved" },
      { new: true }
    );
    res.status(200).json({ success: true, sheet });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const rejectTimesheet = async (req, res) => {
  try {
    const sheet = await Timesheet.findByIdAndUpdate(
      req.params.id,
      { status: "rejected" },
      { new: true }
    );
    res.status(200).json({ success: true, sheet });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  addTimesheet,
  getMyTimesheets,
  getAllTimesheets,
  approveTimesheet,
  rejectTimesheet,
};