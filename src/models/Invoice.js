const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Client",
    required: true,
    index: true,
  },

  invoiceNumber: {
    type: String,
    unique: true,
    sparse: true,
    required: true,
  },

  // Items in invoice
  items: [
    {
      description: {
        type: String,
        required: true,
      },
      quantity: {
        type: Number,
        default: 1,
        min: 1,
      },
      unitPrice: {
        type: Number,
        default: 0,
      },
      total: {
        type: Number,
        required: true,
      },
      _id: false,
    },
  ],

  // Amount calculations
  subtotal: {
    type: Number,
    default: 0,
    required: true,
  },

  tax: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },

  taxAmount: {
    type: Number,
    default: 0,
    required: true,
  },

  discount: {
    type: Number,
    default: 0,
    min: 0,
  },

  amount: {
    type: Number,
    required: true,
    index: true,
  },

  // NEW FIELD: Tax calculation mode
  // false = amount excludes tax (add tax to get total)
  // true = amount includes tax (already contains tax)
  includeTax: {
    type: Boolean,
    default: false,
  },

  // Payment & Status
  paymentMode: {
    type: String,
    default: "",
    enum: ["", "Bank Transfer", "Check", "Cash", "Credit Card", "Online"],
  },

  status: {
    type: String,
    enum: ["draft", "sent", "pending", "paid", "overdue", "cancelled"],
    default: "pending",
  },

  // Notes & metadata
  notes: {
    type: String,
    default: "",
  },

  date: {
    type: Date,
    default: Date.now,
    index: true,
  },

  dueDate: {
    type: Date,
    default: null,
  },

  // Email tracking
  emailSent: {
    type: Boolean,
    default: false,
  },

  emailSentAt: {
    type: Date,
    default: null,
  },

  // Audit fields
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },

  updatedAt: {
    type: Date,
    default: Date.now,
  },

  // Soft delete
  deletedAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
  collection: "invoices",
});

// Index for common queries
invoiceSchema.index({ clientId: 1, createdAt: -1 });
invoiceSchema.index({ invoiceNumber: 1 });
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ date: 1 });

// Virtual for human-readable amount
invoiceSchema.virtual("formattedAmount").get(function() {
  return "Rs." + (this.amount || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
});

// Virtual for days overdue
invoiceSchema.virtual("daysOverdue").get(function() {
  if (!this.dueDate || this.status === "paid") return 0;
  const today = new Date();
  const due = new Date(this.dueDate);
  const diff = today - due;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  return days > 0 ? days : 0;
});

// Pre-save hook to update updatedAt
invoiceSchema.pre("save", function(next) {
  this.updatedAt = new Date();
  next();
});

// Method to calculate net payable
invoiceSchema.methods.calculateNetPayable = function() {
  return parseFloat((this.amount || 0).toFixed(2));
};

// Method to format for display
invoiceSchema.methods.toJSON = function() {
  const obj = this.toObject();
  obj.formattedAmount = this.formattedAmount;
  obj.daysOverdue = this.daysOverdue;
  return obj;
};

// Static method to create invoice with tax calculation
invoiceSchema.statics.createWithTaxCalculation = async function(invoiceData) {
  const {
    clientId,
    invoiceNumber,
    items = [],
    tax = 0,
    includeTax = false,
    date,
    dueDate,
    notes,
  } = invoiceData;

  // Calculate amounts based on tax option
  let subtotal = items.reduce((s, i) => s + Number(i.total || 0), 0);
  let taxAmount = 0;
  let amount = subtotal;

  if (tax > 0) {
    if (includeTax) {
      // Amount entered includes tax
      amount = subtotal;
      taxAmount = parseFloat(((tax / (100 + tax)) * subtotal).toFixed(2));
      subtotal = parseFloat((amount - taxAmount).toFixed(2));
    } else {
      // Amount entered without tax
      subtotal = amount;
      taxAmount = parseFloat(((tax / 100) * subtotal).toFixed(2));
      amount = parseFloat((subtotal + taxAmount).toFixed(2));
    }
  }

  return this.create({
    clientId,
    invoiceNumber: invoiceNumber || `INV-${Date.now().toString().slice(-8)}`,
    items: items.map(i => ({
      description: i.description,
      quantity: Number(i.quantity) || 1,
      unitPrice: Number(i.unitPrice) || 0,
      total: Number(i.total) || 0,
    })),
    subtotal: parseFloat(subtotal.toFixed(2)),
    tax: Number(tax),
    taxAmount,
    discount: 0,
    amount: parseFloat(amount.toFixed(2)),
    includeTax,
    date: date ? new Date(date) : new Date(),
    dueDate: dueDate ? new Date(dueDate) : null,
    paymentMode: "",
    notes: notes || "",
  });
};

const Invoice = mongoose.model("Invoice", invoiceSchema);

module.exports = Invoice;