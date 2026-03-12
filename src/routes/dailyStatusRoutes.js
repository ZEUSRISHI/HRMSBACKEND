const express = require("express");
const router = express.Router();
const dailyStatusController = require("../controllers/dailyStatusController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

router.post("/",              dailyStatusController.submitStatus);
router.get("/my",             dailyStatusController.getMyStatuses);
router.get("/all",            authorize("admin", "hr", "manager"), dailyStatusController.getAllStatuses);
router.post("/:id/comment",   authorize("admin", "hr", "manager"), dailyStatusController.addComment);

module.exports = router;