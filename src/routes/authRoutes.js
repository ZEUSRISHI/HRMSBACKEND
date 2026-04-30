const express = require("express");
const { body } = require("express-validator");
const router = express.Router();
const authController = require("../controllers/authController");
const { protect } = require("../middleware/auth");
const validate = require("../middleware/validate");

/* ============================================================
   VALIDATION RULES
   ============================================================ */
const signupRules = [
  body("name").trim().notEmpty().withMessage("Name is required")
    .isLength({ min: 2, max: 100 }).withMessage("Name must be 2-100 characters"),
  body("email").trim().notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Must be a valid email").normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required")
    .isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  body("role").optional()
    .isIn(["admin", "hr", "manager", "employee"]).withMessage("Invalid role"),
];

const loginRules = [
  body("email").trim().notEmpty().withMessage("Email is required").isEmail(),
  body("password").notEmpty().withMessage("Password is required"),
  body("role").notEmpty().withMessage("Role is required")
    .isIn(["admin", "hr", "manager", "employee"]).withMessage("Invalid role"),
];

const resetPasswordRules = [
  body("email").trim().notEmpty().isEmail().withMessage("Valid email required"),
  body("newPassword").notEmpty()
    .isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
];

const changePasswordRules = [
  body("oldPassword").notEmpty().withMessage("Current password required"),
  body("newPassword").notEmpty()
    .isLength({ min: 6 }).withMessage("New password must be at least 6 characters"),
];

const googleLoginRules = [
  body("email").trim().notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Must be a valid email").normalizeEmail(),
];

/* ============================================================
   ROUTES
   ============================================================ */
router.post("/signup",        signupRules,        validate, authController.signup);
router.post("/login",         loginRules,         validate, authController.login);
router.post("/google-login",  googleLoginRules,   validate, authController.googleLogin);
router.post("/logout",        protect,                      authController.logout);
router.post("/refresh-token",                               authController.refreshToken);
router.post("/reset-password", resetPasswordRules, validate, authController.resetPassword);
router.put("/change-password", protect, changePasswordRules, validate, authController.changePassword);
router.get("/me",              protect,                      authController.getMe);

module.exports = router;
