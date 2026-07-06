// models/Attendance.js
const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  "User",
    },
    date:     { type: String, required: true },
    checkIn:  { type: String },
    checkOut: { type: String },
    status: {
      type:    String,
      enum:    ["present", "absent", "late"],
      default: "present",
    },

    /* ── Tagline — optional motivational note set at check-in ── */
    tagline: {
      type:      String,
      default:   "",
      maxlength: 200,
      trim:      true,
    },

    /* ── Manual entry fields (admin only) ── */
    isManual:           { type: Boolean, default: false },
    manualEmployeeName: { type: String },
    manualEmployeeRole: { type: String },
    enteredBy:          { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    enteredByName:      { type: String },
  },
  { timestamps: true }
);

/*
  Unique index only for REAL (non-manual) records.
  Manual records have no userId so they never clash with this index.
*/
attendanceSchema.index(
  { userId: 1, date: 1 },
  {
    unique: true,
    partialFilterExpression: {
      isManual: false,
      userId:   { $exists: true, $ne: null },
    },
  }
);

module.exports = mongoose.model("Attendance", attendanceSchema);