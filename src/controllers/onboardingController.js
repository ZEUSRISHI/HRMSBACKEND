const Onboarding = require("../models/Onboarding");
const Offboarding = require("../models/Offboarding");
const User = require("../models/User");
const bcrypt = require("bcryptjs");

/* ─── Startup task template ─── */
const STARTUP_TASKS = [
  "Offer letter signed",
  "Startup policy briefing",
  "Git + Repo access",
  "Product demo walkthrough",
  "First sprint assigned",
  "System & tools setup",
  "ID card and access badge issued",
];

/* ============================================================
   ONBOARDING — CREATE
   Admin / HR creates a new employee account + onboarding track
   ============================================================ */
const createOnboarding = async (req, res) => {
  try {
    const { name, email, password, phone, role, startDate } = req.body;

    if (!name || !email || !password || !role || !startDate) {
      return res.status(400).json({
        success: false,
        message: "name, email, password, role, and startDate are required.",
      });
    }

    /* Check if user already exists */
    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({
        success: false,
        message: "A user with this email already exists.",
      });
    }

    /* Create the user account (password will be hashed by User model pre-save hook) */
    const user = await User.create({
      name,
      email,
      password,
      phone: phone || "",
      role,
      isActive: true,
    });

    /* Check if onboarding track already created for this user */
    const alreadyOnboarded = await Onboarding.findOne({ userId: user._id });
    if (alreadyOnboarded) {
      return res.status(409).json({
        success: false,
        message: "Onboarding already exists for this user.",
      });
    }

    /* Build tasks array from startup template */
    const tasks = STARTUP_TASKS.map((t) => ({ task: t, completed: false }));

    const onboarding = await Onboarding.create({
      userId: user._id,
      assignedBy: req.user._id,
      role,
      startDate,
      status: "in-progress",
      tasks,
    });

    await onboarding.populate("userId", "name email phone role");
    await onboarding.populate("assignedBy", "name email role");

    res.status(201).json({ success: true, onboarding });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   ONBOARDING — GET ALL
   ============================================================ */
const getAllOnboarding = async (req, res) => {
  try {
    const list = await Onboarding.find()
      .populate("userId", "name email phone role isActive")
      .populate("assignedBy", "name email role")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, onboarding: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   ONBOARDING — TOGGLE TASK
   ============================================================ */
const toggleOnboardingTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const onboarding = await Onboarding.findById(req.params.id);

    if (!onboarding) {
      return res.status(404).json({ success: false, message: "Onboarding record not found." });
    }

    const task = onboarding.tasks.id(taskId);
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found." });
    }

    task.completed = !task.completed;
    task.completedAt = task.completed ? new Date() : undefined;

    /* Auto-update status */
    const allDone = onboarding.tasks.every((t) => t.completed);
    onboarding.status = allDone ? "completed" : "in-progress";

    await onboarding.save();
    await onboarding.populate("userId", "name email phone role isActive");

    res.status(200).json({ success: true, onboarding });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   ONBOARDING — DELETE
   ============================================================ */
const deleteOnboarding = async (req, res) => {
  try {
    await Onboarding.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Onboarding record deleted." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   OFFBOARDING — CREATE
   Suspends user account + creates offboarding checklist
   ============================================================ */
const createOffboarding = async (req, res) => {
  try {
    const { userId, lastWorkingDay, reason } = req.body;

    if (!userId || !lastWorkingDay || !reason) {
      return res.status(400).json({
        success: false,
        message: "userId, lastWorkingDay, and reason are required.",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    /* Prevent double offboarding */
    const already = await Offboarding.findOne({ userId });
    if (already) {
      return res.status(409).json({
        success: false,
        message: "Offboarding already initiated for this user.",
      });
    }

    /* ✅ Suspend the account immediately */
    user.isActive = false;
    await user.save();

    const offboarding = await Offboarding.create({
      userId,
      initiatedBy: req.user._id,
      lastWorkingDay,
      reason,
      status: "in-progress",
      clearanceStatus: { hr: false, it: false, finance: false, product: false },
    });

    await offboarding.populate("userId", "name email phone role");
    await offboarding.populate("initiatedBy", "name email role");

    res.status(201).json({ success: true, offboarding });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   OFFBOARDING — GET ALL
   ============================================================ */
const getAllOffboarding = async (req, res) => {
  try {
    const list = await Offboarding.find()
      .populate("userId", "name email phone role isActive")
      .populate("initiatedBy", "name email role")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, offboarding: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   OFFBOARDING — TOGGLE CLEARANCE
   ============================================================ */
const toggleClearance = async (req, res) => {
  try {
    const { key } = req.body;
    const validKeys = ["hr", "it", "finance", "product"];

    if (!validKeys.includes(key)) {
      return res.status(400).json({ success: false, message: "Invalid clearance key." });
    }

    const offboarding = await Offboarding.findById(req.params.id);
    if (!offboarding) {
      return res.status(404).json({ success: false, message: "Offboarding record not found." });
    }

    offboarding.clearanceStatus[key] = !offboarding.clearanceStatus[key];

    /* Auto-complete when all clearances done */
    const allCleared = Object.values(offboarding.clearanceStatus).every(Boolean);
    offboarding.status = allCleared ? "completed" : "in-progress";

    await offboarding.save();
    await offboarding.populate("userId", "name email phone role isActive");

    res.status(200).json({ success: true, offboarding });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   OFFBOARDING — DELETE
   ============================================================ */
const deleteOffboarding = async (req, res) => {
  try {
    await Offboarding.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Offboarding record deleted." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  createOnboarding,
  getAllOnboarding,
  toggleOnboardingTask,
  deleteOnboarding,
  createOffboarding,
  getAllOffboarding,
  toggleClearance,
  deleteOffboarding,
};
