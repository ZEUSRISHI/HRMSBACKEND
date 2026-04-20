require("dotenv").config();
const app = require("./app");
const connectDB = require("../config/db");
const cors = require("cors");

const PORT = process.env.PORT || 5000;

/* ============================================================
   🌐 CORS CONFIG (FIXED)
   ============================================================ */

const allowedOrigins = [
  "https://hrmsquibo.netlify.app"
];

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (Postman / mobile apps)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("❌ CORS not allowed: " + origin));
    }
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  credentials: true
}));

/* ============================================================
   START SERVER
   ============================================================ */

const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("🚀  HRMS Backend Server Started");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`📍  URL         : http://localhost:${PORT}`);
      console.log(`🌍  Environment : ${process.env.NODE_ENV || "development"}`);
      console.log(`🗄️   Database    : ${process.env.MONGO_URI}`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      console.log("\n📋  ALL API ENDPOINTS");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      console.log("\n🔐  AUTH");
      console.log("   POST   /api/auth/signup");
      console.log("   POST   /api/auth/login");
      console.log("   POST   /api/auth/logout");
      console.log("   POST   /api/auth/refresh-token");
      console.log("   POST   /api/auth/reset-password");
      console.log("   PUT    /api/auth/change-password");
      console.log("   GET    /api/auth/me");

      console.log("\n👤  PROFILE");
      console.log("   GET    /api/profile");
      console.log("   PUT    /api/profile");
      console.log("   DELETE /api/profile");

      console.log("\n📊  DASHBOARD");
      console.log("   GET    /api/dashboard/stats");
      console.log("   GET    /api/dashboard/users");
      console.log("   PUT    /api/dashboard/users/:id");
      console.log("   DELETE /api/dashboard/users/:id");

      console.log("\n⏰  ATTENDANCE");
      console.log("   POST   /api/attendance/checkin");
      console.log("   POST   /api/attendance/checkout");
      console.log("   GET    /api/attendance/today");
      console.log("   GET    /api/attendance/my");
      console.log("   GET    /api/attendance/all");

      console.log("\n🌴  LEAVES");
      console.log("   POST   /api/leaves/apply");
      console.log("   GET    /api/leaves/my");
      console.log("   GET    /api/leaves/pending");
      console.log("   GET    /api/leaves/all");
      console.log("   PUT    /api/leaves/:id/approve");
      console.log("   PUT    /api/leaves/:id/reject");

      console.log("\n✅  TASKS");
      console.log("   POST   /api/tasks");
      console.log("   GET    /api/tasks/all");
      console.log("   GET    /api/tasks/my");
      console.log("   PUT    /api/tasks/:id");
      console.log("   DELETE /api/tasks/:id");
      console.log("   POST   /api/tasks/:id/update");

      console.log("\n📁  PROJECTS");
      console.log("   POST   /api/projects");
      console.log("   GET    /api/projects/all");
      console.log("   GET    /api/projects/my");
      console.log("   PUT    /api/projects/:id");
      console.log("   DELETE /api/projects/:id");

      console.log("\n💰  PAYROLL");
      console.log("   POST   /api/payroll");
      console.log("   GET    /api/payroll/all");
      console.log("   GET    /api/payroll/my");
      console.log("   POST   /api/payroll/process");
      console.log("   PUT    /api/payroll/:id");
      console.log("   DELETE /api/payroll/:id");

      console.log("\n🏢  CLIENTS");
      console.log("   POST   /api/clients");
      console.log("   GET    /api/clients");
      console.log("   PUT    /api/clients/:id");
      console.log("   DELETE /api/clients/:id");
      console.log("   POST   /api/clients/invoices");
      console.log("   GET    /api/clients/invoices");

      console.log("\n📅  CALENDAR");
      console.log("   POST   /api/calendar");
      console.log("   GET    /api/calendar");
      console.log("   GET    /api/calendar/all");
      console.log("   PUT    /api/calendar/:id");
      console.log("   DELETE /api/calendar/:id");

      console.log("\n📝  DAILY STATUS");
      console.log("   POST   /api/daily-status");
      console.log("   GET    /api/daily-status/my");
      console.log("   GET    /api/daily-status/all");
      console.log("   POST   /api/daily-status/:id/comment");

      console.log("\n🕐  TIMESHEETS");
      console.log("   POST   /api/timesheets");
      console.log("   GET    /api/timesheets/my");
      console.log("   GET    /api/timesheets/all");
      console.log("   PUT    /api/timesheets/:id/approve");
      console.log("   PUT    /api/timesheets/:id/reject");

      console.log("\n🏭  VENDORS");
      console.log("   POST   /api/vendors");
      console.log("   GET    /api/vendors");
      console.log("   PUT    /api/vendors/:id");
      console.log("   DELETE /api/vendors/:id");

      console.log("\n👨‍💼  FREELANCERS");
      console.log("   POST   /api/freelancers");
      console.log("   GET    /api/freelancers");
      console.log("   PUT    /api/freelancers/:id");
      console.log("   DELETE /api/freelancers/:id");

      console.log("\n🎫  HELPDESK");
      console.log("   POST   /api/helpdesk");
      console.log("   GET    /api/helpdesk/my");
      console.log("   GET    /api/helpdesk/all");
      console.log("   GET    /api/helpdesk/stats");
      console.log("   GET    /api/helpdesk/:id");
      console.log("   PUT    /api/helpdesk/:id");
      console.log("   PATCH  /api/helpdesk/:id/edit");
      console.log("   DELETE /api/helpdesk/:id");
      console.log("   POST   /api/helpdesk/:id/comments");
      console.log("   DELETE /api/helpdesk/:id/comments/:commentId");

      console.log("\n❤️   HEALTH");
      console.log("   GET    /api/health");

      console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    });

  } catch (error) {
    console.error("❌ Failed to start server:", error.message);
    process.exit(1);
  }
};

/* ============================================================
   GLOBAL ERROR HANDLING
   ============================================================ */

process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Promise Rejection:", err.message);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err.message);
  process.exit(1);
});

startServer();
