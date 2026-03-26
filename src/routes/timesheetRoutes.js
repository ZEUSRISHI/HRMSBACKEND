const express = require("express");
const router = express.Router();
const timesheetController = require("../controllers/timesheetController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

router.post("/",           timesheetController.addTimesheet);
router.get("/my",          timesheetController.getMyTimesheets);
router.get("/all",         authorize("admin", "hr", "manager"), timesheetController.getAllTimesheets);
router.put("/:id/approve", authorize("admin", "hr", "manager"), timesheetController.approveTimesheet);
router.put("/:id/reject",  authorize("admin", "hr", "manager"), timesheetController.rejectTimesheet);

module.exports = router;