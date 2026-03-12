const express = require("express");
const router = express.Router();
const taskController = require("../controllers/taskController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

router.post("/",           authorize("admin", "manager"), taskController.createTask);
router.get("/all",         authorize("admin", "manager", "hr"), taskController.getAllTasks);
router.get("/my",          taskController.getMyTasks);
router.put("/:id",         taskController.updateTask);
router.delete("/:id",      authorize("admin"), taskController.deleteTask);
router.post("/:id/update", taskController.addTaskUpdate);

module.exports = router;