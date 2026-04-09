const express = require("express");
const router  = express.Router();
const leaveController = require("../controllers/leaveController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

router.post("/apply", leaveController.applyLeave);
router.get("/my",     leaveController.getMyLeaves);

router.get(
  "/pending",
  authorize("hr", "manager", "admin"),
  leaveController.getPendingLeaves,
);

router.get(
  "/all",
  authorize("admin"),
  leaveController.getAllLeaves,
);

router.put("/:id/approve", authorize("hr", "manager", "admin"), leaveController.approveLeave);
router.put("/:id/reject",  authorize("hr", "manager", "admin"), leaveController.rejectLeave);

module.exports = router;
