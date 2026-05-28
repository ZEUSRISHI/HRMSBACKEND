// routes/projectRoutes.js
const express = require("express");
const router  = express.Router();
const c       = require("../controllers/projectController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

/* ── CRITICAL: static helper paths BEFORE /:id ─────────────
   If these come after /:id, Express treats "managers",
   "all-users", "members" as MongoDB ObjectIds → 500 errors  */
router.get("/managers",   authorize("admin", "manager", "hr"), c.getManagers);
router.get("/members",    authorize("admin", "manager", "hr"), c.getMembers);
router.get("/all-users",  authorize("admin", "manager", "hr"), c.getAllUsers);

/* ── Project CRUD ─────────────────────────────────────────── */
router.post(   "/",       authorize("admin"),                   c.createProject);
router.post(   "/manual", authorize("admin"),                   c.createManualProject);
router.get(    "/all",    authorize("admin","manager","hr"),    c.getAllProjects);
router.get(    "/my",                                           c.getMyProjects);
router.get(    "/:id",    authorize("admin","manager","hr"),    c.getProjectById);
router.put(    "/:id",    authorize("admin","manager"),         c.updateProject);
router.delete( "/:id",    authorize("admin"),                   c.deleteProject);

/* ── Documents (Admin / Manager / HR only) ────────────────── */
router.post(   "/:id/documents",           authorize("admin","manager","hr"), c.uploadDocument);
router.delete( "/:id/documents/:docId",    authorize("admin","manager","hr"), c.deleteDocument);

/* ── Daily Status ─────────────────────────────────────────── */
// Submit: Manager / HR / Employee (controller checks membership)
router.post("/:id/daily-status",                      c.submitDailyStatus);
// Comment: Admin / Manager only
router.patch(
  "/:id/daily-status/:statusId/comment",
  authorize("admin","manager"),
  c.commentDailyStatus
);
// Delete: Admin / Manager / own entry (controller checks)
router.delete("/:id/daily-status/:statusId",          c.deleteDailyStatus);

/* ── Work Submissions (legacy) ────────────────────────────── */
router.post(   "/:id/submissions",          c.submitWork);
router.delete( "/:id/submissions/:subId",  authorize("admin","manager"), c.deleteSubmission);

module.exports = router;
