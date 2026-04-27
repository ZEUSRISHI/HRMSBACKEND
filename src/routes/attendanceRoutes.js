// routes/attendanceRoutes.js
const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/attendanceController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

/* ── Current user ── */
router.post("/checkin",       ctrl.checkIn);
router.post("/checkout",      ctrl.checkOut);
router.get("/today",          ctrl.getTodayAttendance);
router.get("/my",             ctrl.getMyAttendance);

/* ── Admin / HR / Manager ── */
router.get("/today-all",      authorize("admin", "hr", "manager"), ctrl.getTodayAll);
router.get("/all",            authorize("admin", "hr", "manager"), ctrl.getAllAttendance);

/* ── Admin only ── */
router.post("/manual",        authorize("admin"), ctrl.addManualAttendance);
router.get("/manual",         authorize("admin"), ctrl.getManualAttendance);
router.delete("/manual/:id",  authorize("admin"), ctrl.deleteManualAttendance);

module.exports = router;
