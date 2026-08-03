"use strict";

const cron = require("node-cron");
const Attendance = require("../models/Attendance");
const { sendCheckoutReminderEmail } = require("../services/emailService");

const todayStr = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

// Parses "09:15 AM" style time string into hours elapsed since then, today, IST
const hoursSinceCheckIn = (checkInStr) => {
  if (!checkInStr) return 0;
  const match = checkInStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return 0;

  let [, hh, mm, ampm] = match;
  hh = parseInt(hh, 10);
  mm = parseInt(mm, 10);
  if (ampm.toUpperCase() === "PM" && hh !== 12) hh += 12;
  if (ampm.toUpperCase() === "AM" && hh === 12) hh = 0;

  const now = new Date();
  const checkInDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0);

  const diffMs = now.getTime() - checkInDate.getTime();
  return diffMs / (1000 * 60 * 60);
};

const runCheckoutReminderSweep = async () => {
  try {
    const today = todayStr();

    const openRecords = await Attendance.find({
      date: today,
      isManual: false,
      checkIn: { $ne: null },
      checkOut: null,
      checkoutReminderSent: { $ne: true },
    }).populate("userId", "name email");

    if (!openRecords.length) return;

    let sentCount = 0;

    for (const record of openRecords) {
      const hoursElapsed = hoursSinceCheckIn(record.checkIn);

      if (hoursElapsed >= 8.5 && record.userId?.email) {
        try {
          await sendCheckoutReminderEmail({
            to: record.userId.email,
            name: record.userId.name,
            checkInTime: record.checkIn,
          });

          record.checkoutReminderSent = true;
          await record.save();
          sentCount++;

          console.log(
            `⏰ Checkout reminder sent → ${record.userId.name} (${record.userId.email}) | checked in at ${record.checkIn} | ${hoursElapsed.toFixed(1)}h elapsed`
          );
        } catch (emailErr) {
          console.error(
            `❌ Checkout reminder FAILED → ${record.userId.name} (${record.userId.email}):`,
            emailErr.message
          );
          // checkoutReminderSent stays false so it retries on the next 15-min sweep
        }
      }
    }

    if (sentCount > 0) {
      console.log(`✅ Checkout reminder sweep complete → ${sentCount} reminder(s) sent`);
    }
  } catch (err) {
    console.error("❌ checkoutReminderJob error:", err.message);
  }
};

// Runs every 15 minutes
const startCheckoutReminderJob = () => {
  cron.schedule("*/15 * * * *", runCheckoutReminderSweep, {
    timezone: "Asia/Kolkata",
  });
  console.log("✅ Checkout reminder job scheduled (every 15 min, IST)");
};

module.exports = { startCheckoutReminderJob, runCheckoutReminderSweep };
