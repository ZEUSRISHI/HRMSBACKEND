const CalendarEvent = require("../models/CalendarEvent");

const createEvent = async (req, res) => {
  try {
    const event = await CalendarEvent.create({
      ...req.body,
      createdBy: req.user._id,
    });
    res.status(201).json({ success: true, event });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getEvents = async (req, res) => {
  try {
    const role = req.user.role;
    const events = await CalendarEvent.find({
      $or: [{ assignedTo: "all" }, { assignedTo: role }],
    }).sort({ date: 1 });
    res.status(200).json({ success: true, events });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getAllEvents = async (req, res) => {
  try {
    const events = await CalendarEvent.find().sort({ date: 1 });
    res.status(200).json({ success: true, events });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateEvent = async (req, res) => {
  try {
    const event = await CalendarEvent.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.status(200).json({ success: true, event });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteEvent = async (req, res) => {
  try {
    await CalendarEvent.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Event deleted." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  createEvent,
  getEvents,
  getAllEvents,
  updateEvent,
  deleteEvent,
};