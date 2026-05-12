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

// ── TEMPORARY DEBUG (remove after fixing env vars on Render) ──
router.get("/debug-env", authorize("admin"), (req, res) => {
  const pass = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s/g, "");
  res.json({
    GMAIL_USER:               process.env.GMAIL_USER        || "NOT SET",
    GMAIL_APP_PASSWORD_LENGTH: pass.length,
    GMAIL_APP_PASSWORD_VALID:  pass.length === 16,
    EMAIL_FROM_NAME:          process.env.EMAIL_FROM_NAME   || "NOT SET",
    EMAIL_FROM:               process.env.EMAIL_FROM        || "NOT SET",
    CLIENT_URL:               process.env.CLIENT_URL        || "NOT SET",
    NODE_ENV:                 process.env.NODE_ENV          || "NOT SET",
  });
});

module.exports = router;
