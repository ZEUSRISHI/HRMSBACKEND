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
   ONBOARDING — CREATE (NORMAL)
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

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({
        success: false,
        message: "A user with this email already exists.",
      });
    }

    const user = await User.create({
      name,
      email,
      password,
      phone: phone || "",
      role,
      isActive: true,
    });

    const tasks = STARTUP_TASKS.map((t) => ({ task: t, completed: false }));

    const onboarding = await Onboarding.create({
      userId: user._id,
      assignedBy: req.user._id,
      role,
      startDate,
      status: "in-progress",
      tasks,
    });

    await onboarding.populate("userId", "name email phone role isActive");
    await onboarding.populate("assignedBy", "name email role");

    res.status(201).json({ success: true, onboarding });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   MANUAL ONBOARDING (HISTORICAL)
   ============================================================ */
const createManualOnboarding = async (req, res) => {
  try {
    const {
      name, email, password, phone, role,
      startDate, createdAt, status, allTasksCompleted,
    } = req.body;

    if (!name || !email || !password || !role || !startDate) {
      return res.status(400).json({
        success: false,
        message: "name, email, password, role, and startDate are required.",
      });
    }

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        name,
        email,
        password,
        phone: phone || "",
        role,
        isActive: true,
      });
    }

    const existing = await Onboarding.findOne({ userId: user._id });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Onboarding already exists for this user.",
      });
    }

    const tasks = STARTUP_TASKS.map((t) => ({
      task: t,
      completed: allTasksCompleted === true,
      completedAt: allTasksCompleted ? new Date(createdAt || Date.now()) : undefined,
    }));

    const onboarding = new Onboarding({
      userId: user._id,
      assignedBy: req.user._id,
      role,
      startDate,
      status: status || "completed",
      tasks,
    });

    if (createdAt) {
      onboarding.createdAt = new Date(createdAt);
      onboarding.updatedAt = new Date(createdAt);
    }

    await onboarding.save();
    await onboarding.populate("userId", "name email phone role isActive");
    await onboarding.populate("assignedBy", "name email role");

    res.status(201).json({ success: true, onboarding });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   GET ALL ONBOARDING
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
   TOGGLE TASK
   ============================================================ */
const toggleOnboardingTask = async (req, res) => {
  try {
    const { taskId } = req.params;

    const onboarding = await Onboarding.findById(req.params.id);
    if (!onboarding) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    const task = onboarding.tasks.id(taskId);
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    task.completed = !task.completed;
    task.completedAt = task.completed ? new Date() : undefined;

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
   DELETE ONBOARDING
   ============================================================ */
const deleteOnboarding = async (req, res) => {
  try {
    await Onboarding.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   OFFBOARDING — CREATE (NORMAL)
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

    const exists = await Offboarding.findOne({ userId });
    if (exists) {
      return res.status(409).json({
        success: false,
        message: "Offboarding already exists.",
      });
    }

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

    await offboarding.populate("userId", "name email role isActive");
    await offboarding.populate("initiatedBy", "name email role");

    res.status(201).json({ success: true, offboarding });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   MANUAL OFFBOARDING (HISTORICAL)
   ============================================================ */
const createManualOffboarding = async (req, res) => {
  try {
    const {
      name, email, role,
      lastWorkingDay, reason,
      createdAt, status, clearanceStatus,
    } = req.body;

    if (!name || !email || !role || !lastWorkingDay || !reason) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    let user = await User.findOne({ email });

    if (!user) {
      const hashedPassword = await bcrypt.hash("Temp@123456", 10);
      user = await User.create({
        name,
        email,
        password: hashedPassword,
        role,
        isActive: false,
      });
    } else {
      user.isActive = false;
      await user.save();
    }

    const exists = await Offboarding.findOne({ userId: user._id });
    if (exists) {
      return res.status(409).json({
        success: false,
        message: "Already offboarded",
      });
    }

    const offboarding = new Offboarding({
      userId: user._id,
      initiatedBy: req.user._id,
      lastWorkingDay,
      reason,
      status: status || "completed",
      clearanceStatus: {
        hr: clearanceStatus?.hr ?? true,
        it: clearanceStatus?.it ?? true,
        finance: clearanceStatus?.finance ?? true,
        product: clearanceStatus?.product ?? true,
      },
    });

    if (createdAt) {
      offboarding.createdAt = new Date(createdAt);
      offboarding.updatedAt = new Date(createdAt);
    }

    await offboarding.save();
    await offboarding.populate("userId", "name email role isActive");

    res.status(201).json({ success: true, offboarding });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   GET ALL OFFBOARDING  ← WAS MISSING
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
   TOGGLE CLEARANCE  ← WAS MISSING
   ============================================================ */
const toggleClearance = async (req, res) => {
  try {
    const { key } = req.body;
    const validKeys = ["hr", "it", "finance", "product"];

    if (!key || !validKeys.includes(key)) {
      return res.status(400).json({
        success: false,
        message: "Invalid clearance key. Must be one of: hr, it, finance, product",
      });
    }

    const offboarding = await Offboarding.findById(req.params.id);
    if (!offboarding) {
      return res.status(404).json({ success: false, message: "Offboarding record not found" });
    }

    offboarding.clearanceStatus[key] = !offboarding.clearanceStatus[key];

    const allCleared = Object.values(offboarding.clearanceStatus).every(Boolean);
    if (allCleared) {
      offboarding.status = "completed";
    } else if (offboarding.status === "completed") {
      offboarding.status = "in-progress";
    }

    await offboarding.save();
    await offboarding.populate("userId", "name email phone role isActive");
    await offboarding.populate("initiatedBy", "name email role");

    res.status(200).json({ success: true, offboarding });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   DELETE OFFBOARDING
   ============================================================ */
const deleteOffboarding = async (req, res) => {
  try {
    await Offboarding.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   EXPORTS
   ============================================================ */
module.exports = {
  createOnboarding,
  createManualOnboarding,
  getAllOnboarding,
  toggleOnboardingTask,
  deleteOnboarding,

  createOffboarding,
  createManualOffboarding,
  getAllOffboarding,
  toggleClearance,
  deleteOffboarding,
};
