const mongoose = require("mongoose");

const taskUpdateSchema = new mongoose.Schema(
  {
    status:      { type: String },
    progress:    { type: Number, default: 0 },
    hoursWorked: { type: Number, default: 0 },
    note:        { type: String, default: "" },
    blocker:     { type: String, default: "" },
  },
  { timestamps: true }
);

const taskSchema = new mongoose.Schema(
  {
    title: {
      type:     String,
      required: true,
      trim:     true,
    },
    description: {
      type:    String,
      default: "",
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  "User",
      default: null,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  "User",
    },
    priority: {
      type:    String,
      enum:    ["low", "medium", "high"],
      default: "medium",
    },
    status: {
      type:    String,
      enum:    ["pending", "in-progress", "completed"],
      default: "pending",
    },
    dueDate: {
      type:    String,
      default: "",
    },
    updates: {
      type:    [taskUpdateSchema],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Task", taskSchema);
