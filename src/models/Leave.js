const mongoose = require("mongoose");

const leaveSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, required: true },
  priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
  startDate: { type: String, required: true },
  endDate: { type: String, required: true },
  days: { type: Number },
  reason: { type: String, required: true },
  description: { type: String },
  status: {
    type: String,
    enum: ["pending_manager", "pending_hr", "pending_admin", "approved", "rejected"],
    default: "pending_manager"
  },
  appliedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model("Leave", leaveSchema);