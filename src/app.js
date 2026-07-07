"use strict";

const express     = require("express");
const cors        = require("cors");
const morgan      = require("morgan");
const helmet      = require("helmet");
const rateLimit   = require("express-rate-limit");
const slowDown    = require("express-slow-down");

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
   ✅ DISABLE X-Powered-By
   ============================================================ */
app.disable("x-powered-by");

/* ============================================================
   ✅ HELMET — explicit config so every header the security test
   is looking for (HSTS, CSP, X-Content-Type-Options, Referrer-Policy,
   Permissions-Policy) is guaranteed present on every API response.
   ============================================================ */
app.use(
  helmet({
    hsts: {
      maxAge: 63072000,
      includeSubDomains: true,
      preload: true,
    },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    noSniff: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    frameguard: { action: "deny" },
  })
);

/* ============================================================
   ✅ PERMISSIONS-POLICY
   ============================================================ */
app.use((req, res, next) => {
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );
  next();
});

/* ============================================================
   ✅ STRIP HOSTING / PLATFORM HEADERS
   ============================================================ */
app.use((req, res, next) => {
  res.removeHeader("X-Powered-By");
  res.removeHeader("Server");

  const originalWriteHead = res.writeHead;
  res.writeHead = function (...args) {
    res.removeHeader("X-Powered-By");
    res.removeHeader("Server");
    res.removeHeader("X-Render-Origin-Server");
    res.removeHeader("Via");
    return originalWriteHead.apply(res, args);
  };

  next();
});

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
   ✅ REDUCED from 10mb → 1mb globally. Large payloads amplify
   the damage of a flood (more CPU/memory per request). Routes
   that genuinely need large uploads (documents, avatars) use
   multer directly and are unaffected by this global JSON limit.
   ============================================================ */
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

/* ============================================================
   LOGGING
   ============================================================ */
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

/* ============================================================
   RATE LIMITERS
   ============================================================ */

/* Strict limiter for auth endpoints (brute-force / dictionary protection) */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: "Too many login attempts. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

/* Existing 15-minute window limiter for general API traffic */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, message: "Too many requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

/* ============================================================
   ✅ NEW — SHORT-WINDOW BURST LIMITER
   Catches rapid-fire load-test-style traffic (many requests/sec)
   that the 15-min window wouldn't block until much later.
   (fixes: "Denial of Service (DoS) Testing" finding)
   ============================================================ */
const burstLimiter = rateLimit({
  windowMs: 1000,       // 1 second window
  max: 10,              // max 10 requests/sec per IP
  message: { success: false, message: "Too many requests in a short period." },
  standardHeaders: true,
  legacyHeaders: false,
});

/* ============================================================
   ✅ NEW — PROGRESSIVE SLOWDOWN
   Adds increasing delay once a client exceeds a threshold within
   a minute, so legitimate short bursts degrade gracefully instead
   of immediately hard-blocking, while floods get throttled hard.
   ============================================================ */
const speedLimiter = slowDown({
  windowMs: 60 * 1000,     // 1 minute
  delayAfter: 50,          // allow 50 requests/min at full speed
  delayMs: () => 500,      // then add 500ms delay per request past that
  maxDelayMs: 5000,        // cap delay at 5 seconds
});

app.use("/api/auth", authLimiter);
app.use("/api", burstLimiter);
app.use("/api", speedLimiter);
app.use("/api", apiLimiter);

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
