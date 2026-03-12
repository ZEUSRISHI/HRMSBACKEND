const mongoose = require("mongoose");

const clientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  company: { type: String },
  email: { type: String, required: true },
  phone: { type: String },
  address: { type: String },
  description: { type: String },
  status: { type: String, enum: ["active", "inactive"], default: "active" },
  totalProjects: { type: Number, default: 0 },
  outstandingBalance: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model("Client", clientSchema);