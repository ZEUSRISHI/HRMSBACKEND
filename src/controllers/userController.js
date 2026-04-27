// controllers/userController.js
const User = require("../models/User");
const bcrypt = require("bcryptjs");

/* ============================================================
   GET ALL USERS  (Admin only)
   GET /api/users
   ============================================================ */
const getAllUsers = async (req, res) => {
  try {
    const { role, search, isActive, page = 1, limit = 50 } = req.query;

    const filter = {};
    if (role && role !== "all") filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === "true";
    if (search) {
      filter.$or = [
        { name:  { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { department: { $regex: search, $options: "i" } },
        { designation: { $regex: search, $options: "i" } },
      ];
    }

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .select("-password -refreshToken")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      users,
    });
  } catch (err) {
    console.error("getAllUsers error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   GET SINGLE USER  (Admin only)
   GET /api/users/:id
   ============================================================ */
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password -refreshToken");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    res.status(200).json({ success: true, user });
  } catch (err) {
    console.error("getUserById error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   CREATE USER  (Admin only)
   POST /api/users
   ============================================================ */
const createUser = async (req, res) => {
  try {
    const {
      name, email, password, role, phone, dob,
      department, designation, address, joiningDate,
      gender, emergencyContact, avatar,
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "name, email and password are required.",
      });
    }

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) {
      return res.status(409).json({
        success: false,
        message: "Email already registered.",
      });
    }

    const user = await User.create({
      name, email, password, role,
      phone, dob, department, designation,
      address, joiningDate, gender,
      emergencyContact, avatar,
    });

    const safe = user.toObject();
    delete safe.password;
    delete safe.refreshToken;

    res.status(201).json({
      success: true,
      message: "User created successfully.",
      user: safe,
    });
  } catch (err) {
    console.error("createUser error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   UPDATE USER  (Admin only)
   PUT /api/users/:id
   ============================================================ */
const updateUser = async (req, res) => {
  try {
    const allowed = [
      "name", "email", "role", "phone", "dob",
      "department", "designation", "address",
      "joiningDate", "gender", "emergencyContact",
      "avatar", "isActive",
    ];

    const updates = {};
    allowed.forEach((key) => {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    });

    // Handle password change separately
    if (req.body.password && req.body.password.trim().length >= 6) {
      updates.password = await bcrypt.hash(req.body.password.trim(), 12);
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).select("-password -refreshToken");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    res.status(200).json({
      success: true,
      message: "User updated successfully.",
      user,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: "Email already in use." });
    }
    console.error("updateUser error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   TOGGLE USER STATUS  (Admin only)
   PATCH /api/users/:id/toggle-status
   ============================================================ */
const toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password -refreshToken");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    // Prevent admin from deactivating themselves
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot deactivate your own account.",
      });
    }

    user.isActive = !user.isActive;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: `User ${user.isActive ? "activated" : "deactivated"} successfully.`,
      user,
    });
  } catch (err) {
    console.error("toggleUserStatus error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   DELETE USER  (Admin only)
   DELETE /api/users/:id
   ============================================================ */
const deleteUser = async (req, res) => {
  try {
    // Prevent admin from deleting themselves
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account.",
      });
    }

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    res.status(200).json({
      success: true,
      message: `User "${user.name}" deleted successfully.`,
    });
  } catch (err) {
    console.error("deleteUser error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   GET STATS  (Admin only)
   GET /api/users/stats
   ============================================================ */
const getUserStats = async (req, res) => {
  try {
    const [total, byRole, active] = await Promise.all([
      User.countDocuments(),
      User.aggregate([
        { $group: { _id: "$role", count: { $sum: 1 } } },
      ]),
      User.countDocuments({ isActive: true }),
    ]);

    const roleMap = {};
    byRole.forEach((r) => { roleMap[r._id] = r.count; });

    res.status(200).json({
      success: true,
      stats: {
        total,
        active,
        inactive: total - active,
        byRole: {
          admin:    roleMap.admin    || 0,
          manager:  roleMap.manager  || 0,
          hr:       roleMap.hr       || 0,
          employee: roleMap.employee || 0,
        },
      },
    });
  } catch (err) {
    console.error("getUserStats error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ============================================================
   RESET PASSWORD  (Admin only)
   PATCH /api/users/:id/reset-password
   ============================================================ */
const adminResetPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters.",
      });
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    const user   = await User.findByIdAndUpdate(
      req.params.id,
      { password: hashed },
      { new: true }
    ).select("-password -refreshToken");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    res.status(200).json({
      success: true,
      message: "Password reset successfully.",
      user,
    });
  } catch (err) {
    console.error("adminResetPassword error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  toggleUserStatus,
  deleteUser,
  getUserStats,
  adminResetPassword,
};
