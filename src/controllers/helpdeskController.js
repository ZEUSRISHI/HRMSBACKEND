const Helpdesk = require("../models/Helpdesk");

/* ─────────────────────────────────────────
   CREATE TICKET  (employee / manager / hr)
───────────────────────────────────────── */
const createTicket = async (req, res) => {
  try {
    const { title, description, category, priority } = req.body;

    if (!title || !description || !category) {
      return res.status(400).json({
        success: false,
        message: "Title, description and category are required.",
      });
    }

    const ticket = await Helpdesk.create({
      title,
      description,
      category,
      priority: priority || "medium",
      raisedBy: req.user._id,
    });

    await ticket.populate("raisedBy", "name email role");

    res.status(201).json({ success: true, ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ─────────────────────────────────────────
   GET MY TICKETS  (employee / manager / hr)
───────────────────────────────────────── */
const getMyTickets = async (req, res) => {
  try {
    const tickets = await Helpdesk.find({ raisedBy: req.user._id })
      .populate("raisedBy", "name email role")
      .populate("assignedTo", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, tickets });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ─────────────────────────────────────────
   GET ALL TICKETS  (admin only)
───────────────────────────────────────── */
const getAllTickets = async (req, res) => {
  try {
    const filter = {};

    if (req.query.status)   filter.status   = req.query.status;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.priority) filter.priority = req.query.priority;

    const tickets = await Helpdesk.find(filter)
      .populate("raisedBy",  "name email role")
      .populate("assignedTo", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, tickets });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ─────────────────────────────────────────
   GET SINGLE TICKET
───────────────────────────────────────── */
const getTicketById = async (req, res) => {
  try {
    const ticket = await Helpdesk.findById(req.params.id)
      .populate("raisedBy",  "name email role")
      .populate("assignedTo", "name email")
      .populate("comments.author", "name email role");

    if (!ticket) {
      return res.status(404).json({ success: false, message: "Ticket not found." });
    }

    /* Non-admin can only view their own ticket */
    if (
      req.user.role !== "admin" &&
      ticket.raisedBy._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    res.status(200).json({ success: true, ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ─────────────────────────────────────────
   UPDATE TICKET STATUS / ASSIGN  (admin)
───────────────────────────────────────── */
const updateTicket = async (req, res) => {
  try {
    const { status, priority, assignedTo, resolutionNote } = req.body;

    const ticket = await Helpdesk.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: "Ticket not found." });
    }

    if (status)         ticket.status         = status;
    if (priority)       ticket.priority       = priority;
    if (assignedTo)     ticket.assignedTo     = assignedTo;
    if (resolutionNote !== undefined) ticket.resolutionNote = resolutionNote;

    if (status === "resolved" && !ticket.resolvedAt) {
      ticket.resolvedAt = new Date();
    }

    if (status === "open" || status === "in_progress") {
      ticket.resolvedAt = null;
    }

    await ticket.save();
    await ticket.populate("raisedBy",  "name email role");
    await ticket.populate("assignedTo", "name email");

    res.status(200).json({ success: true, ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ─────────────────────────────────────────
   UPDATE OWN TICKET (raiser only, if open)
───────────────────────────────────────── */
const editMyTicket = async (req, res) => {
  try {
    const ticket = await Helpdesk.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ success: false, message: "Ticket not found." });
    }

    if (ticket.raisedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not your ticket." });
    }

    if (ticket.status !== "open") {
      return res.status(400).json({
        success: false,
        message: "Only open tickets can be edited.",
      });
    }

    const { title, description, category, priority } = req.body;

    if (title)       ticket.title       = title;
    if (description) ticket.description = description;
    if (category)    ticket.category    = category;
    if (priority)    ticket.priority    = priority;

    await ticket.save();
    await ticket.populate("raisedBy", "name email role");

    res.status(200).json({ success: true, ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ─────────────────────────────────────────
   DELETE TICKET  (admin or own open ticket)
───────────────────────────────────────── */
const deleteTicket = async (req, res) => {
  try {
    const ticket = await Helpdesk.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ success: false, message: "Ticket not found." });
    }

    const isAdmin = req.user.role === "admin";
    const isOwner = ticket.raisedBy.toString() === req.user._id.toString();

    if (!isAdmin && (!isOwner || ticket.status !== "open")) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own open tickets.",
      });
    }

    await Helpdesk.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Ticket deleted." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ─────────────────────────────────────────
   ADD COMMENT
───────────────────────────────────────── */
const addComment = async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ success: false, message: "Comment text required." });
    }

    const ticket = await Helpdesk.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ success: false, message: "Ticket not found." });
    }

    /* Only admin or the raiser can comment */
    const isAdmin = req.user.role === "admin";
    const isOwner = ticket.raisedBy.toString() === req.user._id.toString();

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    ticket.comments.push({ author: req.user._id, text });
    await ticket.save();
    await ticket.populate("comments.author", "name email role");

    res.status(200).json({ success: true, comments: ticket.comments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ─────────────────────────────────────────
   DELETE COMMENT  (admin or comment author)
───────────────────────────────────────── */
const deleteComment = async (req, res) => {
  try {
    const ticket = await Helpdesk.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ success: false, message: "Ticket not found." });
    }

    const comment = ticket.comments.id(req.params.commentId);
    if (!comment) {
      return res.status(404).json({ success: false, message: "Comment not found." });
    }

    const isAdmin  = req.user.role === "admin";
    const isAuthor = comment.author.toString() === req.user._id.toString();

    if (!isAdmin && !isAuthor) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    comment.deleteOne();
    await ticket.save();

    res.status(200).json({ success: true, message: "Comment deleted." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ─────────────────────────────────────────
   STATS  (admin only)
───────────────────────────────────────── */
const getStats = async (req, res) => {
  try {
    const [total, open, inProgress, resolved, closed, critical] =
      await Promise.all([
        Helpdesk.countDocuments(),
        Helpdesk.countDocuments({ status: "open" }),
        Helpdesk.countDocuments({ status: "in_progress" }),
        Helpdesk.countDocuments({ status: "resolved" }),
        Helpdesk.countDocuments({ status: "closed" }),
        Helpdesk.countDocuments({ priority: "critical" }),
      ]);

    /* Category breakdown */
    const byCategory = await Helpdesk.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.status(200).json({
      success: true,
      stats: { total, open, inProgress, resolved, closed, critical, byCategory },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  createTicket,
  getMyTickets,
  getAllTickets,
  getTicketById,
  updateTicket,
  editMyTicket,
  deleteTicket,
  addComment,
  deleteComment,
  getStats,
};
