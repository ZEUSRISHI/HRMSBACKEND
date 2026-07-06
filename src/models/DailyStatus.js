const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema({
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  comment: { type: String },
  timestamp: { type: Date, default: Date.now },
});

const dailyStatusSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  date: { type: String, required: true },
  status: { type: String, required: true },
  achievements: { type: String, required: true },
  blockers: { type: String },
  nextDayPlan: { type: String },
  managerComments: [commentSchema],
}, { timestamps: true });

dailyStatusSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("DailyStatus", dailyStatusSchema);