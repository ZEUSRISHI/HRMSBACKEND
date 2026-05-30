const mongoose = require("mongoose");

const payrollSchema = new mongoose.Schema(
  {
    userId:         { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    month:          { type: String, required: true },        // "2025-04"
    periodStart:    { type: Date,   required: true },
    periodEnd:      { type: Date,   required: true },
    role:           { type: String, default: "employee" },
    workingDays:    { type: Number, default: 26 },
    presentDays:    { type: Number, default: 26 },
    leaveDays:      { type: Number, default: 0  },
    paidLeaveDays:  { type: Number, default: 1  },
    basicSalary:    { type: Number, default: 0  },  // full month basic (from user profile)
    earnedBasic:    { type: Number, default: 0  },  // prorated = basicSalary * paidDays / workingDays
    grossSalary:    { type: Number, default: 0  },  // same as earnedBasic (no allowances)
    netSalary:      { type: Number, default: 0  },  // same as grossSalary (no deductions)
    status:         { type: String, enum: ["draft","pending","processed","paid"], default: "draft" },
    paymentDate:    { type: Date   },
    paymentMode:    { type: String, enum: ["bank_transfer","cheque","cash"], default: "bank_transfer" },
    remarks:        { type: String, default: "" },
  },
  { timestamps: true }
);

// Compound index: one payroll record per user per month
payrollSchema.index({ userId: 1, month: 1 }, { unique: true });

module.exports = mongoose.model("Payroll", payrollSchema);
