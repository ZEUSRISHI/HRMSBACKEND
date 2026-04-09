const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const authRoutes        = require("./routes/authRoutes");
const profileRoutes     = require("./routes/profileRoutes");
const dashboardRoutes   = require("./routes/dashboardRoutes");
const attendanceRoutes  = require("./routes/attendanceRoutes");
const leaveRoutes       = require("./routes/leaveRoutes");
const taskRoutes        = require("./routes/taskRoutes");
const projectRoutes     = require("./routes/projectRoutes");
const payrollRoutes     = require("./routes/payrollRoutes");
const clientRoutes      = require("./routes/clientRoutes");
const calendarRoutes    = require("./routes/calendarRoutes");
const dailyStatusRoutes = require("./routes/dailyStatusRoutes");
const timesheetRoutes   = require("./routes/timesheetRoutes");
const vendorRoutes      = require("./routes/vendorRoutes");
const freelancerRoutes  = require("./routes/freelancerRoutes");
const onboardingRoutes  = require("./routes/onboardingRoutes");

const app = express();

/* ============================================================
   ✅ CORS (FIXED FOR LOCAL + NETLIFY)
   ============================================================ */
const allowedOrigins = [
  "http://localhost:5173",
  "https://hrmspage.netlify.app"
];

app.use(
  cors({
    origin: function (origin, callback) {
      // allow requests with no origin (like mobile apps, Postman)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked: ${origin}`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

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
   RATE LIMITING
   ============================================================ */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    message: "Too many requests from this IP. Please try again after 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/auth", authLimiter);
app.use("/api", apiLimiter);

/* ============================================================
   ROUTES
   ============================================================ */
app.use("/api/auth",         authRoutes);
app.use("/api/profile",      profileRoutes);
app.use("/api/dashboard",    dashboardRoutes);
app.use("/api/attendance",   attendanceRoutes);
app.use("/api/leaves",       leaveRoutes);
app.use("/api/tasks",        taskRoutes);
app.use("/api/projects",     projectRoutes);
app.use("/api/payroll",      payrollRoutes);
app.use("/api/clients",      clientRoutes);
app.use("/api/calendar",     calendarRoutes);
app.use("/api/daily-status", dailyStatusRoutes);
app.use("/api/timesheets",   timesheetRoutes);
app.use("/api/vendors",      vendorRoutes);
app.use("/api/freelancers",  freelancerRoutes);
app.use("/api/onboarding",   onboardingRoutes);

/* ============================================================
   HEALTH CHECK
   ============================================================ */
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    database: "MongoDB Connected",
    version: "1.0.0",
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
    docs: "https://your-render-url/api/health",
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
    return res.status(403).json({
      success: false,
      message: err.message,
    });
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(422).json({
      success: false,
      message: "Validation failed",
      errors: messages,
    });
  }

  // Duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({
      success: false,
      message: `${field} already exists.`,
    });
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      message: "Invalid token.",
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      message: "Token expired. Please login again.",
    });
  }

  // Invalid ObjectId
  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: `Invalid ${err.path}: ${err.value}`,
    });
  }

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

module.exports = app;
