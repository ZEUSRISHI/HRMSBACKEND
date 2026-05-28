const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema({
  name:       { type: String, required: true },
  url:        { type: String, required: true },
  fileType:   { type: String },
  size:       { type: Number },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  uploadedAt: { type: Date, default: Date.now },
});

const workSubmissionSchema = new mongoose.Schema({
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  description: { type: String, required: true },
  hoursWorked: { type: Number, default: 0 },
  date:        { type: Date, default: Date.now },
});

const projectSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    clientName:  { type: String, default: "" },
    deadline:    { type: String, default: "" },
    status: {
      type:    String,
      enum:    ["planning", "in-progress", "completed", "on-hold"],
      default: "planning",
    },
    budget:      { type: Number, default: 0, min: 0 },
    spent:       { type: Number, default: 0, min: 0 },
    progress:    { type: Number, default: 0, min: 0, max: 100 },
    managerId:   { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    teamMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    documents:       [documentSchema],
    workSubmissions: [workSubmissionSchema],
  },
  { timestamps: true }
);

/* ── Indexes for common queries ── */
projectSchema.index({ managerId: 1 });
projectSchema.index({ teamMembers: 1 });
projectSchema.index({ status: 1 });
projectSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Project", projectSchema);
