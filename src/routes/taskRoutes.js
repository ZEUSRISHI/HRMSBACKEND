const express        = require("express");
const router         = express.Router();
const taskController = require("../controllers/taskController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

// Specific named routes first (before /:id wildcards)
router.get("/assignable",   authorize("admin", "manager", "hr"), taskController.getAssignableUsers);
router.get("/report",       taskController.getTaskReport);
router.get("/all",          authorize("admin"), taskController.getAllTasks);
router.get("/my",           taskController.getMyTasks);

router.post("/manual",      authorize("admin"), taskController.createManualTask);
router.post("/manual/bulk", authorize("admin"), taskController.bulkManualTasks);
router.post("/",            authorize("admin", "manager", "hr"), taskController.createTask);

// Wildcard /:id routes last
router.put("/:id",          taskController.updateTask);
router.delete("/:id",       authorize("admin"), taskController.deleteTask);
router.post("/:id/update",  taskController.addTaskUpdate);

module.exports = router;
