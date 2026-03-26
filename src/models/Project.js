const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  clientName: { type: String },
  deadline: { type: String },
  status: {
    type: String,
    enum: ["planning", "in-progress", "completed", "on-hold"],
    default: "planning"
  },
  budget: { type: Number, default: 0 },
  spent: { type: Number, default: 0 },
  progress: { type: Number, default: 0 },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  teamMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
}, { timestamps: true });

module.exports = mongoose.model("Project", projectSchema);