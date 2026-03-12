const express = require("express");
const router = express.Router();
const attendanceController = require("../controllers/attendanceController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

router.post("/checkin",  attendanceController.checkIn);
router.post("/checkout", attendanceController.checkOut);
router.get("/today",     attendanceController.getTodayAttendance);
router.get("/my",        attendanceController.getMyAttendance);
router.get("/all",       authorize("admin", "hr", "manager"), attendanceController.getAllAttendance);

module.exports = router;