const mongoose = require("mongoose");

const freelancerSchema = new mongoose.Schema(
  {
    name:          { type: String, required: true, trim: true },
    email:         { type: String, required: true, trim: true, lowercase: true },
    countryCode:   { type: String, default: "+91" },
    phone:         { type: Number, default: null },
    skill:         { type: String, required: true, trim: true },
    rate:          { type: Number, default: null },
    contractStart: { type: Date },
    contractEnd:   { type: Date },
    status:        { type: String, enum: ["active", "expired"], default: "active" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Freelancer", freelancerSchema);