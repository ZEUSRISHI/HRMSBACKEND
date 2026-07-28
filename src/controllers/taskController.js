const Task = require("../models/Task");
const User = require("../models/User"); // same User model used by userController.js / User Management

// ✅ This is the single source of truth for who each role can assign to.
// Admin → manager, hr, employee (everyone below admin)
// Manager → hr, employee
// HR → employee
const allowedRoles = {
  admin:   ["manager", "hr", "employee"],
  manager: ["hr", "employee"],
  hr:      ["employee"],
};

// Powers the "Assign To" dropdown. Since it queries the same User
// collection that User Management writes to, any user created/edited
// there (with the correct role) shows up here immediately.
const getAssignableUsers = async (req, res) => {
  try {
    const roles = allowedRoles[req.user.role];
    if (!roles) return res.status(403).json({ success: false, message: "Not authorized." });
    const users = await User.find({ role: { $in: roles }, isActive: true })
      .select("name email role");
    res.status(200).json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const createTask = async (req, res) => {
  try {
    const { assignedTo, title, dueDate } = req.body;
    const roles = allowedRoles[req.user.role];

    if (assignedTo) {
      const targetUser = await User.findById(assignedTo);
      if (!targetUser)
        return res.status(400).json({ success: false, message: "Assigned user not found." });
      if (!roles.includes(targetUser.role))
        return res.status(403).json({
          success: false,
          message: `You can only assign tasks to: ${roles.join(", ")}.`,
        });
    }

    // Duplicate-submission guard — same title/assignee/dueDate by the
    // same creator within 5 seconds returns the existing task instead
    // of creating a second one.
    const fiveSecondsAgo = new Date(Date.now() - 5000);
    const recentDuplicate = await Task.findOne({
      title,
      assignedTo: assignedTo || null,
      assignedBy: req.user._id,
      dueDate: dueDate || "",
      createdAt: { $gte: fiveSecondsAgo },
    });

    if (recentDuplicate) {
      const populated = await Task.findById(recentDuplicate._id)
        .populate("assignedTo", "name email role")
        .populate("assignedBy", "name email role");
      return res.status(200).json({
        success: true,
        task: populated,
        note: "Duplicate submission detected — returned existing task instead of creating a new one.",
      });
    }

    const task = await Task.create({
      ...req.body,
      assignedTo: assignedTo || null,
      assignedBy: req.user._id,
    });

    const populated = await Task.findById(task._id)
      .populate("assignedTo", "name email role")
      .populate("assignedBy", "name email role");

    res.status(201).json({ success: true, task: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const createManualTask = async (req, res) => {
  try {
    const {
      title, description, assignedTo, assignedBy,
      priority, dueDate, status, createdAt,
      updates,
    } = req.body;

    if (!title) return res.status(400).json({ success: false, message: "Title is required." });

    let assignedToId = null;
    if (assignedTo) {
      const u = await User.findById(assignedTo);
      if (!u) return res.status(400).json({ success: false, message: "assignedTo user not found." });
      assignedToId = u._id;
    }

    let assignedById = req.user._id;
    if (assignedBy) {
      const u = await User.findById(assignedBy);
      if (!u) return res.status(400).json({ success: false, message: "assignedBy user not found." });
      assignedById = u._id;
    }

    const fiveSecondsAgo = new Date(Date.now() - 5000);
    const recentDuplicate = await Task.findOne({
      title,
      assignedTo: assignedToId,
      assignedBy: assignedById,
      dueDate: dueDate || "",
      createdAt: { $gte: fiveSecondsAgo },
    });

    if (recentDuplicate) {
      const populated = await Task.findById(recentDuplicate._id)
        .populate("assignedTo", "name email role")
        .populate("assignedBy", "name email role");
      return res.status(200).json({
        success: true,
        task: populated,
        note: "Duplicate submission detected — returned existing task instead of creating a new one.",
      });
    }

    const taskData = {
      title,
      description: description || "",
      assignedTo:  assignedToId,
      assignedBy:  assignedById,
      priority:    priority || "medium",
      dueDate:     dueDate  || "",
      status:      status   || "pending",
      updates:     updates  || [],
    };

    const task = new Task(taskData);
    if (createdAt) {
      task.createdAt = new Date(createdAt);
      task.updatedAt = new Date(createdAt);
    }
    await task.save();

    const populated = await Task.findById(task._id)
      .populate("assignedTo", "name email role")
      .populate("assignedBy", "name email role");

    res.status(201).json({ success: true, task: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const bulkManualTasks = async (req, res) => {
  try {
    const { tasks } = req.body;
    if (!Array.isArray(tasks) || tasks.length === 0)
      return res.status(400).json({ success: false, message: "tasks array is required." });

    const results = { created: 0, failed: [] };

    for (const row of tasks) {
      try {
        const taskData = {
          title:       row.title || "Untitled",
          description: row.description || "",
          priority:    row.priority || "medium",
          dueDate:     row.dueDate  || "",
          status:      row.status   || "pending",
          assignedBy:  req.user._id,
          updates:     [],
        };

        if (row.assignedTo) {
          let user = await User.findById(row.assignedTo).catch(() => null);
          if (!user) user = await User.findOne({ name: row.assignedTo });
          if (user) taskData.assignedTo = user._id;
        }

        if (row.assignedBy) {
          let user = await User.findById(row.assignedBy).catch(() => null);
          if (!user) user = await User.findOne({ name: row.assignedBy });
          if (user) taskData.assignedBy = user._id;
        }

        const task = new Task(taskData);
        if (row.createdAt) {
          task.createdAt = new Date(row.createdAt);
          task.updatedAt = new Date(row.createdAt);
        }
        await task.save();
        results.created++;
      } catch (e) {
        results.failed.push({ row, error: e.message });
      }
    }

    res.status(201).json({ success: true, ...results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Admin-only — global "see every task" view.
const getAllTasks = async (req, res) => {
  try {
    const { status, priority, assignedTo, startDate, endDate, range } = req.query;

    const filter = {};
    if (status)     filter.status    = status;
    if (priority)   filter.priority  = priority;
    if (assignedTo) filter.assignedTo = assignedTo;

    let dateFilter = {};
    if (range === "this_week") {
      const now  = new Date();
      const day  = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now.setDate(diff));
      monday.setHours(0, 0, 0, 0);
      dateFilter = { $gte: monday };
    } else if (range === "this_month") {
      const now   = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter  = { $gte: start };
    } else if (startDate || endDate) {
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.$lte = end;
      }
    }

    if (Object.keys(dateFilter).length > 0) filter.createdAt = dateFilter;

    const tasks = await Task.find(filter)
      .populate("assignedTo", "name email role")
      .populate("assignedBy", "name email role")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, tasks, total: tasks.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Manager / HR / Employee — own created/assigned tasks, full CRUD scope.
const getMyTasks = async (req, res) => {
  try {
    const tasks = await Task.find({
      $or: [{ assignedTo: req.user._id }, { assignedBy: req.user._id }],
    })
      .populate("assignedTo", "name email role")
      .populate("assignedBy", "name email role")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, tasks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

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

const deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: "Task not found." });

    const isOwner = task.assignedBy?.toString() === req.user._id.toString();

    if (req.user.role !== "admin" && !isOwner) {
      return res.status(403).json({
        success: false,
        message: "You can only delete tasks you created.",
      });
    }

    await Task.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Task deleted." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

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

const getTaskReport = async (req, res) => {
  try {
    const { range, startDate, endDate, status, priority } = req.query;

    const filter = {};
    if (status)   filter.status   = status;
    if (priority) filter.priority = priority;

    let dateFilter = {};
    if (range === "this_week") {
      const now  = new Date();
      const day  = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now);
      monday.setDate(diff);
      monday.setHours(0, 0, 0, 0);
      dateFilter = { $gte: monday };
    } else if (range === "this_month") {
      const now   = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter  = { $gte: start };
    } else if (startDate || endDate) {
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.$lte = end;
      }
    }

    if (Object.keys(dateFilter).length > 0) filter.createdAt = dateFilter;

    if (req.user.role !== "admin") {
      filter.$or = [{ assignedTo: req.user._id }, { assignedBy: req.user._id }];
    }

    const tasks = await Task.find(filter)
      .populate("assignedTo", "name email role")
      .populate("assignedBy", "name email role")
      .sort({ createdAt: -1 });

    const summary = {
      total:      tasks.length,
      pending:    tasks.filter(t => t.status === "pending").length,
      inProgress: tasks.filter(t => t.status === "in-progress").length,
      completed:  tasks.filter(t => t.status === "completed").length,
      high:       tasks.filter(t => t.priority === "high").length,
      medium:     tasks.filter(t => t.priority === "medium").length,
      low:        tasks.filter(t => t.priority === "low").length,
    };

    const empMap = {};
    for (const t of tasks) {
      const name  = t.assignedTo?.name  || "Unassigned";
      const email = t.assignedTo?.email || "";
      const role  = t.assignedTo?.role  || "";
      if (!empMap[name]) {
        empMap[name] = { name, email, role, total: 0, pending: 0, inProgress: 0, completed: 0, totalHours: 0 };
      }
      empMap[name].total++;
      if (t.status === "pending")     empMap[name].pending++;
      if (t.status === "in-progress") empMap[name].inProgress++;
      if (t.status === "completed")   empMap[name].completed++;
      empMap[name].totalHours += t.updates.reduce((s, u) => s + (u.hoursWorked || 0), 0);
    }

    res.status(200).json({
      success: true,
      tasks,
      summary,
      employeeSummary: Object.values(empMap),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getAssignableUsers,
  createTask,
  createManualTask,
  bulkManualTasks,
  getAllTasks,
  getMyTasks,
  updateTask,
  deleteTask,
  addTaskUpdate,
  getTaskReport,
};
