const mongoose = require("mongoose");

const vendorSchema = new mongoose.Schema(
  {
    company:          { type: String, required: true, trim: true },
    contactPerson:    { type: String, required: true, trim: true },
    email:            { type: String, required: true, trim: true, lowercase: true },
    countryCode:      { type: String, default: "+91" },
    phone:            { type: Number, required: true },
    category:         { type: String, trim: true },
    taxId:            { type: String, trim: true },
    address:          { type: String, trim: true },
    projectName:      { type: String, trim: true },
    projectStatus:    {
      type:    String,
      enum:    ["", "not_started", "in_progress", "on_hold", "completed", "cancelled"],
      default: "",
    },
    projectStartDate: { type: Date },
    projectEndDate:   { type: Date },
    createdBy:        { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Vendor", vendorSchema);