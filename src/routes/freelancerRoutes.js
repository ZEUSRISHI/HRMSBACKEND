const express               = require("express");
const router                = express.Router();
const freelancerController  = require("../controllers/freelancerController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

// /expiring MUST be before /:id
router.get("/expiring", authorize("admin", "manager", "hr"), freelancerController.getExpiring);
router.post("/",        authorize("admin"),                  freelancerController.createFreelancer);
router.get("/",         authorize("admin", "manager", "hr"), freelancerController.getAllFreelancers);
router.put("/:id",      authorize("admin"),                  freelancerController.updateFreelancer);
router.delete("/:id",   authorize("admin"),                  freelancerController.deleteFreelancer);

module.exports = router;