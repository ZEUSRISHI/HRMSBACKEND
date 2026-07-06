require("dotenv").config();
const connectDB     = require("../config/db");
const User          = require("../src/models/User");
const Attendance    = require("../src/models/Attendance");
const Leave         = require("../src/models/Leave");
const Task          = require("../src/models/Task");
const Project       = require("../src/models/Project");
const Payroll       = require("../src/models/Payroll");
const Client        = require("../src/models/Client");
const Invoice       = require("../src/models/Invoice");
const CalendarEvent = require("../src/models/CalendarEvent");
const DailyStatus   = require("../src/models/DailyStatus");
const Timesheet     = require("../src/models/Timesheet");
const Vendor        = require("../src/models/Vendor");
const Freelancer    = require("../src/models/Freelancer");

const reset = async () => {
  try {
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🗑️   HRMS DATABASE RESET STARTED");
    console.log("     ✅ Users/login credentials will NOT be deleted");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    await connectDB();

    /* ── Delete everything EXCEPT users ── */
    const results = await Promise.allSettled([
      Attendance   .deleteMany({}),
      Leave        .deleteMany({}),
      Task         .deleteMany({}),
      Project      .deleteMany({}),
      Payroll      .deleteMany({}),
      DailyStatus  .deleteMany({}),
      Timesheet    .deleteMany({}),
      CalendarEvent.deleteMany({}),
      Vendor       .deleteMany({}),
      Freelancer   .deleteMany({}),
      Client       .deleteMany({}),
      Invoice      .deleteMany({}),
    ]);

    const labels = [
      "Attendance", "Leaves", "Tasks", "Projects", "Payroll",
      "DailyStatus", "Timesheets", "CalendarEvents", "Vendors",
      "Freelancers", "Clients", "Invoices",
    ];

    console.log("\n🧹  Cleared collections:");
    results.forEach((result, i) => {
      if (result.status === "fulfilled") {
        console.log(`   ✅ ${labels[i].padEnd(16)} — deleted ${result.value.deletedCount} record(s)`);
      } else {
        console.log(`   ⚠️  ${labels[i].padEnd(16)} — skipped (model may not exist): ${result.reason?.message}`);
      }
    });

    /* ── Show users that were preserved ── */
    const users = await User.find().select("name email role isActive");
    console.log(`\n👤  Users preserved (${users.length} account${users.length !== 1 ? "s" : ""}):`);
    if (users.length === 0) {
      console.log("   ℹ️  No users found — run  node scripts/seed.js  to create them");
    } else {
      users.forEach((u) =>
        console.log(
          `   • ${u.email.padEnd(35)} [${u.role.padEnd(8)}]  ${u.isActive ? "✅ active" : "⛔ inactive"}`
        )
      );
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🎉  RESET COMPLETE — all data cleared, users kept!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\n📋  LOGIN CREDENTIALS (unchanged):");
    console.log("   Admin  →  admin@quibotech.com  /  admin123  →  select: Admin");
    console.log("\n💡  Run  node scripts/seed.js  to re-seed admin login.");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌  RESET FAILED:", error.message);
    console.error(error);
    process.exit(1);
  }
};

reset();