// middleware/validate.js
const { validationResult } = require("express-validator");

const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorList = errors.array().map((e) => ({
      field:   e.path,
      message: e.msg,
    }));

    return res.status(422).json({
      success: false,
      // ✅ top-level message now shows the first specific validation error
      // (e.g. "Subject must be a string") instead of a generic one —
      // matches what the Postman/security test cases expect to see.
      message: errorList[0]?.message || "Validation failed",
      errors:  errorList,
    });
  }

  next();
};

module.exports = validate;
