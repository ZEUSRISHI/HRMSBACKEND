const Project = require("../models/Project");
const User    = require("../models/User");

const createProject = async (req, res) => {
  try {
    const project = await Project.create(req.body);
    await project.populate("managerId",   "name email role");
    await project.populate("teamMembers", "name email role");
    res.status(201).json({ success: true, project });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── MANUAL (historical) ── */
const createManualProject = async (req, res) => {
  try {
    const {
      name, description, clientName, deadline,
      status, budget, spent, progress,
      managerId, teamMembers, createdAt,
    } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: "Project name is required." });
    }

    const project = new Project({
      name,
      description: description || "",
      clientName:  clientName  || "",
      deadline:    deadline    || "",
      status:      status      || "completed",
      budget:      Number(budget)   || 0,
      spent:       Number(spent)    || 0,
      progress:    Number(progress) || 0,
      managerId:   managerId   || null,
      teamMembers: teamMembers || [],
    });

    if (createdAt) {
      project.createdAt = new Date(createdAt);
      project.updatedAt = new Date(createdAt);
    }

    await project.save();
    await project.populate("managerId",   "name email role");
    await project.populate("teamMembers", "name email role");

    res.status(201).json({ success: true, project });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getAllProjects = async (req, res) => {
  try {
    const projects = await Project.find()
      .populate("managerId",   "name email role")
      .populate("teamMembers", "name email role")
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, projects });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getMyProjects = async (req, res) => {
  try {
    const projects = await Project.find({
      $or: [
        { managerId:   req.user._id },
        { teamMembers: req.user._id },
      ],
    })
      .populate("managerId",   "name email role")
      .populate("teamMembers", "name email role")
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, projects });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateProject = async (req, res) => {
  try {
    const project = await Project.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    )
      .populate("managerId",   "name email role")
      .populate("teamMembers", "name email role");
    res.status(200).json({ success: true, project });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteProject = async (req, res) => {
  try {
    await Project.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Project deleted." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getManagers = async (req, res) => {
  try {
    const managers = await User.find({ role: "manager" }, "name email role");
    res.status(200).json({ success: true, users: managers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getMembers = async (req, res) => {
  try {
    const members = await User.find(
      { role: { $in: ["hr", "employee"] } },
      "name email role"
    );
    res.status(200).json({ success: true, users: members });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  createProject,
  createManualProject,
  getAllProjects,
  getMyProjects,
  updateProject,
  deleteProject,
  getManagers,
  getMembers,
};
