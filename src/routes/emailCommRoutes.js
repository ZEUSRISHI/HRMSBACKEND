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

router.get ("/directory",                                     getDirectory);
router.post("/send",                                          sendEmail);
router.post("/send-team", authorize("admin","manager","hr"),  sendToTeam);
router.get ("/test-smtp",  authorize("admin"),                testSmtp);
router.get ("/logs",                                          getLogs);

router.get("/debug-env", authorize("admin"), (req, res) => {
  res.json({
    EMAIL_USER:      process.env.EMAIL_USER ? `SET ✅ (${process.env.EMAIL_USER})` : "MISSING ❌",
    EMAIL_PASS:      process.env.EMAIL_PASS ? `SET ✅ length=${process.env.EMAIL_PASS.length}` : "MISSING ❌",
    EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME || "not set",
    NODE_ENV:        process.env.NODE_ENV || "not set",
    NODE_VERSION:    process.version,
  });
});

module.exports = router;
