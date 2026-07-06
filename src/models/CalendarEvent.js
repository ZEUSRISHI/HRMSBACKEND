const mongoose = require("mongoose");

const calendarEventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  type: { type: String },
  date: { type: String, required: true },
  startTime: { type: String },
  endTime: { type: String },
  location: { type: String },
  assignedTo: {
    type: String,
    enum: ["all", "admin", "manager", "employee", "hr"],
    default: "all"
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

module.exports = mongoose.model("CalendarEvent", calendarEventSchema);