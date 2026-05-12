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

// ── DEBUG (remove after confirming hosted env vars are correct) ──
router.get("/debug-env", authorize("admin"), (req, res) => {
  res.json({
    GMAIL_USER:          process.env.GMAIL_USER          || "MISSING ❌",
    GMAIL_CLIENT_ID:     process.env.GMAIL_CLIENT_ID     ? "SET ✅" : "MISSING ❌",
    GMAIL_CLIENT_SECRET: process.env.GMAIL_CLIENT_SECRET ? "SET ✅" : "MISSING ❌",
    GMAIL_REFRESH_TOKEN: process.env.GMAIL_REFRESH_TOKEN ? "SET ✅" : "MISSING ❌",
    GMAIL_APP_PASSWORD:  process.env.GMAIL_APP_PASSWORD  ? "SET ✅" : "MISSING ❌",
    EMAIL_FROM_NAME:     process.env.EMAIL_FROM_NAME     || "MISSING ❌",
    NODE_ENV:            process.env.NODE_ENV            || "MISSING ❌",
  });
});

module.exports = router;
