const User = require("../models/User");

// @desc    Get profile of logged-in user
// @route   GET /api/profile
// @access  Private
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    res.status(200).json({ success: true, user: user.toSafeObject() });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// @desc    Update profile of logged-in user
// @route   PUT /api/profile
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    const allowedFields = [
      "name", "phone", "countryCode", "department", "avatar",
      "preferredName", "dob", "gender", "bloodGroup", "maritalStatus",
      "nationality", "languagesKnown", "address", "designation",
      "employeeCode", "employmentType", "workMode", "reportingManager",
      "workLocation", "joiningDate",
      "emergencyContact", "emergencyCountryCode",
      "bankName", "accountNumber", "ifscCode", "accountType",
      "panNumber", "uanNumber", "pfNumber", "taxRegime",
    ];
    const updates = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      user: user.toSafeObject(),
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// @desc    Deactivate own account
// @route   DELETE /api/profile
// @access  Private
exports.deleteAccount = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { isActive: false });
    res.status(200).json({ success: true, message: "Account deactivated." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// @desc    Upload a document to the Document Center
// @route   POST /api/profile/documents
// @access  Private
exports.uploadDocument = async (req, res) => {
  try {
    const { name, category, fileData, fileType } = req.body;

    if (!name || !category || !fileData) {
      return res.status(400).json({
        success: false,
        message: "name, category and fileData are required.",
      });
    }
    if (!["employee", "identity", "tax"].includes(category)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category. Must be employee, identity, or tax.",
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    user.documents.push({ name, category, fileData, fileType: fileType || "" });
    await user.save();

    res.status(201).json({
      success: true,
      message: "Document uploaded successfully.",
      documents: user.toSafeObject().documents,
    });
  } catch (error) {
    console.error("Upload document error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// @desc    Delete a document from the Document Center
// @route   DELETE /api/profile/documents/:docId
// @access  Private
exports.deleteDocument = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const before = user.documents.length;
    user.documents = user.documents.filter(
      (d) => d._id.toString() !== req.params.docId
    );

    if (user.documents.length === before) {
      return res.status(404).json({ success: false, message: "Document not found." });
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "Document deleted successfully.",
      documents: user.toSafeObject().documents,
    });
  } catch (error) {
    console.error("Delete document error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};
