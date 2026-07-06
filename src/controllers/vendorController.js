const Vendor = require("../models/Vendor");
const User   = require("../models/User");
const { sendContractExpiryEmail } = require("../services/contractReminderService");

/* ─── Country code → expected phone digit length ─── */
const COUNTRY_PHONE_LENGTHS = {
  "+91": 10,  // India
  "+1": 10,   // US / Canada
  "+44": 10,  // UK
  "+61": 9,   // Australia
  "+971": 9,  // UAE
  "+65": 8,   // Singapore
  "+49": 10,  // Germany
  "+33": 9,   // France
  "+81": 10,  // Japan
  "+86": 11,  // China
  "+55": 11,  // Brazil
  "+27": 9,   // South Africa
  "+64": 9,   // New Zealand
  "+966": 9,  // Saudi Arabia
};

/* ─── Phone validation helper (required for vendors) ─── */
function validatePhone(countryCode, phone) {
  if (phone === undefined || phone === null || phone === "") {
    return { valid: false, message: "Phone number is required." };
  }
  const phoneStr = String(phone).replace(/\D/g, "");
  if (!/^\d+$/.test(phoneStr)) {
    return { valid: false, message: "Phone number must contain digits only." };
  }
  const expectedLength = COUNTRY_PHONE_LENGTHS[countryCode];
  if (!expectedLength) {
    return { valid: false, message: `Unsupported country code: ${countryCode}` };
  }
  if (phoneStr.length !== expectedLength) {
    return {
      valid: false,
      message: `Phone number must be exactly ${expectedLength} digits for ${countryCode}.`,
    };
  }
  return { valid: true, phoneNumber: Number(phoneStr) };
}

/* ── helper ─────────────────────────────────────────────────── */
const daysUntil = (dateStr) => {
  const now      = new Date();
  const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const endDate  = new Date(dateStr);
  endDate.setUTCHours(0, 0, 0, 0);
  return Math.ceil((endDate.getTime() - todayUTC) / (1000 * 60 * 60 * 24));
};

const annotate = (v) => {
  const obj = v.toObject ? v.toObject() : { ...v };
  if (obj.projectEndDate) obj.daysLeft = daysUntil(obj.projectEndDate);
  return obj;
};

/* ── POST /api/vendors ──────────────────────────────────────── */
const createVendor = async (req, res) => {
  try {
    const { countryCode, phone } = req.body;
    const cc = countryCode || "+91";

    const phoneCheck = validatePhone(cc, phone);
    if (!phoneCheck.valid) {
      return res.status(400).json({ success: false, message: phoneCheck.message });
    }

    const vendor = await Vendor.create({
      ...req.body,
      countryCode: cc,
      phone: phoneCheck.phoneNumber,
      createdBy: req.user._id,
    });

    if (vendor.projectEndDate) {
      const days = daysUntil(vendor.projectEndDate);
      if (days > 0 && days <= 30) {
        const admins = await User.find({ role: "admin", isActive: { $ne: false } })
          .select("email name");
        for (const admin of admins) {
          const entityName = vendor.projectName
            ? `${vendor.company} — ${vendor.projectName}`
            : vendor.company;
          sendContractExpiryEmail({
            toEmail:      admin.email,
            toName:       admin.name,
            contractType: "Vendor Project",
            entityName,
            expiryDate:   vendor.projectEndDate,
            daysLeft:     days,
          }).catch(console.error);
        }
      }
    }

    res.status(201).json({ success: true, vendor: annotate(vendor) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── GET /api/vendors ───────────────────────────────────────── */
const getAllVendors = async (req, res) => {
  try {
    const vendors = await Vendor.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, vendors: vendors.map(annotate) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── GET /api/vendors/expiring ──────────────────────────────── */
const getExpiring = async (req, res) => {
  try {
    const now     = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const in30Str  = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 10);

    const vendors = await Vendor.find({
      projectEndDate: { $gte: todayStr, $lte: in30Str },
      projectStatus:  { $nin: ["completed", "cancelled", ""] },
    }).sort({ projectEndDate: 1 });

    res.status(200).json({ success: true, vendors: vendors.map(annotate) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── PUT /api/vendors/:id ───────────────────────────────────── */
const updateVendor = async (req, res) => {
  try {
    const updates = { ...req.body };

    if (updates.phone !== undefined) {
      const cc = updates.countryCode || "+91";
      const phoneCheck = validatePhone(cc, updates.phone);
      if (!phoneCheck.valid) {
        return res.status(400).json({ success: false, message: phoneCheck.message });
      }
      updates.countryCode = cc;
      updates.phone = phoneCheck.phoneNumber;
    }

    const vendor = await Vendor.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );
    if (!vendor)
      return res.status(404).json({ success: false, message: "Vendor not found." });

    res.status(200).json({ success: true, vendor: annotate(vendor) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── DELETE /api/vendors/:id ────────────────────────────────── */
const deleteVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findByIdAndDelete(req.params.id);
    if (!vendor)
      return res.status(404).json({ success: false, message: "Vendor not found." });

    res.status(200).json({ success: true, message: "Vendor deleted." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  createVendor,
  getAllVendors,
  getExpiring,
  updateVendor,
  deleteVendor,
};