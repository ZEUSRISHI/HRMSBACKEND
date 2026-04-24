// models/Leave.js
const mongoose = require("mongoose");

const leaveSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // false so manual entries (no User doc) are allowed
    },

    // ── Manual-entry fields ──
    employeeName: {
      type: String,
      default: "",
    },
    source: {
      type: String,
      enum: ["api", "manual"],
      default: "api",
    },
    enteredBy: {
      type: String,
      default: "",
    },
    enteredAt: {
      type: Date,
      default: null,
    },

    // ── Standard leave fields ──
    type: {
      type: String,
      required: true,
    },

    isEmergency: {
      type: Boolean,
      default: false,
    },

    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },

    startDate: {
      type: String,
      required: true,
    },

    endDate: {
      type: String,
      required: true,
    },

    days: {
      type: Number,
      default: 1,
    },

    reason: {
      type: String,
      required: true,
    },

    description: {
      type: String,
      default: "",
    },

    emergencyContact: {
      type: String,
      default: "",
    },

    /*
      Status Flow:
      ─────────────────────────────────────────────────────
      EMPLOYEE applies:
        → pending_hr → pending_manager → pending_admin → approved / rejected

      MANAGER / HR applies:
        → pending_admin → approved / rejected

      EMERGENCY leave (employee):
        → pending_manager → emergency_approved / rejected

      MANUAL entry (admin):
        → status set directly (approved / rejected / pending_admin)
      ─────────────────────────────────────────────────────
    */
    status: {
      type: String,
      enum: [
        "pending_hr",
        "pending_manager",
        "pending_admin",
        "approved",
        "rejected",
        "emergency_approved",
      ],
      default: "pending_hr",
    },

    appliedAt: {
      type: Date,
      default: Date.now,
    },

    // Track who approved at each stage
    approvedByManager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    approvedByHR: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    approvedByAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    rejectedAt: {
      type: Date,
      default: null,
    },

    rejectionReason: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Leave", leaveSchema);
