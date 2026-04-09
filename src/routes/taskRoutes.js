const express = require("express");
const router = express.Router();
const taskController = require("../controllers/taskController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

router.get("/assignable",  authorize("admin", "manager", "hr"), taskController.getAssignableUsers);
router.post("/",           authorize("admin", "manager", "hr"), taskController.createTask);
router.get("/all",         authorize("admin"), taskController.getAllTasks);
router.get("/my",          taskController.getMyTasks);
router.put("/:id",         taskController.updateTask);
router.delete("/:id",      authorize("admin"), taskController.deleteTask);
router.post("/:id/update", taskController.addTaskUpdate);

module.exports = router;
