// routes/emailCommRoutes.js
const express = require("express");
const router  = express.Router();
const {
  getDirectory, sendEmail, sendToTeam, testSmtp, getLogs,
} = require("../controllers/emailCommController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

router.get("/directory",                                     getDirectory);
router.post("/send",                                         sendEmail);
router.post("/send-team", authorize("admin","manager","hr"), sendToTeam);
router.get("/test-smtp",  authorize("admin"),                testSmtp);
router.get("/logs",                                          getLogs);

module.exports = router;
