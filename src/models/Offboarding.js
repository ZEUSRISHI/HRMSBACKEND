const mongoose = require("mongoose");

const offboardingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    initiatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    lastWorkingDay: { type: String, required: true },
    reason: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "in-progress", "completed"],
      default: "in-progress",
    },
    clearanceStatus: {
      hr: { type: Boolean, default: false },
      it: { type: Boolean, default: false },
      finance: { type: Boolean, default: false },
      product: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Offboarding", offboardingSchema);
