const express = require("express");
const router = express.Router();
const leaveController = require("../controllers/leaveController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

router.post("/apply",          leaveController.applyLeave);
router.get("/my",              leaveController.getMyLeaves);
router.get("/pending",         authorize("admin", "hr", "manager"), leaveController.getPendingLeaves);
router.get("/all",             authorize("admin", "hr"), leaveController.getAllLeaves);
router.put("/:id/approve",     authorize("admin", "hr", "manager"), leaveController.approveLeave);
router.put("/:id/reject",      authorize("admin", "hr", "manager"), leaveController.rejectLeave);

module.exports = router;