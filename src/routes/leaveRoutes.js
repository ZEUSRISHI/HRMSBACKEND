const express = require("express");
const router  = express.Router();
const leaveController = require("../controllers/leaveController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

// Any logged-in user can apply
router.post("/apply", leaveController.applyLeave);

// Own leaves
router.get("/my", leaveController.getMyLeaves);

// Role-based pending queue
router.get(
  "/pending",
  authorize("admin", "hr", "manager"),
  leaveController.getPendingLeaves
);

// Full leave list (admin + hr)
router.get(
  "/all",
  authorize("admin", "hr"),
  leaveController.getAllLeaves
);

// Approve / reject
router.put(
  "/:id/approve",
  authorize("admin", "hr", "manager"),
  leaveController.approveLeave
);

router.put(
  "/:id/reject",
  authorize("admin", "hr", "manager"),
  leaveController.rejectLeave
);

module.exports = router;