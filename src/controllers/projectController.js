const Project = require("../models/Project");
const User    = require("../models/User");

const createProject = async (req, res) => {
  try {
    const project = await Project.create(req.body);
    res.status(201).json({ success: true, project });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getAllProjects = async (req, res) => {
  try {
    const projects = await Project.find()
      .populate("managerId",   "name email")
      .populate("teamMembers", "name email")
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
      .populate("managerId",   "name email")
      .populate("teamMembers", "name email")
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
    );
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

// ✅ Returns only managers (for managerId dropdown)
const getManagers = async (req, res) => {
  try {
    const managers = await User.find({ role: "manager" }, "name email role");
    res.status(200).json({ success: true, users: managers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Returns hr + employees (for teamMembers dropdown)
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
  getAllProjects,
  getMyProjects,
  updateProject,
  deleteProject,
  getManagers,
  getMembers,
};
