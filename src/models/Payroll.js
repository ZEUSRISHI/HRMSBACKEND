const mongoose = require("mongoose");

const payrollSchema = new mongoose.Schema(
  {
    userId:        { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    month:         { type: String, required: true },          // "2025-04"
    periodStart:   { type: Date, required: true },            // 2025-04-01
    periodEnd:     { type: Date, required: true },            // 2025-04-30
    role:          { type: String, default: "employee" },     // snapshot of role at time of payroll
    workingDays:   { type: Number, default: 26 },
    presentDays:   { type: Number, default: 26 },
    leaveDays:     { type: Number, default: 0 },
    paidLeaveDays: { type: Number, default: 0 },              // leaves that don't deduct
    basicSalary:   { type: Number, default: 0 },
    allowances: {
      hra:          { type: Number, default: 0 },
      travel:       { type: Number, default: 0 },
      medical:      { type: Number, default: 0 },
      special:      { type: Number, default: 0 },
      other:        { type: Number, default: 0 },
    },
    deductions: {
      pf:           { type: Number, default: 0 },             // 12% of basic
      esi:          { type: Number, default: 0 },             // 0.75% of gross
      tds:          { type: Number, default: 0 },
      leaveDeduction: { type: Number, default: 0 },
      other:        { type: Number, default: 0 },
    },
    grossSalary:   { type: Number, default: 0 },
    totalDeductions:{ type: Number, default: 0 },
    netSalary:     { type: Number, default: 0 },
    status:        { type: String, enum: ["draft", "pending", "processed", "paid"], default: "draft" },
    paymentDate:   { type: Date },
    paymentMode:   { type: String, enum: ["bank_transfer", "cheque", "cash"], default: "bank_transfer" },
    remarks:       { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payroll", payrollSchema);
