const cron       = require("node-cron");
const Vendor     = require("../models/Vendor");
const Freelancer = require("../models/Freelancer");
const User       = require("../models/User");
const { sendContractExpiryEmail } = require("../services/contractReminderService");

// Days before expiry on which we send reminders
const TRIGGER_DAYS = [30, 14, 7, 3, 1];

const daysUntil = (date) => {
  const now      = new Date();
  const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const endUTC   = new Date(date).setUTCHours(0, 0, 0, 0);
  return Math.ceil((endUTC - todayUTC) / (1000 * 60 * 60 * 24));
};

const runCheck = async () => {
  console.log("⏰ [ContractExpiryJob] Running daily check…");

  try {
    const admins = await User.find({ role: "admin", isActive: { $ne: false } })
      .select("email name");

    if (!admins.length) {
      console.warn("[ContractExpiryJob] No admin users found — skipping.");
      return;
    }

    // ── Freelancers ───────────────────────────────────────────────────────────
    const freelancers = await Freelancer.find({ status: "active" });

    for (const f of freelancers) {
      if (!f.contractEnd) continue;

      const daysLeft = daysUntil(f.contractEnd);

      // Auto-expire if past end date
      if (daysLeft < 0) {
        await Freelancer.findByIdAndUpdate(f._id, { status: "expired" });
        console.log(`[ContractExpiryJob] Auto-expired freelancer: ${f.name}`);
        continue;
      }

      if (!TRIGGER_DAYS.includes(daysLeft)) continue;

      for (const admin of admins) {
        try {
          await sendContractExpiryEmail({
            toEmail:      admin.email,
            toName:       admin.name,
            contractType: "Freelancer",
            entityName:   f.name,
            expiryDate:   f.contractEnd,
            daysLeft,
          });
          console.log(`✅ [ContractExpiryJob] Freelancer reminder → ${admin.email} | ${f.name} | ${daysLeft}d left`);
        } catch (err) {
          console.error(`❌ [ContractExpiryJob] Email failed for ${admin.email}:`, err.message);
        }
      }
    }

    // ── Vendors ───────────────────────────────────────────────────────────────
    const vendors = await Vendor.find({
      projectEndDate: { $exists: true, $ne: null },
      projectStatus:  { $nin: ["completed", "cancelled", ""] },
    });

    for (const v of vendors) {
      if (!v.projectEndDate) continue;

      const daysLeft = daysUntil(v.projectEndDate);

      if (daysLeft < 0) continue; // Vendor status not auto-changed

      if (!TRIGGER_DAYS.includes(daysLeft)) continue;

      const entityName = v.projectName
        ? `${v.company} — ${v.projectName}`
        : v.company;

      for (const admin of admins) {
        try {
          await sendContractExpiryEmail({
            toEmail:      admin.email,
            toName:       admin.name,
            contractType: "Vendor Project",
            entityName,
            expiryDate:   v.projectEndDate,
            daysLeft,
          });
          console.log(`✅ [ContractExpiryJob] Vendor reminder → ${admin.email} | ${v.company} | ${daysLeft}d left`);
        } catch (err) {
          console.error(`❌ [ContractExpiryJob] Email failed for ${admin.email}:`, err.message);
        }
      }
    }

    console.log("✅ [ContractExpiryJob] Daily check complete.");
  } catch (err) {
    console.error("❌ [ContractExpiryJob] Fatal error:", err.message);
  }
};

const startContractExpiryJob = () => {
  // Every day at 09:00 AM IST
  cron.schedule("0 9 * * *", runCheck, { timezone: "Asia/Kolkata" });
  console.log("✅ [ContractExpiryJob] Scheduled — daily at 09:00 IST");
};

// Export runCheck so you can also trigger manually via an admin API route
module.exports = { startContractExpiryJob, runCheck };