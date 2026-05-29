// controllers/projectController.js
const Project = require("../models/Project");
const User    = require("../models/User");

/* ════════════════════════════════════════════════════════════
   CONSTANTS
════════════════════════════════════════════════════════════ */
const MAX_DOC_SIZE        = 10 * 1024 * 1024;   // 10 MB per file
const MAX_PROJECT_STORAGE = 14 * 1024 * 1024;   // 14 MB total per project (safe under 16 MB BSON limit)

const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp",
  "text/plain", "application/zip",
];

/* ════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════ */

/** Estimate actual byte size from a base64 string or data-URL */
const estimateBase64Bytes = (dataUrl = "") => {
  const b64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
  // base64 encodes 3 bytes as 4 chars; subtract padding
  const padding = (b64.match(/=+$/) || [""])[0].length;
  return Math.ceil((b64.length * 3) / 4) - padding;
};

/** Calculate total bytes currently stored in project.documents */
const projectDocStorageBytes = (project) =>
  project.documents.reduce((sum, d) => sum + estimateBase64Bytes(d.url || ""), 0);

/* ════════════════════════════════════════════════════════════
   POPULATE HELPER
════════════════════════════════════════════════════════════ */
const populateProject = (query) =>
  query
    .populate("managerId",                  "name email role")
    .populate("teamMembers",                "name email role department designation")
    .populate("documents.uploadedBy",       "name email role")
    .populate("workSubmissions.submittedBy","name email role")
    .populate("dailyStatuses.submittedBy",  "name email role")
    .populate("dailyStatuses.commentedBy",  "name email role");

/* ════════════════════════════════════════════════════════════
   CREATE  (Admin only)
════════════════════════════════════════════════════════════ */
const createProject = async (req, res) => {
  try {
    const {
      name, description, clientName, deadline, priority,
      status, budget, managerId, teamMembers, createdAt, tags,
    } = req.body;

    if (!name?.trim())
      return res.status(400).json({ success: false, message: "Project name is required." });
    if (budget === undefined || budget === null || budget === "")
      return res.status(400).json({ success: false, message: "Budget is required." });

    const project = new Project({
      name:        name.trim(),
      description: description || "",
      clientName:  clientName  || "",
      deadline:    deadline    || "",
      priority:    priority    || "medium",
      status:      status      || "planning",
      budget:      Number(budget) || 0,
      managerId:   managerId   || null,
      teamMembers: Array.isArray(teamMembers) ? teamMembers : [],
      tags:        Array.isArray(tags)        ? tags        : [],
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
      name, description, clientName, deadline, priority,
      status, budget, spent, progress,
      managerId, teamMembers, createdAt, tags, milestones,
    } = req.body;

    if (!name?.trim())
      return res.status(400).json({ success: false, message: "Project name is required." });

    const project = new Project({
      name:        name.trim(),
      description: description || "",
      clientName:  clientName  || "",
      deadline:    deadline    || "",
      priority:    priority    || "medium",
      status:      status      || "completed",
      budget:      Number(budget)   || 0,
      spent:       Number(spent)    || 0,
      progress:    Number(progress) || 0,
      managerId:   managerId   || null,
      teamMembers: Array.isArray(teamMembers) ? teamMembers : [],
      tags:        Array.isArray(tags)        ? tags        : [],
      milestones:  Array.isArray(milestones)  ? milestones  : [],
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
    const projects = await populateProject(Project.find().sort({ createdAt: -1 }));
    res.status(200).json({ success: true, projects });
  } catch (err) {
    console.error("getAllProjects:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ════════════════════════════════════════════════════════════
   GET MY  (Employee sees only assigned projects; docs stripped)
════════════════════════════════════════════════════════════ */
const getMyProjects = async (req, res) => {
  try {
    const role = req.user.role;
    const uid  = req.user._id;

    if (role === "admin" || role === "manager" || role === "hr") {
      const projects = await populateProject(Project.find().sort({ createdAt: -1 }));
      return res.status(200).json({ success: true, projects });
    }

    const projects = await populateProject(
      Project.find({ $or: [{ managerId: uid }, { teamMembers: uid }] }).sort({ createdAt: -1 })
    );

    const sanitised = projects.map((p) => {
      const obj           = p.toObject();
      obj.documents       = [];   // employees cannot see documents
      obj.dailyStatuses   = obj.dailyStatuses.filter(
        (d) => d.submittedBy?._id?.toString() === uid.toString()
      );
      obj.workSubmissions = obj.workSubmissions.filter(
        (s) => s.submittedBy?._id?.toString() === uid.toString()
      );
      return obj;
    });

    res.status(200).json({ success: true, projects: sanitised });
  } catch (err) {
    console.error("getMyProjects:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ════════════════════════════════════════════════════════════
   GET BY ID
════════════════════════════════════════════════════════════ */
const getProjectById = async (req, res) => {
  try {
    const project = await populateProject(Project.findById(req.params.id));
    if (!project)
      return res.status(404).json({ success: false, message: "Project not found." });

    const uid  = req.user._id.toString();
    const role = req.user.role;

    if (role === "admin" || role === "manager" || role === "hr")
      return res.status(200).json({ success: true, project });

    const isMember = project.teamMembers.some((m) => m._id.toString() === uid);
    const isMgr    = project.managerId?._id?.toString() === uid;

    if (!isMember && !isMgr)
      return res.status(403).json({ success: false, message: "Access denied." });

    const obj           = project.toObject();
    obj.documents       = [];
    obj.dailyStatuses   = obj.dailyStatuses.filter(
      (d) => d.submittedBy?._id?.toString() === uid
    );
    obj.workSubmissions = obj.workSubmissions.filter(
      (s) => s.submittedBy?._id?.toString() === uid
    );

    res.status(200).json({ success: true, project: obj });
  } catch (err) {
    console.error("getProjectById:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ════════════════════════════════════════════════════════════
   UPDATE  (Admin — full | Manager — progress + spent + milestones)
════════════════════════════════════════════════════════════ */
const updateProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project)
      return res.status(404).json({ success: false, message: "Project not found." });

    const role = req.user.role;

    if (role === "manager") {
      const allowed = {};
      if (req.body.progress   !== undefined) allowed.progress   = Number(req.body.progress);
      if (req.body.spent      !== undefined) allowed.spent      = Number(req.body.spent);
      if (req.body.milestones !== undefined) allowed.milestones = req.body.milestones;
      if (!Object.keys(allowed).length)
        return res.status(403).json({ success: false, message: "Managers can only update progress, spent, and milestones." });
      Object.assign(project, allowed);
    } else {
      const fields = [
        "name","description","clientName","deadline","priority",
        "status","budget","spent","progress","managerId","teamMembers","tags","milestones",
      ];
      fields.forEach((k) => {
        if (req.body[k] !== undefined) {
          if      (k === "name")                            project[k] = req.body[k].trim();
          else if (["budget","spent","progress"].includes(k)) project[k] = Number(req.body[k]);
          else if (k === "managerId")                       project[k] = req.body[k] || null;
          else                                              project[k] = req.body[k];
        }
      });
    }

    await project.save();
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
   UPLOAD DOCUMENT  (Admin / Manager / HR only)
   ─────────────────────────────────────────────────────────
   Flow:
     1. Validate name, url, fileType
     2. Estimate decoded byte size from base64 — authoritative check
     3. Guard against total project storage exceeding 14 MB
     4. Push document subdoc and save
     5. Return populated project
   
   Documents are stored as base64 data-URLs in MongoDB Atlas.
   In Atlas UI: projects collection → documents[] → url field
   (Atlas truncates long strings in the UI, but the full data is there)
════════════════════════════════════════════════════════════ */
const uploadDocument = async (req, res) => {
  try {
    const { name, url, fileType, size, category } = req.body;

    /* ── Basic validation ── */
    if (!name?.trim())
      return res.status(400).json({ success: false, message: "Document name is required." });
    if (!url?.trim())
      return res.status(400).json({ success: false, message: "Document data (base64) is required." });
    if (fileType && !ALLOWED_FILE_TYPES.includes(fileType))
      return res.status(400).json({ success: false, message: `File type "${fileType}" is not allowed.` });

    /* ── Per-file size check (authoritative — based on actual base64 content) ── */
    const fileBytes = estimateBase64Bytes(url);
    if (fileBytes > MAX_DOC_SIZE)
      return res.status(400).json({
        success: false,
        message: `File too large: ~${(fileBytes / 1048576).toFixed(1)} MB. Maximum per file is 10 MB.`,
      });

    /* ── Load project ── */
    const project = await Project.findById(req.params.id);
    if (!project)
      return res.status(404).json({ success: false, message: "Project not found." });

    /* ── Total project storage guard (MongoDB 16 MB BSON limit) ── */
    const currentStorage = projectDocStorageBytes(project);
    if (currentStorage + fileBytes > MAX_PROJECT_STORAGE)
      return res.status(400).json({
        success: false,
        message: `Project storage limit reached. Currently using ~${(currentStorage / 1048576).toFixed(1)} MB of 14 MB. Remove older documents before uploading.`,
      });

    /* ── Store document ── */
    project.documents.push({
      name:       name.trim(),
      url:        url.trim(),           // full base64 data-URL → stored in MongoDB Atlas
      fileType:   fileType || "application/octet-stream",
      size:       fileBytes,            // actual decoded bytes (more accurate than client-reported)
      category:   category || "other",
      uploadedBy: req.user._id,
    });

    await project.save();

    const populated = await populateProject(Project.findById(project._id));
    res.status(200).json({ success: true, project: populated });
  } catch (err) {
    console.error("uploadDocument:", err.message);

    /* MongoDB BSON 16 MB limit hit despite our guard */
    if (
      err.message?.toLowerCase().includes("document too large") ||
      err.code === 10334
    ) {
      return res.status(400).json({
        success: false,
        message: "MongoDB document size limit exceeded (16 MB). Remove existing documents and try again.",
      });
    }

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
   SUBMIT DAILY STATUS
════════════════════════════════════════════════════════════ */
const submitDailyStatus = async (req, res) => {
  try {
    const { summary, hoursWorked, blockers, nextPlan, mood } = req.body;

    if (!summary?.trim())
      return res.status(400).json({ success: false, message: "Summary is required." });

    const project = await Project.findById(req.params.id);
    if (!project)
      return res.status(404).json({ success: false, message: "Project not found." });

    const uid  = req.user._id.toString();
    const role = req.user.role;

    if (role === "admin")
      return res.status(403).json({ success: false, message: "Admins do not submit daily status." });

    const isMember = project.teamMembers.some((m) => m.toString() === uid);
    const isMgr    = project.managerId?.toString() === uid;

    if (role === "employee" && !isMember)
      return res.status(403).json({ success: false, message: "You are not assigned to this project." });
    if (role === "manager" && !isMgr && !isMember)
      return res.status(403).json({ success: false, message: "You are not the manager of this project." });

    project.dailyStatuses.push({
      submittedBy: req.user._id,
      summary:     summary.trim(),
      hoursWorked: Math.max(0, Number(hoursWorked) || 0),
      blockers:    blockers || "",
      nextPlan:    nextPlan || "",
      mood:        mood     || "good",
    });

    await project.save();
    const populated = await populateProject(Project.findById(project._id));
    res.status(200).json({ success: true, project: populated });
  } catch (err) {
    console.error("submitDailyStatus:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ════════════════════════════════════════════════════════════
   COMMENT ON DAILY STATUS  (Admin / Manager)
════════════════════════════════════════════════════════════ */
const commentDailyStatus = async (req, res) => {
  try {
    const { comment } = req.body;
    if (!comment?.trim())
      return res.status(400).json({ success: false, message: "Comment is required." });

    const project = await Project.findById(req.params.id);
    if (!project)
      return res.status(404).json({ success: false, message: "Project not found." });

    const status = project.dailyStatuses.id(req.params.statusId);
    if (!status)
      return res.status(404).json({ success: false, message: "Daily status not found." });

    status.managerComment = comment.trim();
    status.commentedBy    = req.user._id;
    status.commentedAt    = new Date();

    await project.save();
    const populated = await populateProject(Project.findById(project._id));
    res.status(200).json({ success: true, project: populated });
  } catch (err) {
    console.error("commentDailyStatus:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ════════════════════════════════════════════════════════════
   DELETE DAILY STATUS  (Admin / Manager / own entry)
════════════════════════════════════════════════════════════ */
const deleteDailyStatus = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project)
      return res.status(404).json({ success: false, message: "Project not found." });

    const uid  = req.user._id.toString();
    const role = req.user.role;

    const entry = project.dailyStatuses.id(req.params.statusId);
    if (!entry)
      return res.status(404).json({ success: false, message: "Daily status not found." });

    const isOwner = entry.submittedBy?.toString() === uid;
    if (role !== "admin" && role !== "manager" && !isOwner)
      return res.status(403).json({ success: false, message: "Not authorised to delete this entry." });

    project.dailyStatuses = project.dailyStatuses.filter(
      (d) => d._id.toString() !== req.params.statusId
    );

    await project.save();
    const populated = await populateProject(Project.findById(project._id));
    res.status(200).json({ success: true, project: populated });
  } catch (err) {
    console.error("deleteDailyStatus:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ════════════════════════════════════════════════════════════
   SUBMIT WORK  (legacy)
════════════════════════════════════════════════════════════ */
const submitWork = async (req, res) => {
  try {
    const { description, hoursWorked } = req.body;
    if (!description?.trim())
      return res.status(400).json({ success: false, message: "Description is required." });

    const project = await Project.findById(req.params.id);
    if (!project)
      return res.status(404).json({ success: false, message: "Project not found." });

    const uid  = req.user._id.toString();
    const role = req.user.role;

    if (role === "admin")
      return res.status(403).json({ success: false, message: "Admins do not submit work." });

    const isMember = project.teamMembers.some((m) => m.toString() === uid);
    const isMgr    = project.managerId?.toString() === uid;

    if (role === "employee" && !isMember)
      return res.status(403).json({ success: false, message: "You are not assigned to this project." });
    if (role === "manager" && !isMgr && !isMember)
      return res.status(403).json({ success: false, message: "You are not the manager of this project." });

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
   DELETE WORK SUBMISSION  (Admin / Manager)
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
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find(
      { isActive: { $ne: false } },
      "name email role department designation"
    ).sort({ name: 1 });
    res.status(200).json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getManagers = async (req, res) => {
  try {
    const managers = await User.find(
      { role: { $in: ["manager", "admin"] }, isActive: { $ne: false } },
      "name email role"
    ).sort({ name: 1 });
    res.status(200).json({ success: true, users: managers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getMembers = async (req, res) => {
  try {
    const members = await User.find(
      { role: { $in: ["hr", "employee"] }, isActive: { $ne: false } },
      "name email role"
    ).sort({ name: 1 });
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
  getProjectById,
  updateProject,
  deleteProject,
  uploadDocument,
  deleteDocument,
  submitDailyStatus,
  commentDailyStatus,
  deleteDailyStatus,
  submitWork,
  deleteSubmission,
  getAllUsers,
  getManagers,
  getMembers,
};
