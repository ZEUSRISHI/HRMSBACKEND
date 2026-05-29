// models/Project.js
const mongoose = require("mongoose");

/* ────────────────────────────────────────────────────────────
   DOCUMENT  (contracts, specs, deliverables — Admin/HR/Manager)
   url field stores base64 data-URL directly in MongoDB
──────────────────────────────────────────────────────────── */
const documentSchema = new mongoose.Schema({
  name:       { type: String, required: true, trim: true },
  url:        { type: String, required: true },   // base64 data-URL stored in MongoDB
  fileType:   { type: String, default: "application/octet-stream" },
  size:       { type: Number, default: 0 },       // bytes (actual decoded size)
  category: {
    type:    String,
    enum:    ["contract", "specification", "design", "report", "invoice", "other"],
    default: "other",
  },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  uploadedAt: { type: Date, default: Date.now },
});

/* ────────────────────────────────────────────────────────────
   DAILY STATUS  (submitted by team members — Employee/HR/Manager)
   Visible: submitter + Admin + Manager of the project
──────────────────────────────────────────────────────────── */
const dailyStatusSchema = new mongoose.Schema({
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  date:        { type: Date, default: Date.now },
  summary:     { type: String, required: true, trim: true },
  hoursWorked: { type: Number, default: 0, min: 0, max: 24 },
  blockers:    { type: String, default: "" },
  nextPlan:    { type: String, default: "" },
  mood: {
    type:    String,
    enum:    ["great", "good", "neutral", "struggling"],
    default: "good",
  },
  managerComment: { type: String, default: "" },
  commentedBy:    { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  commentedAt:    { type: Date, default: null },
});

/* ────────────────────────────────────────────────────────────
   WORK SUBMISSION  (legacy — kept for backwards compatibility)
──────────────────────────────────────────────────────────── */
const workSubmissionSchema = new mongoose.Schema({
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  description: { type: String, required: true, trim: true },
  hoursWorked: { type: Number, default: 0, min: 0 },
  date:        { type: Date, default: Date.now },
});

/* ────────────────────────────────────────────────────────────
   MILESTONE
──────────────────────────────────────────────────────────── */
const milestoneSchema = new mongoose.Schema({
  title:       { type: String, required: true, trim: true },
  dueDate:     { type: String, default: "" },
  completed:   { type: Boolean, default: false },
  completedAt: { type: Date, default: null },
});

/* ────────────────────────────────────────────────────────────
   PROJECT  (root document)
──────────────────────────────────────────────────────────── */
const projectSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    clientName:  { type: String, default: "", trim: true },
    deadline:    { type: String, default: "" },
    priority: {
      type:    String,
      enum:    ["low", "medium", "high", "critical"],
      default: "medium",
    },
    status: {
      type:    String,
      enum:    ["planning", "in-progress", "completed", "on-hold"],
      default: "planning",
    },
    budget:   { type: Number, default: 0, min: 0 },
    spent:    { type: Number, default: 0, min: 0 },
    progress: { type: Number, default: 0, min: 0, max: 100 },

    managerId:   { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    teamMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    milestones:      [milestoneSchema],
    documents:       [documentSchema],
    dailyStatuses:   [dailyStatusSchema],
    workSubmissions: [workSubmissionSchema],

    tags: [{ type: String, trim: true }],
  },
  { timestamps: true }
);

/* indexes */
projectSchema.index({ managerId: 1 });
projectSchema.index({ teamMembers: 1 });
projectSchema.index({ status: 1 });
projectSchema.index({ priority: 1 });
projectSchema.index({ createdAt: -1 });

module.exports = mongoose.models.Project || mongoose.model("Project", projectSchema);
