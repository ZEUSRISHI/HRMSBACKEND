const Payroll = require("../models/Payroll");

const createPayroll = async (req, res) => {
  try {
    const { userId, month, basicSalary, allowances, deductions } = req.body;
    const netSalary =
      Number(basicSalary) + Number(allowances) - Number(deductions);

    const payroll = await Payroll.create({
      userId,
      month,
      basicSalary,
      allowances,
      deductions,
      netSalary,
    });
    res.status(201).json({ success: true, payroll });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getAllPayroll = async (req, res) => {
  try {
    const records = await Payroll.find()
      .populate("userId", "name email role")
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, records });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getMyPayroll = async (req, res) => {
  try {
    const records = await Payroll.find({ userId: req.user._id }).sort({
      createdAt: -1,
    });
    res.status(200).json({ success: true, records });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const processPayroll = async (req, res) => {
  try {
    await Payroll.updateMany(
      { status: "pending" },
      { status: "processed", paymentDate: new Date() }
    );
    res
      .status(200)
      .json({ success: true, message: "All pending payrolls processed." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updatePayroll = async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id);
    if (!payroll)
      return res
        .status(404)
        .json({ success: false, message: "Record not found." });

    const allowances =
      req.body.allowances !== undefined
        ? req.body.allowances
        : payroll.allowances;
    const deductions =
      req.body.deductions !== undefined
        ? req.body.deductions
        : payroll.deductions;
    const netSalary =
      payroll.basicSalary + Number(allowances) - Number(deductions);

    const updated = await Payroll.findByIdAndUpdate(
      req.params.id,
      { ...req.body, netSalary },
      { new: true }
    );
    res.status(200).json({ success: true, payroll: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const deletePayroll = async (req, res) => {
  try {
    await Payroll.findByIdAndDelete(req.params.id);
    res
      .status(200)
      .json({ success: true, message: "Payroll record deleted." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  createPayroll,
  getAllPayroll,
  getMyPayroll,
  processPayroll,
  updatePayroll,
  deletePayroll,
};