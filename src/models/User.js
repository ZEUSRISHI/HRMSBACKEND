const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type:     String,
      required: [true, "Name is required"],
      trim:     true,
    },
    email: {
      type:      String,
      required:  [true, "Email is required"],
      unique:    true,
      lowercase: true,
      trim:      true,
    },
    password: {
      type:      String,
      required:  [true, "Password is required"],
      minlength: 6,
      select:    false,
    },
    role: {
      type:    String,
      enum:    ["admin", "manager", "hr", "employee"],
      default: "employee",
    },

    /* ── Profile fields ──
       Stored as String but strictly validated to contain digits only.
       This avoids Number-type issues: leading zeros being stripped,
       floating point precision loss on large numbers, and type
       mismatches when the frontend sends a string. */
    phone: {
      type:    String,
      trim:    true,
      default: "",
      validate: {
        validator: function (v) {
          if (!v) return true; // optional field
          return /^[0-9]{4,15}$/.test(v);
        },
        message: "Phone number must contain only digits (4-15 characters).",
      },
    },
    countryCode: {
      type:    String,
      default: "+91",
    },
    dob: {
      type:    String,
      default: "",
    },
    department: {
      type:    String,
      trim:    true,
      default: "",
    },
    designation: {
      type:    String,
      trim:    true,
      default: "",
    },
    address: {
      type:    String,
      trim:    true,
      default: "",
    },
    joiningDate: {
      type:    String,
      default: "",
    },
    gender: {
      type:    String,
      enum:    ["male", "female", "other", ""],
      default: "",
    },
    emergencyContact: {
      type:    String,
      trim:    true,
      default: "",
      validate: {
        validator: function (v) {
          if (!v) return true; // optional field
          return /^[0-9]{4,15}$/.test(v);
        },
        message: "Emergency contact must contain only digits (4-15 characters).",
      },
    },
    emergencyCountryCode: {
      type:    String,
      default: "+91",
    },
    avatar: {
      type:    String,
      default: "",
    },

    /* ── Status ── */
    isActive: {
      type:    Boolean,
      default: true,
    },

    /* ── Auth tokens ── */
    refreshToken: {
      type:   String,
      select: false,
    },

    /* ============================================================
       ✅ ACCOUNT LOCKOUT — brute-force / dictionary attack protection
       Tracks consecutive failed login attempts and temporarily locks
       the account once a threshold is hit. Used by authController.login.
       ============================================================ */
    failedLoginAttempts: {
      type:    Number,
      default: 0,
      select:  false,
    },
    lockUntil: {
      type:    Date,
      default: null,
      select:  false,
    },
  },
  { timestamps: true }
);

/* ============================================================
   HASH PASSWORD BEFORE SAVE
   ============================================================ */
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

/* ============================================================
   COMPARE PASSWORD
   ============================================================ */
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

/* ============================================================
   ✅ IS LOCKED — convenience helper for controllers
   ============================================================ */
userSchema.methods.isLocked = function () {
  return !!(this.lockUntil && this.lockUntil > new Date());
};

/* ============================================================
   TO SAFE OBJECT  — strips password, refreshToken & lockout internals
   ============================================================ */
userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshToken;
  delete obj.failedLoginAttempts;
  delete obj.lockUntil;
  return obj;
};

/* ============================================================
   PREVENT OverwriteModelError on nodemon hot-reload
   ============================================================ */
module.exports = mongoose.models.User || mongoose.model("User", userSchema);
