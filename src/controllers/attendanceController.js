// controllers/attendanceController.js
const Attendance = require("../models/Attendance");

/* ============================================================
   PURE JS DATE HELPERS  (no external dependency)
   ============================================================ */

const todayStr = () => new Date().toISOString().split("T")[0];

const nowTimeStr = () => {
  const now = new Date();
  return (
    now.getHours().toString().padStart(2, "0") +
    ":" +
    now.getMinutes().toString().padStart(2, "0")
  );
};

const toDateStr = (d) => {
  // Returns "YYYY-MM-DD" for any Date object (local time)
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

const parseLocalDate = (str) => {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
};

// Returns array of "YYYY-MM-DD" strings from startStr to endStr inclusive
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
   CHECK IN
   POST /api/attendance/checkin
   ============================================================ */
const checkIn = async (req, res) => {
  try {
    const today = todayStr();

    // Check if already checked in
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
      checkIn:  nowTimeStr(),
      status:   "present",
      isManual: false,
    });

    await record.populate("userId", "name email role");

    res.status(201).json({
      success: true,
      message: "Checked in successfully.",
      record,
    });
  } catch (err) {
    // Handle race-condition duplicate key gracefully
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
   CHECK OUT
   POST /api/attendance/checkout
   ============================================================ */
const checkOut = async (req, res) => {
  try {
    const today = todayStr();

    const record = await Attendance.findOneAndUpdate(
      { userId: req.user._id, date: today, isManual: false },
      { checkOut: nowTimeStr() },
      { new: true }
    ).populate("userId", "name email role");

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
   GET TODAY ATTENDANCE  (logged-in user only)
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
   GET TODAY ALL USERS  (Admin / HR / Manager)
   GET /api/attendance/today-all
   ============================================================ */
const getTodayAll = async (req, res) => {
  try {
    const records = await Attendance.find({
      date:     todayStr(),
      isManual: false,
    })
      .populate("userId", "name email role department")
      .sort({ checkIn: 1 });

    res.status(200).json({ success: true, total: records.length, records });
  } catch (err) {
    console.error("getTodayAll error:", err);
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
   GET ALL ATTENDANCE  (Admin / HR / Manager)
   GET /api/attendance/all
   Returns BOTH real and manual records merged and sorted by date
   ============================================================ */
const getAllAttendance = async (req, res) => {
  try {
    const records = await Attendance.find()
      .populate("userId",    "name email role department")
      .populate("enteredBy", "name")
      .sort({ date: -1 });

    res.status(200).json({ success: true, total: records.length, records });
  } catch (err) {
    console.error("getAllAttendance error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   ADD MANUAL ATTENDANCE  (Admin only)
   POST /api/attendance/manual
   Body: { employeeName, employeeRole, startDate, endDate, checkIn, checkOut? }
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
    } = req.body;

    /* ── Validation ── */
    if (!employeeName || !employeeRole || !startDate || !endDate || !checkIn) {
      return res.status(400).json({
        success: false,
        message:
          "employeeName, employeeRole, startDate, endDate and checkIn are all required.",
      });
    }

    const today = todayStr();

    if (endDate >= today) {
      return res.status(400).json({
        success: false,
        message:
          "Manual entry is only allowed for previous dates (not today or future).",
      });
    }

    if (startDate > endDate) {
      return res.status(400).json({
        success: false,
        message: "startDate cannot be after endDate.",
      });
    }

    /* ── One document per calendar day ── */
    const days = eachDay(startDate, endDate);

    const records = await Attendance.insertMany(
      days.map((date) => ({
        // NOTE: no userId field — manual records are free-text only
        date,
        checkIn,
        checkOut:           checkOut || null,
        status:             "present",
        isManual:           true,
        manualEmployeeName: employeeName.trim(),
        manualEmployeeRole: employeeRole,
        enteredBy:          req.user._id,
        enteredByName:      req.user.name,
      }))
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
   GET ALL MANUAL ATTENDANCE  (Admin only)
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
   DELETE ONE MANUAL ATTENDANCE RECORD  (Admin only)
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

    res.status(200).json({
      success: true,
      message: "Manual attendance record deleted successfully.",
    });
  } catch (err) {
    console.error("deleteManualAttendance error:", err);
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
  getTodayAll,
  getMyAttendance,
  getAllAttendance,
  addManualAttendance,
  getManualAttendance,
  deleteManualAttendance,
};
