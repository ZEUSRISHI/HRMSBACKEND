const mongoose = require("mongoose");

const clientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    company: { type: String },
    email: { type: String, required: true },
    phone: {
      type: String,
      validate: {
        validator: function (v) {
          return !v || /^\d{10}$/.test(v);
        },
        message: (props) => `${props.value} is not a valid 10-digit phone number.`,
      },
    },
    address: { type: String },
    gstNumber: { type: String, default: "" },
    description: { type: String },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    totalProjects: { type: Number, default: 0 },
    outstandingBalance: { type: Number, default: 0 },
    documents: [
      {
        name: { type: String, required: true },
        originalName: { type: String },
        size: { type: Number },
        uploadedAt: { type: Date, default: Date.now },
        data: { type: Buffer, required: true },
        mimeType: { type: String, default: "application/pdf" },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Client", clientSchema);