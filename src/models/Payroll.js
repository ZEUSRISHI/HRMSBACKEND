const mongoose = require("mongoose");

const payrollSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  month: { type: String, required: true },
  basicSalary: { type: Number, default: 0 },
  allowances: { type: Number, default: 0 },
  deductions: { type: Number, default: 0 },
  netSalary: { type: Number, default: 0 },
  status: { type: String, enum: ["pending", "processed"], default: "pending" },
  paymentDate: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model("Payroll", payrollSchema);