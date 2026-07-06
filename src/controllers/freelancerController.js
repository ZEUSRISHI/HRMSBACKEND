const Freelancer = require("../models/Freelancer");

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

/* ─── Phone validation helper (optional for freelancers) ─── */
function validatePhone(countryCode, phone) {
  if (phone === undefined || phone === null || phone === "") {
    return { valid: true };
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

/* ─── Rate validation helper ─── */
function validateRate(rate) {
  if (rate === undefined || rate === null || rate === "") {
    return { valid: true, rateNumber: null };
  }
  const num = Number(rate);
  if (isNaN(num) || num < 0) {
    return { valid: false, message: "Rate must be a valid positive number." };
  }
  return { valid: true, rateNumber: num };
}

/* ── helper ─────────────────────────────────────────────────── */
const calcDaysLeft = (contractEnd) => {
  if (!contractEnd) return undefined;
  const now  = new Date();
  const end  = new Date(contractEnd);
  return Math.ceil((end - now) / (1000 * 60 * 60 * 24));
};

/* ── GET /api/freelancers ───────────────────────────────────── */
const getAllFreelancers = async (req, res) => {
  try {
    const freelancers = await Freelancer.find().sort({ createdAt: -1 });

    const withDays = freelancers.map((f) => {
      const obj    = f.toObject();
      obj.daysLeft = calcDaysLeft(f.contractEnd);

      // auto-flag expired contracts
      if (obj.daysLeft !== undefined && obj.daysLeft < 0 && obj.status === "active") {
        obj.status = "expired";
      }

      return obj;
    });

    res.status(200).json({ success: true, freelancers: withDays });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── GET /api/freelancers/expiring ─────────────────────────── */
const getExpiring = async (req, res) => {
  try {
    const now  = new Date();
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const freelancers = await Freelancer.find({
      contractEnd: { $gte: now, $lte: in30 },
      status:      "active",
    }).sort({ contractEnd: 1 });

    const withDays = freelancers.map((f) => {
      const obj    = f.toObject();
      obj.daysLeft = calcDaysLeft(f.contractEnd);
      return obj;
    });

    res.status(200).json({ success: true, freelancers: withDays });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── POST /api/freelancers ──────────────────────────────────── */
const createFreelancer = async (req, res) => {
  try {
    const { countryCode, phone, rate } = req.body;
    const cc = countryCode || "+91";

    const phoneCheck = validatePhone(cc, phone);
    if (!phoneCheck.valid) {
      return res.status(400).json({ success: false, message: phoneCheck.message });
    }

    const rateCheck = validateRate(rate);
    if (!rateCheck.valid) {
      return res.status(400).json({ success: false, message: rateCheck.message });
    }

    const freelancer = await Freelancer.create({
      ...req.body,
      countryCode: cc,
      phone: phoneCheck.phoneNumber ?? null,
      rate: rateCheck.rateNumber,
      createdBy: req.user._id,
    });
    res.status(201).json({ success: true, freelancer });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── PUT /api/freelancers/:id ───────────────────────────────── */
const updateFreelancer = async (req, res) => {
  try {
    const updates = { ...req.body };

    if (updates.phone !== undefined) {
      const cc = updates.countryCode || "+91";
      const phoneCheck = validatePhone(cc, updates.phone);
      if (!phoneCheck.valid) {
        return res.status(400).json({ success: false, message: phoneCheck.message });
      }
      updates.countryCode = cc;
      updates.phone = phoneCheck.phoneNumber ?? null;
    }

    if (updates.rate !== undefined) {
      const rateCheck = validateRate(updates.rate);
      if (!rateCheck.valid) {
        return res.status(400).json({ success: false, message: rateCheck.message });
      }
      updates.rate = rateCheck.rateNumber;
    }

    const freelancer = await Freelancer.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );
    if (!freelancer)
      return res.status(404).json({ success: false, message: "Freelancer not found." });

    const obj    = freelancer.toObject();
    obj.daysLeft = calcDaysLeft(freelancer.contractEnd);

    res.status(200).json({ success: true, freelancer: obj });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── DELETE /api/freelancers/:id ────────────────────────────── */
const deleteFreelancer = async (req, res) => {
  try {
    const freelancer = await Freelancer.findByIdAndDelete(req.params.id);
    if (!freelancer)
      return res.status(404).json({ success: false, message: "Freelancer not found." });

    res.status(200).json({ success: true, message: "Freelancer deleted." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getAllFreelancers,
  getExpiring,
  createFreelancer,
  updateFreelancer,
  deleteFreelancer,
};