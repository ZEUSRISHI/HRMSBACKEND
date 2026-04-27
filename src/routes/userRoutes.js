// routes/userRoutes.js
const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/userController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);
router.use(authorize("admin"));

router.get("/stats",                  ctrl.getUserStats);
router.get("/",                       ctrl.getAllUsers);
router.get("/:id",                    ctrl.getUserById);
router.post("/",                      ctrl.createUser);
router.put("/:id",                    ctrl.updateUser);
router.delete("/:id",                 ctrl.deleteUser);
router.patch("/:id/toggle-status",    ctrl.toggleUserStatus);
router.patch("/:id/reset-password",   ctrl.adminResetPassword);

module.exports = router;
