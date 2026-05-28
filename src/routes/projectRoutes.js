const express = require("express");
const router  = express.Router();
const c       = require("../controllers/projectController");
const { protect, authorize } = require("../middleware/auth");

/* All routes require authentication */
router.use(protect);

/* ── Project CRUD ── */
router.post(   "/",       authorize("admin"),                           c.createProject);
router.post(   "/manual", authorize("admin"),                           c.createManualProject);
router.get(    "/all",    authorize("admin", "manager", "hr"),          c.getAllProjects);
router.get(    "/my",                                                   c.getMyProjects);
router.put(    "/:id",    authorize("admin", "manager"),                c.updateProject);
router.delete( "/:id",    authorize("admin"),                           c.deleteProject);

/* ── User helper routes ── */
/*
  /managers   — returns managers + admins (for the manager dropdown)
  /members    — returns hr + employees (for member picker)
  /all-users  — returns everyone active (full team picker used in forms)
  Order matters: specific paths before /:id to avoid route conflicts.
*/
router.get("/managers",  authorize("admin"),                            c.getManagers);
router.get("/members",   authorize("admin", "manager", "hr"),           c.getMembers);
router.get("/all-users", authorize("admin", "manager", "hr"),           c.getAllUsers);

/* ── Documents ──
   Upload / delete: Admin, Manager, HR only.
   Employees are blocked at the route level (not just the UI).
*/
router.post(
  "/:id/documents",
  authorize("admin", "manager", "hr"),
  c.uploadDocument
);
router.delete(
  "/:id/documents/:docId",
  authorize("admin", "manager", "hr"),
  c.deleteDocument
);

/* ── Work Submissions ──
   Submit: any authenticated user (controller enforces membership check
           for employees; HR submits freely; manager submits on own projects).
   Delete: Admin and Manager only.
*/
router.post(
  "/:id/submissions",
  c.submitWork                                  /* no authorize() — controller checks membership */
);
router.delete(
  "/:id/submissions/:subId",
  authorize("admin", "manager"),
  c.deleteSubmission
);

module.exports = router;
