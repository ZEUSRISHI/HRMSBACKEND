"use strict";
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/attendanceController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

router.post("/checkin", ctrl.checkIn);
router.post("/checkout", ctrl.checkOut);
router.patch("/update-location", ctrl.updateTodayLocation);
router.get("/today", ctrl.getTodayAttendance);
router.get("/my", ctrl.getMyAttendance);

router.get("/users-list", authorize("admin", "hr"), ctrl.getAllUsersList);
router.post("/admin-checkin/:userId", authorize("admin", "hr"), ctrl.adminCheckInForUser);
router.post("/admin-checkout/:userId", authorize("admin", "hr"), ctrl.adminCheckOutForUser);

router.post("/admin-checkout/:userId", authorize("admin", "hr"), ctrl.adminCheckOutForUser);
router.patch("/admin-checkout-date/:userId", authorize("admin", "hr"), ctrl.adminCheckOutForUserOnDate);
router.post("/send-reminder/:userId", authorize("admin", "hr"), ctrl.sendManualCheckoutReminder); // ← add this

router.get("/today-all", authorize("admin", "hr", "manager"), ctrl.getTodayAll);
router.get("/all", authorize("admin", "hr", "manager"), ctrl.getAllAttendance);
router.get("/manual/my", ctrl.getMyManualAttendance);   // ← add this line
router.post("/manual", authorize("admin"), ctrl.addManualAttendance);
router.get("/manual", authorize("admin"), ctrl.getManualAttendance);
router.delete("/manual/:id", authorize("admin"), ctrl.deleteManualAttendance);

module.exports = router;
