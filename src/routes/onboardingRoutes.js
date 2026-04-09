const express = require("express");
const router = express.Router();
const {
  createOnboarding,
  getAllOnboarding,
  toggleOnboardingTask,
  deleteOnboarding,
  createOffboarding,
  getAllOffboarding,
  toggleClearance,
  deleteOffboarding,
} = require("../controllers/onboardingController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

/* ─── Onboarding routes ─── */
router.post("/",                       authorize("admin", "hr"), createOnboarding);
router.get("/",                        authorize("admin", "hr"), getAllOnboarding);
router.patch("/:id/tasks/:taskId",     authorize("admin", "hr"), toggleOnboardingTask);
router.delete("/:id",                  authorize("admin"),       deleteOnboarding);

/* ─── Offboarding routes ─── */
router.post("/offboarding",            authorize("admin", "hr"), createOffboarding);
router.get("/offboarding",             authorize("admin", "hr"), getAllOffboarding);
router.patch("/offboarding/:id/clear", authorize("admin", "hr"), toggleClearance);
router.delete("/offboarding/:id",      authorize("admin"),       deleteOffboarding);

module.exports = router;
