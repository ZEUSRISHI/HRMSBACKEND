const mongoose = require("mongoose");

const vendorSchema = new mongoose.Schema({
  company: { type: String, required: true },
  contactPerson: { type: String },
  email: { type: String, required: true },
  phone: { type: String },
  category: { type: String },
  taxId: { type: String },
  address: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

module.exports = mongoose.model("Vendor", vendorSchema);