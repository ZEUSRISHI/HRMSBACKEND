const Project = require("../models/Project");
const User    = require("../models/User");

/* ════════════════════════════════════════════════════════════
   POPULATE HELPER
════════════════════════════════════════════════════════════ */
const populateProject = (query) =>
  query
    .populate("managerId",                   "name email role")
    .populate("teamMembers",                 "name email role")
    .populate("documents.uploadedBy",        "name email role")
    .populate("workSubmissions.submittedBy", "name email role");

/* ════════════════════════════════════════════════════════════
   CREATE  (Admin only)
════════════════════════════════════════════════════════════ */
const createProject = async (req, res) => {
  try {
    const {
      name, description, clientName, deadline,
      status, budget, managerId, teamMembers, createdAt,
    } = req.body;

    if (!name?.trim())
      return res.status(400).json({ success: false, message: "Project name is required." });
    if (!budget && budget !== 0)
      return res.status(400).json({ success: false, message: "Budget is required." });

    const project = new Project({
      name:        name.trim(),
      description: description || "",
      clientName:  clientName  || "",
      deadline:    deadline    || "",
      status:      status      || "planning",
      budget:      Number(budget) || 0,
      spent:       0,
      progress:    0,
      managerId:   managerId   || null,
      teamMembers: Array.isArray(teamMembers) ? teamMembers : [],
    });

    if (createdAt) {
      project.createdAt = new Date(createdAt);
      project.updatedAt = new Date(createdAt);
    }

    await project.save();
    const populated = await populateProject(Project.findById(project._id));
    res.status(201).json({ success: true, project: populated });
  } catch (err) {
    console.error("createProject:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ════════════════════════════════════════════════════════════
   CREATE MANUAL / BACKDATED  (Admin only)
════════════════════════════════════════════════════════════ */
const createManualProject = async (req, res) => {
  try {
    const {
      name, description, clientName, deadline,
      status, budget, spent, progress,
      managerId, teamMembers, createdAt,
    } = req.body;

    if (!name?.trim())
      return res.status(400).json({ success: false, message: "Project name is required." });

    const project = new Project({
      name:        name.trim(),
      description: description || "",
      clientName:  clientName  || "",
      deadline:    deadline    || "",
      status:      status      || "completed",
      budget:      Number(budget)   || 0,
      spent:       Number(spent)    || 0,
      progress:    Number(progress) || 0,
      managerId:   managerId   || null,
      teamMembers: Array.isArray(teamMembers) ? teamMembers : [],
    });

    if (createdAt) {
      project.createdAt = new Date(createdAt);
      project.updatedAt = new Date(createdAt);
    }

    await project.save();
    const populated = await populateProject(Project.findById(project._id));
    res.status(201).json({ success: true, project: populated });
  } catch (err) {
    console.error("createManualProject:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ════════════════════════════════════════════════════════════
   GET ALL  (Admin / Manager / HR)
════════════════════════════════════════════════════════════ */
const getAllProjects = async (req, res) => {
  try {
    const projects = await populateProject(
      Project.find().sort({ createdAt: -1 })
    );
    res.status(200).json({ success: true, projects });
  } catch (err) {
    console.error("getAllProjects:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ════════════════════════════════════════════════════════════
   GET MY  (Employee sees only assigned projects)
   Also used as fallback for any authenticated user.
════════════════════════════════════════════════════════════ */
const getMyProjects = async (req, res) => {
  try {
    const projects = await populateProject(
      Project.find({
        $or: [
          { managerId:   req.user._id },
          { teamMembers: req.user._id },
        ],
      }).sort({ createdAt: -1 })
    );
    res.status(200).json({ success: true, projects });
  } catch (err) {
    console.error("getMyProjects:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ════════════════════════════════════════════════════════════
   UPDATE  (Admin — full; Manager — progress + spent only)
════════════════════════════════════════════════════════════ */
const updateProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project)
      return res.status(404).json({ success: false, message: "Project not found." });

    const role = req.user.role;

    /* Managers may only patch progress and spent */
    if (role === "manager") {
      const allowed = {};
      if (req.body.progress !== undefined) allowed.progress = Number(req.body.progress);
      if (req.body.spent    !== undefined) allowed.spent    = Number(req.body.spent);

      if (!Object.keys(allowed).length)
        return res.status(403).json({ success: false, message: "Managers can only update progress and spent." });

      Object.assign(project, allowed);
      await project.save();
    } else {
      /* Admin — full update */
      const {
        name, description, clientName, deadline,
        status, budget, spent, progress, managerId, teamMembers,
      } = req.body;

      if (name        !== undefined) project.name        = name.trim();
      if (description !== undefined) project.description = description;
      if (clientName  !== undefined) project.clientName  = clientName;
      if (deadline    !== undefined) project.deadline    = deadline;
      if (status      !== undefined) project.status      = status;
      if (budget      !== undefined) project.budget      = Number(budget);
      if (spent       !== undefined) project.spent       = Number(spent);
      if (progress    !== undefined) project.progress    = Number(progress);
      if (managerId   !== undefined) project.managerId   = managerId || null;
      if (teamMembers !== undefined) project.teamMembers = Array.isArray(teamMembers) ? teamMembers : [];

      await project.save();
    }

    const populated = await populateProject(Project.findById(project._id));
    res.status(200).json({ success: true, project: populated });
  } catch (err) {
    console.error("updateProject:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ════════════════════════════════════════════════════════════
   DELETE  (Admin only)
════════════════════════════════════════════════════════════ */
const deleteProject = async (req, res) => {
  try {
    const project = await Project.findByIdAndDelete(req.params.id);
    if (!project)
      return res.status(404).json({ success: false, message: "Project not found." });
    res.status(200).json({ success: true, message: "Project deleted successfully." });
  } catch (err) {
    console.error("deleteProject:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ════════════════════════════════════════════════════════════
   UPLOAD DOCUMENT  (Admin / Manager / HR)
════════════════════════════════════════════════════════════ */
const uploadDocument = async (req, res) => {
  try {
    const { name, url, fileType, size } = req.body;

    if (!name?.trim() || !url?.trim())
      return res.status(400).json({ success: false, message: "Document name and URL are required." });

    const project = await Project.findById(req.params.id);
    if (!project)
      return res.status(404).json({ success: false, message: "Project not found." });

    project.documents.push({
      name:       name.trim(),
      url:        url.trim(),
      fileType:   fileType || "application/octet-stream",
      size:       Number(size) || 0,
      uploadedBy: req.user._id,
    });

    await project.save();
    const populated = await populateProject(Project.findById(project._id));
    res.status(200).json({ success: true, project: populated });
  } catch (err) {
    console.error("uploadDocument:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ════════════════════════════════════════════════════════════
   DELETE DOCUMENT  (Admin / Manager / HR)
════════════════════════════════════════════════════════════ */
const deleteDocument = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project)
      return res.status(404).json({ success: false, message: "Project not found." });

    const before = project.documents.length;
    project.documents = project.documents.filter(
      (d) => d._id.toString() !== req.params.docId
    );

    if (project.documents.length === before)
      return res.status(404).json({ success: false, message: "Document not found." });

    await project.save();
    const populated = await populateProject(Project.findById(project._id));
    res.status(200).json({ success: true, project: populated });
  } catch (err) {
    console.error("deleteDocument:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ════════════════════════════════════════════════════════════
   SUBMIT WORK
   Allowed: Manager, HR, Employee (anyone assigned to the project
            OR any privileged role).
   Admin is intentionally excluded from submitting — they oversee.
   Override this if your business rules differ.
════════════════════════════════════════════════════════════ */
const submitWork = async (req, res) => {
  try {
    const { description, hoursWorked } = req.body;

    if (!description?.trim())
      return res.status(400).json({ success: false, message: "Description is required." });

    const project = await Project.findById(req.params.id);
    if (!project)
      return res.status(404).json({ success: false, message: "Project not found." });

    const uid    = req.user._id.toString();
    const role   = req.user.role;

    const isTeamMember = project.teamMembers.some((m) => m.toString() === uid);
    const isManager    = project.managerId?.toString() === uid;
    const isHR         = role === "hr";
    /* Employees must be assigned; HR and Managers can submit freely */
    const canSubmit    = isTeamMember || isManager || isHR;

    if (!canSubmit)
      return res.status(403).json({
        success: false,
        message: "You are not a member of this project and cannot submit work.",
      });

    project.workSubmissions.push({
      submittedBy: req.user._id,
      description: description.trim(),
      hoursWorked: Math.max(0, Number(hoursWorked) || 0),
    });

    await project.save();
    const populated = await populateProject(Project.findById(project._id));
    res.status(200).json({ success: true, project: populated });
  } catch (err) {
    console.error("submitWork:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ════════════════════════════════════════════════════════════
   DELETE SUBMISSION  (Admin / Manager)
════════════════════════════════════════════════════════════ */
const deleteSubmission = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project)
      return res.status(404).json({ success: false, message: "Project not found." });

    const before = project.workSubmissions.length;
    project.workSubmissions = project.workSubmissions.filter(
      (s) => s._id.toString() !== req.params.subId
    );

    if (project.workSubmissions.length === before)
      return res.status(404).json({ success: false, message: "Submission not found." });

    await project.save();
    const populated = await populateProject(Project.findById(project._id));
    res.status(200).json({ success: true, project: populated });
  } catch (err) {
    console.error("deleteSubmission:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ════════════════════════════════════════════════════════════
   USER HELPERS
════════════════════════════════════════════════════════════ */

/* All active users — for team member picker (Admin / Manager / HR) */
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find(
      { isActive: { $ne: false } },
      "name email role"
    ).sort({ name: 1 });
    res.status(200).json({ success: true, users });
  } catch (err) {
    console.error("getAllUsers:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* Managers only — for manager dropdown (Admin) */
const getManagers = async (req, res) => {
  try {
    const managers = await User.find(
      { role: { $in: ["manager", "admin"] }, isActive: { $ne: false } },
      "name email role"
    ).sort({ name: 1 });
    res.status(200).json({ success: true, users: managers });
  } catch (err) {
    console.error("getManagers:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* HR + Employee — for member picker */
const getMembers = async (req, res) => {
  try {
    const members = await User.find(
      { role: { $in: ["hr", "employee"] }, isActive: { $ne: false } },
      "name email role"
    ).sort({ name: 1 });
    res.status(200).json({ success: true, users: members });
  } catch (err) {
    console.error("getMembers:", err.message);
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
  uploadDocument,
  deleteDocument,
  submitWork,
  deleteSubmission,
  getAllUsers,
  getManagers,
  getMembers,
};
