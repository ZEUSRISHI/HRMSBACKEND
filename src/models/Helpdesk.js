const mongoose = require("mongoose");

const helpdeskSchema = new mongoose.Schema(
  {
    ticketNumber: {
      type: String,
      unique: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
    },

    category: {
      type: String,
      enum: ["payroll", "attendance", "leave", "task", "project", "timesheet", "onboarding", "access", "other"],
      required: true,
    },

    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },

    status: {
      type: String,
      enum: ["open", "in_progress", "resolved", "closed"],
      default: "open",
    },

    raisedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    resolvedAt: {
      type: Date,
      default: null,
    },

    resolutionNote: {
      type: String,
      default: "",
    },

    comments: [
      {
        author: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        text: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

/* Auto-generate ticket number before save */
helpdeskSchema.pre("save", async function (next) {
  if (!this.ticketNumber) {
    const count = await mongoose.model("Helpdesk").countDocuments();
    this.ticketNumber = `TKT-${String(count + 1).padStart(4, "0")}`;
  }
  next();
});

module.exports = mongoose.model("Helpdesk", helpdeskSchema);
