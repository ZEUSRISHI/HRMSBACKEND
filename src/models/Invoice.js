const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true },
  invoiceNumber: { type: String },
  amount: { type: Number, required: true },
  paidAmount: { type: Number, default: 0 },
  date: { type: String },
  dueDate: { type: String },
  status: { type: String, enum: ["paid", "pending", "overdue"], default: "pending" },
}, { timestamps: true });

module.exports = mongoose.model("Invoice", invoiceSchema);