const express = require("express");
const router  = express.Router();
const projectController = require("../controllers/projectController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

router.post("/",         authorize("admin"),                    projectController.createProject);
router.get("/all",       authorize("admin", "manager", "hr"),  projectController.getAllProjects);
router.get("/my",                                               projectController.getMyProjects);
router.get("/managers",  authorize("admin"),                    projectController.getManagers);   // ✅
router.get("/members",   authorize("admin"),                    projectController.getMembers);    // ✅
router.put("/:id",       authorize("admin", "manager"),        projectController.updateProject);
router.delete("/:id",    authorize("admin"),                    projectController.deleteProject);

module.exports = router;
