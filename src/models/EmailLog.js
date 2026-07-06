// models/EmailLog.js
const mongoose = require("mongoose");

const emailLogSchema = new mongoose.Schema({
  sentBy:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type:      { type: String, enum: ["direct","team"], default: "direct" },
  to:        [{ type: String }],
  cc:        [{ type: String }],
  roles:     [{ type: String }],
  subject:   { type: String, required: true },
  body:      { type: String, required: true },
  priority:  { type: String, enum: ["normal","medium","high"], default: "normal" },
  status:    { type: String, enum: ["sent","failed"], default: "sent" },
  messageId: { type: String },
  error:     { type: String },
}, { timestamps: true });
emailLogSchema.index({ sentBy: 1, createdAt: -1 });
emailLogSchema.index({ status: 1 });

module.exports = mongoose.model("EmailLog", emailLogSchema);

