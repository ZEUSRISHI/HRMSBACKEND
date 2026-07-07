"use strict";

const express = require("express");
const router  = express.Router();
const { body } = require("express-validator");
const {
  getDirectory,
  sendEmail,
  sendToTeam,
  testSmtp,
  getLogs,
} = require("../controllers/emailCommController");
const { protect, authorize } = require("../middleware/auth");
const validate = require("../middleware/validate"); // ✅ returns HTTP 422 on validation failure

router.use(protect);

/* ============================================================
   VALIDATION RULES
   ============================================================ */

// ✅ Reusable priority check — must match the EmailLog schema enum exactly
const PRIORITY_VALUES = ["normal", "medium", "high"];

const sendEmailRules = [
  body("to")
    .exists({ checkFalsy: true }).withMessage("Recipient list (to) is required")
    .bail()
    .isArray({ min: 1 }).withMessage("Recipients (to) must be a non-empty array")
    .bail()
    .custom((arr) => arr.every((v) => typeof v === "string"))
    .withMessage("Each recipient in 'to' must be a string email address"),

  body("to.*")
    .isEmail().withMessage("One or more recipient email addresses are invalid")
    .normalizeEmail(),

  body("cc")
    .optional()
    .isArray().withMessage("CC must be an array")
    .bail(),
  body("cc.*")
    .optional()
    .isEmail().withMessage("One or more CC email addresses are invalid")
    .normalizeEmail(),

  // ✅ subject must be a string before .trim() is ever called
  body("subject")
    .exists({ checkFalsy: true }).withMessage("Subject is required")
    .bail()
    .isString().withMessage("Subject must be a string")
    .bail()
    .trim()
    .isLength({ min: 1, max: 300 }).withMessage("Subject must be between 1 and 300 characters"),

  body("body")
    .exists({ checkFalsy: true }).withMessage("Message body is required")
    .bail()
    .isString().withMessage("Message body must be a string")
    .bail()
    .trim()
    .isLength({ min: 1, max: 20000 }).withMessage("Message body must be between 1 and 20000 characters"),

  // ✅ priority validated against the exact enum, no Mongoose leak
  body("priority")
    .optional()
    .isString().withMessage("Priority must be a string")
    .bail()
    .isIn(PRIORITY_VALUES).withMessage(`Priority must be one of: ${PRIORITY_VALUES.join(", ")}`),
];

const sendTeamRules = [
  body("roles")
    .exists({ checkFalsy: true }).withMessage("Roles are required")
    .bail()
    .isArray({ min: 1 }).withMessage("Roles must be a non-empty array")
    .bail()
    .custom((arr) => arr.every((v) => typeof v === "string"))
    .withMessage("Each role must be a string"),

  body("roles.*")
    .isIn(["admin", "manager", "hr", "employee"])
    .withMessage("Roles must be one of: admin, manager, hr, employee"),

  body("subject")
    .exists({ checkFalsy: true }).withMessage("Subject is required")
    .bail()
    .isString().withMessage("Subject must be a string")
    .bail()
    .trim()
    .isLength({ min: 1, max: 300 }).withMessage("Subject must be between 1 and 300 characters"),

  body("body")
    .exists({ checkFalsy: true }).withMessage("Message body is required")
    .bail()
    .isString().withMessage("Message body must be a string")
    .bail()
    .trim()
    .isLength({ min: 1, max: 20000 }).withMessage("Message body must be between 1 and 20000 characters"),

  body("priority")
    .optional()
    .isString().withMessage("Priority must be a string")
    .bail()
    .isIn(PRIORITY_VALUES).withMessage(`Priority must be one of: ${PRIORITY_VALUES.join(", ")}`),
];

/* ============================================================
   ROUTES
   ============================================================
   Note: `validate` responds with HTTP 422 Unprocessable Entity
   (not 400) whenever any rule above fails — see middleware/validate.js
   ============================================================ */

router.get ("/directory",                                     getDirectory);

// ✅ 422 on validation failure (bad subject type, invalid email, invalid priority, etc.)
router.post("/send",      sendEmailRules, validate,                                   sendEmail);
router.post("/send-team", sendTeamRules,  validate, authorize("admin","manager","hr"), sendToTeam);

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
