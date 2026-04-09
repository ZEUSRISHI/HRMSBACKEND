const Task = require("../models/Task");
const User = require("../models/User");

/* ============================================================
   ASSIGNMENT RULES
   Admin   → can assign to Manager only
   Manager → can assign to HR or Employee
   HR      → can assign to Employee only
   ============================================================ */
const allowedRoles = {
  admin:   ["manager"],
  manager: ["hr", "employee"],
  hr:      ["employee"],
};

/* ============================================================
   GET ASSIGNABLE USERS (for dropdown)
   GET /api/tasks/assignable
   ============================================================ */
const getAssignableUsers = async (req, res) => {
  try {
    const roles = allowedRoles[req.user.role];
    if (!roles) return res.status(403).json({ success: false, message: "Not authorized." });

    const users = await User.find({ role: { $in: roles } }).select("name email role");
    res.status(200).json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   CREATE TASK
   POST /api/tasks
   ============================================================ */
const createTask = async (req, res) => {
  try {
    const { assignedTo } = req.body;
    const roles = allowedRoles[req.user.role];

    // Validate assignedTo role
    if (assignedTo) {
      const targetUser = await User.findById(assignedTo);
      if (!targetUser) {
        return res.status(400).json({ success: false, message: "Assigned user not found." });
      }
      if (!roles.includes(targetUser.role)) {
        return res.status(403).json({
          success: false,
          message: `You can only assign tasks to: ${roles.join(", ")}.`,
        });
      }
    }

    const task = await Task.create({
      ...req.body,
      assignedTo: assignedTo || null,
      assignedBy: req.user._id,
    });

    res.status(201).json({ success: true, task });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   GET ALL TASKS (Admin sees all)
   GET /api/tasks/all
   ============================================================ */
const getAllTasks = async (req, res) => {
  try {
    const tasks = await Task.find()
      .populate("assignedTo", "name email role")
      .populate("assignedBy", "name email role")
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, tasks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   GET MY TASKS
   — Tasks assigned TO me
   — Tasks assigned BY me
   GET /api/tasks/my
   ============================================================ */
const getMyTasks = async (req, res) => {
  try {
    const tasks = await Task.find({
      $or: [
        { assignedTo: req.user._id },
        { assignedBy: req.user._id },
      ],
    })
      .populate("assignedTo", "name email role")
      .populate("assignedBy", "name email role")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, tasks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   UPDATE TASK
   PUT /api/tasks/:id
   ============================================================ */
const updateTask = async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true })
      .populate("assignedTo", "name email role")
      .populate("assignedBy", "name email role");
    res.status(200).json({ success: true, task });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   DELETE TASK (Admin only)
   DELETE /api/tasks/:id
   ============================================================ */
const deleteTask = async (req, res) => {
  try {
    await Task.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Task deleted." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   ADD TASK UPDATE
   POST /api/tasks/:id/update
   ============================================================ */
const addTaskUpdate = async (req, res) => {
  try {
    const { status, progress, hoursWorked, note, blocker } = req.body;
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: "Task not found." });

    task.updates.unshift({ status, progress, hoursWorked, note, blocker });
    task.status = status;
    await task.save();

    res.status(200).json({ success: true, task });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getAssignableUsers,
  createTask,
  getAllTasks,
  getMyTasks,
  updateTask,
  deleteTask,
  addTaskUpdate,
};
