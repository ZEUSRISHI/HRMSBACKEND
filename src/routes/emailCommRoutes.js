"use strict";

const express = require("express");
const router  = express.Router();
const {
  getDirectory,
  sendEmail,
  sendToTeam,
  testSmtp,
  getLogs,
} = require("../controllers/emailCommController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

router.get ("/directory",                                    getDirectory);
router.post("/send",                                         sendEmail);
router.post("/send-team", authorize("admin","manager","hr"), sendToTeam);
router.get ("/test-smtp",  authorize("admin"),               testSmtp);
router.get ("/logs",                                         getLogs);

// Diagnostics: verify env vars without sending email
router.get("/debug-env", authorize("admin"), (req, res) => {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  res.json({
    GMAIL_USER:          user  ? `SET ✅ — ${user}`                          : "MISSING ❌",
    GMAIL_APP_PASSWORD:  pass  ? `SET ✅ — length: ${pass.replace(/\s/g,"").length} chars` : "MISSING ❌",
    EMAIL_FROM_NAME:     process.env.EMAIL_FROM_NAME  || "MISSING ❌",
    NODE_ENV:            process.env.NODE_ENV         || "MISSING ❌",
    NODE_VERSION:        process.version,
    NODEMAILER_READY:    user && pass ? "YES ✅" : "NO — set both env vars",
  });
});

module.exports = router;
