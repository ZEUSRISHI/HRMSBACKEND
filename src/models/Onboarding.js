const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema({
  task: { type: String, required: true },
  completed: { type: Boolean, default: false },
  completedAt: { type: Date },
});

const onboardingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: { type: String, required: true },
    startDate: { type: String, required: true },
    status: {
      type: String,
      enum: ["in-progress", "completed"],
      default: "in-progress",
    },
    tasks: [taskSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Onboarding", onboardingSchema);
