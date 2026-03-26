const Freelancer = require("../models/Freelancer");

const createFreelancer = async (req, res) => {
  try {
    const freelancer = await Freelancer.create({
      ...req.body,
      createdBy: req.user._id,
    });
    res.status(201).json({ success: true, freelancer });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getAllFreelancers = async (req, res) => {
  try {
    const freelancers = await Freelancer.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, freelancers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateFreelancer = async (req, res) => {
  try {
    const freelancer = await Freelancer.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.status(200).json({ success: true, freelancer });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteFreelancer = async (req, res) => {
  try {
    await Freelancer.findByIdAndDelete(req.params.id);
    res
      .status(200)
      .json({ success: true, message: "Freelancer deleted." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  createFreelancer,
  getAllFreelancers,
  updateFreelancer,
  deleteFreelancer,
};