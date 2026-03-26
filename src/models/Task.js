const mongoose = require("mongoose");

const taskUpdateSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  status: { type: String, enum: ["pending", "in-progress", "completed"] },
  progress: { type: Number, default: 0 },
  hoursWorked: { type: Number, default: 0 },
  note: { type: String },
  blocker: { type: String },
});

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
  dueDate: { type: String },
  status: { type: String, enum: ["pending", "in-progress", "completed"], default: "pending" },
  updates: [taskUpdateSchema],
}, { timestamps: true });

module.exports = mongoose.model("Task", taskSchema);