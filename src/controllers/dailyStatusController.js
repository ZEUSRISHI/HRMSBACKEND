const DailyStatus = require("../models/DailyStatus");

const submitStatus = async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    const existing = await DailyStatus.findOne({
      userId: req.user._id,
      date: today,
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Status already submitted for today.",
      });
    }

    const status = await DailyStatus.create({
      userId: req.user._id,
      date: today,
      ...req.body,
    });

    res.status(201).json({ success: true, status });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getMyStatuses = async (req, res) => {
  try {
    const statuses = await DailyStatus.find({ userId: req.user._id }).sort({
      date: -1,
    });
    res.status(200).json({ success: true, statuses });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getAllStatuses = async (req, res) => {
  try {
    const statuses = await DailyStatus.find()
      .populate("userId", "name email role")
      .sort({ date: -1 });
    res.status(200).json({ success: true, statuses });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const addComment = async (req, res) => {
  try {
    const status = await DailyStatus.findById(req.params.id);
    if (!status)
      return res
        .status(404)
        .json({ success: false, message: "Status not found." });

    status.managerComments.push({
      managerId: req.user._id,
      comment: req.body.comment,
      timestamp: new Date(),
    });

    await status.save();
    res.status(200).json({ success: true, status });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  submitStatus,
  getMyStatuses,
  getAllStatuses,
  addComment,
};