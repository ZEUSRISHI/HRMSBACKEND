const mongoose = require("mongoose");

const freelancerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String },
  skill: { type: String, required: true },
  rate: { type: String },
  contractStart: { type: String },
  contractEnd: { type: String },
  status: { type: String, enum: ["active", "expired"], default: "active" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

module.exports = mongoose.model("Freelancer", freelancerSchema);