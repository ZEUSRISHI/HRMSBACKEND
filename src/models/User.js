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

    /* ── Profile fields ── */
    phone: {
      type:    String,
      trim:    true,
      default: "",
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
      default: "",
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
   TO SAFE OBJECT  — strips password & refreshToken
   Called by authController.js → sendTokenResponse()
   ============================================================ */
userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshToken;
  return obj;
};

/* ============================================================
   PREVENT OverwriteModelError on nodemon hot-reload
   ============================================================ */
module.exports = mongoose.models.User || mongoose.model("User", userSchema);
