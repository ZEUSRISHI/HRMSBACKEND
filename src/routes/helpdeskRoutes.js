const express = require("express");
const router  = express.Router();
const hd      = require("../controllers/helpdeskController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

/* Stats */
router.get("/stats", authorize("admin"), hd.getStats);

/* All tickets — admin only */
router.get("/all", authorize("admin"), hd.getAllTickets);

/* My tickets */
router.get("/my", hd.getMyTickets);

/* Create ticket — employee / manager / hr / admin */
router.post("/", hd.createTicket);

/* Single ticket */
router.get("/:id", hd.getTicketById);

/* Admin updates status / assign */
router.put("/:id", authorize("admin"), hd.updateTicket);

/* Raiser edits their own open ticket */
router.patch("/:id/edit", hd.editMyTicket);

/* Delete ticket */
router.delete("/:id", hd.deleteTicket);

/* Comments */
router.post("/:id/comments",                    hd.addComment);
router.delete("/:id/comments/:commentId",       hd.deleteComment);

module.exports = router;
