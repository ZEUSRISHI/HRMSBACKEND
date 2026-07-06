"use strict";
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/attendanceController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

router.post("/checkin", ctrl.checkIn);
router.post("/checkout", ctrl.checkOut);
router.get("/today", ctrl.getTodayAttendance);
router.get("/my", ctrl.getMyAttendance);

router.get("/users-list", authorize("admin", "hr"), ctrl.getAllUsersList);
router.post("/admin-checkin/:userId", authorize("admin", "hr"), ctrl.adminCheckInForUser);
router.post("/admin-checkout/:userId", authorize("admin", "hr"), ctrl.adminCheckOutForUser);

router.get("/today-all", authorize("admin", "hr", "manager"), ctrl.getTodayAll);
router.get("/all", authorize("admin", "hr", "manager"), ctrl.getAllAttendance);

router.post("/manual", authorize("admin"), ctrl.addManualAttendance);
router.get("/manual", authorize("admin"), ctrl.getManualAttendance);
router.delete("/manual/:id", authorize("admin"), ctrl.deleteManualAttendance);

module.exports = router;
