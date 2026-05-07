// controllers/attendanceController.js
"use strict";

const Attendance = require("../models/Attendance");
const User       = require("../models/User");

/* ============================================================
   IST TIME HELPERS
   ============================================================ */
const todayStr = () => {
  const now = new Date();
  const y   = now.getFullYear();
  const m   = String(now.getMonth() + 1).padStart(2, "0");
  const d   = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const nowTimeStr = () => {
  const now   = new Date();
  const hours = now.getHours();
  const mins  = now.getMinutes();
  const ampm  = hours >= 12 ? "PM" : "AM";
  const h12   = hours % 12 || 12;
  return `${h12.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")} ${ampm}`;
};

const to12Hour = (t) => {
  if (!t) return null;
  if (t.includes("AM") || t.includes("PM")) return t;
  const [hh, mm] = t.split(":").map(Number);
  const ampm = hh >= 12 ? "PM" : "AM";
  const h12  = hh % 12 || 12;
  return `${h12.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")} ${ampm}`;
};

const toDateStr = (d) => {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

const parseLocalDate = (str) => {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const eachDay = (startStr, endStr) => {
  const days   = [];
  const cursor = parseLocalDate(startStr);
  const end    = parseLocalDate(endStr);
  while (cursor <= end) {
    days.push(toDateStr(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
};

/* ============================================================
   CHECK IN — Manual only, user must click the button
   Supports Employee, HR, Admin, Manager
   Accepts optional { tagline } in request body — stored to MongoDB
   POST /api/attendance/checkin
   ============================================================ */
const checkIn = async (req, res) => {
  try {
    const today   = todayStr();
    const timeNow = nowTimeStr();
    const tagline = (req.body?.tagline ?? "").toString().trim().slice(0, 200);

    const existing = await Attendance.findOne({
      userId:   req.user._id,
      date:     today,
      isManual: false,
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Already checked in today.",
        record:  existing,
      });
    }

    const record = await Attendance.create({
      userId:   req.user._id,
      date:     today,
      checkIn:  timeNow,
      tagline:  tagline || undefined,
      status:   "present",
      isManual: false,
    });

    await record.populate("userId", "name email role");

    console.log(
      `✅ CheckIn → user: ${req.user.name} (${req.user.role}) | date: ${today} | time: ${timeNow}` +
      (tagline ? ` | tagline: "${tagline}"` : "")
    );

    res.status(201).json({
      success: true,
      message: `Checked in successfully at ${timeNow}`,
      record,
    });
  } catch (err) {
    if (err.code === 11000) {
      const existing = await Attendance.findOne({
        userId:   req.user._id,
        date:     todayStr(),
        isManual: false,
      }).populate("userId", "name email role");
      return res.status(400).json({
        success: false,
        message: "Already checked in today.",
        record:  existing,
      });
    }
    console.error("checkIn error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   CHECK OUT — Manual only, user must click the button
   POST /api/attendance/checkout
   ============================================================ */
const checkOut = async (req, res) => {
  try {
    const today   = todayStr();
    const timeNow = nowTimeStr();

    const record = await Attendance.findOneAndUpdate(
      { userId: req.user._id, date: today, isManual: false },
      { checkOut: timeNow },
      { new: true }
    ).populate("userId", "name email role");

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "No check-in found for today. Please check in first.",
      });
    }

    console.log(`✅ CheckOut → user: ${req.user.name} (${req.user.role}) | date: ${today} | time: ${timeNow}`);

    res.status(200).json({
      success: true,
      message: `Checked out successfully at ${timeNow}`,
      record,
    });
  } catch (err) {
    console.error("checkOut error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   ADMIN / HR — CHECK IN FOR A SPECIFIC USER
   POST /api/attendance/admin-checkin/:userId
   Body: { tagline? }
   ============================================================ */
const adminCheckInForUser = async (req, res) => {
  try {
    const today   = todayStr();
    const timeNow = nowTimeStr();
    const tagline = (req.body?.tagline ?? "").toString().trim().slice(0, 200);

    const targetUser = await User.findById(req.params.userId).select("name email role");
    if (!targetUser) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const existing = await Attendance.findOne({
      userId:   targetUser._id,
      date:     today,
      isManual: false,
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: `${targetUser.name} has already checked in today.`,
        record:  existing,
      });
    }

    const record = await Attendance.create({
      userId:   targetUser._id,
      date:     today,
      checkIn:  timeNow,
      tagline:  tagline || undefined,
      status:   "present",
      isManual: false,
    });

    await record.populate("userId", "name email role");

    console.log(
      `✅ AdminCheckIn → target: ${targetUser.name} (${targetUser.role}) | by: ${req.user.name} (${req.user.role}) | time: ${timeNow}` +
      (tagline ? ` | tagline: "${tagline}"` : "")
    );

    res.status(201).json({
      success: true,
      message: `Checked in ${targetUser.name} at ${timeNow}`,
      record,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "User already checked in today.",
      });
    }
    console.error("adminCheckInForUser error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   ADMIN / HR — CHECK OUT FOR A SPECIFIC USER
   POST /api/attendance/admin-checkout/:userId
   ============================================================ */
const adminCheckOutForUser = async (req, res) => {
  try {
    const today   = todayStr();
    const timeNow = nowTimeStr();

    const targetUser = await User.findById(req.params.userId).select("name email role");
    if (!targetUser) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const record = await Attendance.findOneAndUpdate(
      { userId: targetUser._id, date: today, isManual: false },
      { checkOut: timeNow },
      { new: true }
    ).populate("userId", "name email role");

    if (!record) {
      return res.status(404).json({
        success: false,
        message: `${targetUser.name} has not checked in today.`,
      });
    }

    console.log(
      `✅ AdminCheckOut → target: ${targetUser.name} (${targetUser.role}) | by: ${req.user.name} (${req.user.role}) | time: ${timeNow}`
    );

    res.status(200).json({
      success: true,
      message: `Checked out ${targetUser.name} at ${timeNow}`,
      record,
    });
  } catch (err) {
    console.error("adminCheckOutForUser error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   GET TODAY ATTENDANCE — current logged-in user
   GET /api/attendance/today
   ============================================================ */
const getTodayAttendance = async (req, res) => {
  try {
    const record = await Attendance.findOne({
      userId:   req.user._id,
      date:     todayStr(),
      isManual: false,
    });
    res.status(200).json({ success: true, record: record || null });
  } catch (err) {
    console.error("getTodayAttendance error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   GET TODAY ALL USERS — Admin / HR / Manager
   GET /api/attendance/today-all
   ============================================================ */
const getTodayAll = async (req, res) => {
  try {
    const records = await Attendance.find({
      date:     todayStr(),
      isManual: false,
    })
      .populate("userId", "name email role department designation")
      .sort({ checkIn: 1 });

    res.status(200).json({ success: true, total: records.length, records });
  } catch (err) {
    console.error("getTodayAll error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   GET ALL USERS LIST — Admin / HR (for admin panel check-in/out)
   GET /api/attendance/users-list
   ============================================================ */
const getAllUsersList = async (req, res) => {
  try {
    const users = await User.find({ isActive: true })
      .select("name email role department designation avatar")
      .sort({ name: 1 });

    res.status(200).json({ success: true, total: users.length, users });
  } catch (err) {
    console.error("getAllUsersList error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   GET MY ATTENDANCE
   GET /api/attendance/my
   ============================================================ */
const getMyAttendance = async (req, res) => {
  try {
    const records = await Attendance.find({
      userId:   req.user._id,
      isManual: false,
    }).sort({ date: -1 });
    res.status(200).json({ success: true, total: records.length, records });
  } catch (err) {
    console.error("getMyAttendance error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   GET ALL ATTENDANCE — Admin / HR / Manager
   GET /api/attendance/all
   ============================================================ */
const getAllAttendance = async (req, res) => {
  try {
    const records = await Attendance.find()
      .populate("userId",    "name email role department designation")
      .populate("enteredBy", "name")
      .sort({ date: -1 });
    res.status(200).json({ success: true, total: records.length, records });
  } catch (err) {
    console.error("getAllAttendance error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   ADD MANUAL ATTENDANCE — Admin only
   POST /api/attendance/manual
   ============================================================ */
const addManualAttendance = async (req, res) => {
  try {
    const {
      employeeName,
      employeeRole,
      startDate,
      endDate,
      checkIn,
      checkOut,
      tagline,
    } = req.body;

    if (!employeeName || !employeeRole || !startDate || !endDate || !checkIn) {
      return res.status(400).json({
        success: false,
        message: "employeeName, employeeRole, startDate, endDate and checkIn are required.",
      });
    }

    const today = todayStr();

    if (endDate >= today) {
      return res.status(400).json({
        success: false,
        message: "Manual entry is only allowed for previous dates (not today or future).",
      });
    }

    if (startDate > endDate) {
      return res.status(400).json({
        success: false,
        message: "startDate cannot be after endDate.",
      });
    }

    const checkInFormatted  = to12Hour(checkIn);
    const checkOutFormatted = checkOut ? to12Hour(checkOut) : null;
    const taglineTrimmed    = (tagline ?? "").toString().trim().slice(0, 200) || undefined;

    const days = eachDay(startDate, endDate);

    const records = await Attendance.insertMany(
      days.map((date) => ({
        date,
        checkIn:            checkInFormatted,
        checkOut:           checkOutFormatted,
        tagline:            taglineTrimmed,
        status:             "present",
        isManual:           true,
        manualEmployeeName: employeeName.trim(),
        manualEmployeeRole: employeeRole,
        enteredBy:          req.user._id,
        enteredByName:      req.user.name,
      }))
    );

    console.log(
      `✅ Manual Attendance saved → ${records.length} record(s) | employee: ${employeeName}` +
      ` | ${startDate} to ${endDate} | by: ${req.user.name}` +
      (taglineTrimmed ? ` | tagline: "${taglineTrimmed}"` : "")
    );

    res.status(201).json({
      success: true,
      message: `${records.length} manual attendance record(s) saved successfully.`,
      records,
    });
  } catch (err) {
    console.error("addManualAttendance error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   GET ALL MANUAL ATTENDANCE — Admin only
   GET /api/attendance/manual
   ============================================================ */
const getManualAttendance = async (req, res) => {
  try {
    const records = await Attendance.find({ isManual: true })
      .populate("enteredBy", "name")
      .sort({ date: -1 });
    res.status(200).json({ success: true, total: records.length, records });
  } catch (err) {
    console.error("getManualAttendance error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   DELETE ONE MANUAL ATTENDANCE RECORD — Admin only
   DELETE /api/attendance/manual/:id
   ============================================================ */
const deleteManualAttendance = async (req, res) => {
  try {
    const record = await Attendance.findOneAndDelete({
      _id:      req.params.id,
      isManual: true,
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Manual attendance record not found.",
      });
    }

    console.log(`🗑️ Manual Attendance deleted → id: ${req.params.id} | by: ${req.user.name}`);

    res.status(200).json({
      success: true,
      message: "Manual attendance record deleted successfully.",
    });
  } catch (err) {
    console.error("deleteManualAttendance error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  checkIn,
  checkOut,
  adminCheckInForUser,
  adminCheckOutForUser,
  getAllUsersList,
  getTodayAttendance,
  getTodayAll,
  getMyAttendance,
  getAllAttendance,
  addManualAttendance,
  getManualAttendance,
  deleteManualAttendance,
};
