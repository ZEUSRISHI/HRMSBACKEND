const Attendance = require("../models/Attendance");

/* ============================================================
   CHECK IN
   POST /api/attendance/checkin
   ============================================================ */
const checkIn = async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    const existing = await Attendance.findOne({
      userId: req.user._id,
      date: today,
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Already checked in today.",
        record: existing,
      });
    }

    const now = new Date();
    const checkInTime =
      now.getHours().toString().padStart(2, "0") +
      ":" +
      now.getMinutes().toString().padStart(2, "0");

    const record = await Attendance.create({
      userId: req.user._id,
      date: today,
      checkIn: checkInTime,
      status: "present",
    });

    res.status(201).json({
      success: true,
      message: "Checked in successfully.",
      record,
    });
  } catch (err) {
    console.error("checkIn error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   CHECK OUT
   POST /api/attendance/checkout
   ============================================================ */
const checkOut = async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    const now = new Date();
    const checkOutTime =
      now.getHours().toString().padStart(2, "0") +
      ":" +
      now.getMinutes().toString().padStart(2, "0");

    const record = await Attendance.findOneAndUpdate(
      { userId: req.user._id, date: today },
      { checkOut: checkOutTime },
      { new: true }
    );

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "No check-in found for today. Please check in first.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Checked out successfully.",
      record,
    });
  } catch (err) {
    console.error("checkOut error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   GET TODAY ATTENDANCE
   GET /api/attendance/today
   ============================================================ */
const getTodayAttendance = async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    const record = await Attendance.findOne({
      userId: req.user._id,
      date: today,
    });

    res.status(200).json({
      success: true,
      record: record || null,
    });
  } catch (err) {
    console.error("getTodayAttendance error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   GET MY ATTENDANCE
   GET /api/attendance/my
   ============================================================ */
const getMyAttendance = async (req, res) => {
  try {
    const records = await Attendance.find({ userId: req.user._id }).sort({
      date: -1,
    });

    res.status(200).json({
      success: true,
      total: records.length,
      records,
    });
  } catch (err) {
    console.error("getMyAttendance error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   GET ALL ATTENDANCE (Admin / HR / Manager)
   GET /api/attendance/all
   ============================================================ */
const getAllAttendance = async (req, res) => {
  try {
    const records = await Attendance.find()
      .populate("userId", "name email role department")
      .sort({ date: -1 });

    res.status(200).json({
      success: true,
      total: records.length,
      records,
    });
  } catch (err) {
    console.error("getAllAttendance error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   EXPORTS
   ============================================================ */
module.exports = {
  checkIn,
  checkOut,
  getTodayAttendance,
  getMyAttendance,
  getAllAttendance,
};