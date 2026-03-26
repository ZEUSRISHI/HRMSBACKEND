const User = require("../models/User");

// @desc    Get dashboard summary stats
// @route   GET /api/dashboard/stats
// @access  Private
exports.getDashboardStats = async (req, res) => {
  try {
    const { role } = req.user;

    const totalEmployees = await User.countDocuments({ isActive: true });

    const employeesByRole = await User.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$role", count: { $sum: 1 } } },
    ]);

    const stats = {
      totalEmployees,
      employeesByRole: employeesByRole.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
    };

    if (["admin", "hr", "manager"].includes(role)) {
      const recentUsers = await User.find({ isActive: true })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("name email role createdAt");

      stats.recentUsers = recentUsers;
    }

    const currentUser = await User.findById(req.user._id);
    stats.currentUser = currentUser.toSafeObject();

    res.status(200).json({ success: true, stats });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// @desc    Get all users (admin/hr)
// @route   GET /api/dashboard/users
// @access  Private — admin, hr
exports.getAllUsers = async (req, res) => {
  try {
    const { role, search, page = 1, limit = 20 } = req.query;

    const query = { isActive: true };

    if (role) query.role = role;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [users, total] = await Promise.all([
      User.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      User.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      users: users.map((u) => u.toSafeObject()),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// @desc    Admin update any user
// @route   PUT /api/dashboard/users/:id
// @access  Private — admin only
exports.adminUpdateUser = async (req, res) => {
  try {
    const { role, isActive, name, department, phone } = req.body;

    const allowedUpdates = {};
    if (role) allowedUpdates.role = role;
    if (typeof isActive === "boolean") allowedUpdates.isActive = isActive;
    if (name) allowedUpdates.name = name;
    if (department) allowedUpdates.department = department;
    if (phone) allowedUpdates.phone = phone;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: allowedUpdates },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    res.status(200).json({
      success: true,
      message: "User updated.",
      user: user.toSafeObject(),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// @desc    Admin deactivate a user
// @route   DELETE /api/dashboard/users/:id
// @access  Private — admin only
exports.adminDeleteUser = async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: "Cannot delete your own account here." });
    }

    await User.findByIdAndUpdate(req.params.id, { isActive: false });

    res.status(200).json({ success: true, message: "User deactivated." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};