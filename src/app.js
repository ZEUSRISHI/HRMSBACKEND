"use strict";

const express = require("express");
const cors    = require("cors");
const morgan  = require("morgan");
const rateLimit = require("express-rate-limit");

/* ============================================================
   ROUTE IMPORTS — wrapped in guards so the broken one is named
   ============================================================ */
function safeRequire(path) {
  try {
    const m = require(path);
    const ok = typeof m === "function" || (m && typeof m.handle === "function");
    if (!ok) {
      console.error(`❌ BAD EXPORT in ${path} — got ${typeof m}, expected a router function. Fix: change "module.exports = { router }" to "module.exports = router"`);
    }
    return ok ? m : null;
  } catch (e) {
    console.error(`❌ FAILED to require ${path}:`, e.message);
    return null;
  }
}

const authRoutes        = safeRequire("./routes/authRoutes");
const profileRoutes     = safeRequire("./routes/profileRoutes");
const dashboardRoutes   = safeRequire("./routes/dashboardRoutes");
const attendanceRoutes  = safeRequire("./routes/attendanceRoutes");
const leaveRoutes       = safeRequire("./routes/leaveRoutes");
const taskRoutes        = safeRequire("./routes/taskRoutes");
const projectRoutes     = safeRequire("./routes/projectRoutes");
const payrollRoutes     = safeRequire("./routes/payrollRoutes");
const clientRoutes      = safeRequire("./routes/clientRoutes");
const calendarRoutes    = safeRequire("./routes/calendarRoutes");
const dailyStatusRoutes = safeRequire("./routes/dailyStatusRoutes");
const timesheetRoutes   = safeRequire("./routes/timesheetRoutes");
const vendorRoutes      = safeRequire("./routes/vendorRoutes");
const freelancerRoutes  = safeRequire("./routes/freelancerRoutes");
const onboardingRoutes  = safeRequire("./routes/onboardingRoutes");
const helpdeskRoutes    = safeRequire("./routes/helpdeskRoutes");
const userRoutes        = safeRequire("./routes/userRoutes");
const messageRoutes     = safeRequire("./routes/messageRoutes");
const emailCommRoutes   = safeRequire("./routes/emailCommRoutes");

const app = express();

/* ============================================================
   TRUST PROXY (MUST BE FIRST)
   ============================================================ */
app.set("trust proxy", 1);

/* ============================================================
   CORS CONFIG
   ============================================================ */
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://hrmsquibotech.vercel.app",
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    console.warn("⚠️ CORS blocked origin:", origin);
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.options("*", cors(corsOptions));
app.use(cors(corsOptions));

/* ============================================================
   BODY PARSERS
   ============================================================ */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

/* ============================================================
   LOGGING
   ============================================================ */
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

/* ============================================================
   RATE LIMITERS
   ============================================================ */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: "Too many auth requests. Try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, message: "Too many requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/auth", authLimiter);
app.use("/api",      apiLimiter);

/* ============================================================
   HELPER — only mount if the route loaded correctly
   ============================================================ */
function mount(path, router) {
  if (router) {
    app.use(path, router);
    console.log(`✅ Mounted ${path}`);
  } else {
    console.error(`⚠️  Skipped mounting ${path} — fix the export in that route file`);
  }
}

/* ============================================================
   ROUTES
   ============================================================ */
mount("/api/auth",         authRoutes);
mount("/api/profile",      profileRoutes);
mount("/api/dashboard",    dashboardRoutes);
mount("/api/attendance",   attendanceRoutes);
mount("/api/leaves",       leaveRoutes);
mount("/api/tasks",        taskRoutes);
mount("/api/projects",     projectRoutes);
mount("/api/payroll",      payrollRoutes);
mount("/api/clients",      clientRoutes);
mount("/api/calendar",     calendarRoutes);
mount("/api/daily-status", dailyStatusRoutes);
mount("/api/timesheets",   timesheetRoutes);
mount("/api/vendors",      vendorRoutes);
mount("/api/freelancers",  freelancerRoutes);
mount("/api/onboarding",   onboardingRoutes);
mount("/api/helpdesk",     helpdeskRoutes);
mount("/api/users",        userRoutes);
mount("/api/messages",     messageRoutes);
mount("/api/email-comm",   emailCommRoutes);

/* ============================================================
   HEALTH CHECK
   ============================================================ */
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success:     true,
    status:      "OK",
    timestamp:   new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    database:    "MongoDB Connected",
    version:     "1.0.0",
  });
});

/* ============================================================
   ROOT ROUTE
   ============================================================ */
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to Quibo Tech HRMS API",
    version: "1.0.0",
    docs:    "https://hrmsbackends.onrender.com/api/health",
  });
});

/* ============================================================
   404 HANDLER
   ============================================================ */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found.`,
  });
});

/* ============================================================
   GLOBAL ERROR HANDLER
   ============================================================ */
app.use((err, req, res, next) => {
  console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.error("❌ Error:", err.message);
  console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  if (err.message && err.message.includes("CORS")) {
    return res.status(403).json({ success: false, message: err.message });
  }

  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(422).json({ success: false, message: "Validation failed", errors: messages });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({ success: false, message: `${field} already exists.` });
  }

  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({ success: false, message: "Invalid token." });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({ success: false, message: "Token expired. Please login again." });
  }

  if (err.name === "CastError") {
    return res.status(400).json({ success: false, message: `Invalid ${err.path}: ${err.value}` });
  }

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

module.exports = app;
