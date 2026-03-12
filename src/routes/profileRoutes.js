const express = require("express");
const { body } = require("express-validator");
const router = express.Router();
const profileController = require("../controllers/profileController");
const { protect } = require("../middleware/auth");
const validate = require("../middleware/validate");

router.use(protect);

const updateProfileRules = [
  body("name").optional().trim()
    .isLength({ min: 2, max: 100 }).withMessage("Name must be 2-100 characters"),
  body("phone").optional().trim(),
  body("department").optional().trim()
    .isLength({ max: 100 }).withMessage("Department name too long"),
  body("avatar").optional().trim(),
];

router.get("/",    profileController.getProfile);
router.put("/",    updateProfileRules, validate, profileController.updateProfile);
router.delete("/", profileController.deleteAccount);

module.exports = router;