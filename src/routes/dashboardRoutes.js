const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboardController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

router.get("/stats",        dashboardController.getDashboardStats);
router.get("/users",        authorize("admin", "hr"), dashboardController.getAllUsers);
router.put("/users/:id",    authorize("admin"), dashboardController.adminUpdateUser);
router.delete("/users/:id", authorize("admin"), dashboardController.adminDeleteUser);

module.exports = router;