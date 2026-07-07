const User = require("../models/User");
const { OAuth2Client } = require("google-auth-library");
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} = require("../utils/jwt");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/* ============================================================
   HELPER — send token response
   ============================================================ */
const sendTokenResponse = (user, statusCode, res, message = "Success") => {
  const accessToken  = generateAccessToken(user._id, user.role);
  const refreshToken = generateRefreshToken(user._id);

  user.refreshToken = refreshToken;
  user.save({ validateBeforeSave: false });

  res.status(statusCode).json({
    success: true,
    message,
    accessToken,
    refreshToken,
    user: user.toSafeObject(),
  });
};

// @desc    Sign up a new user
// @route   POST /api/auth/signup
// @access  Public
exports.signup = async (req, res) => {
  try {
    const name  = req.body.name?.trim();
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password?.trim();
    const { role } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    const user = await User.create({ name, email, password, role: role || "employee" });

    sendTokenResponse(user, 201, res, "Account created successfully.");
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ success: false, message: "Server error during signup." });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const email    = req.body.email?.trim().toLowerCase();
    const password = req.body.password?.trim();
    const { role } = req.body;

    // ✅ FIX: must explicitly select failedLoginAttempts & lockUntil —
    // both are select:false in the schema, so without this the
    // lockout logic below always operates on undefined values.
    const user = await User.findOne({ email }).select(
      "+password +failedLoginAttempts +lockUntil"
    );

    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }

    // Check if account is currently locked
    if (user.lockUntil && user.lockUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockUntil - new Date()) / 60000);
      return res.status(429).json({
        success: false,
        message: `Account locked due to too many failed attempts. Try again in ${minutesLeft} minute(s).`,
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;

      if (user.failedLoginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // lock 15 minutes
        user.failedLoginAttempts = 0;
        await user.save({ validateBeforeSave: false });
        return res.status(429).json({
          success: false,
          message: "Too many failed attempts. Account locked for 15 minutes.",
        });
      }

      await user.save({ validateBeforeSave: false });
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }

    if (user.role !== role) {
      return res.status(401).json({
        success: false,
        message: `This account is registered as '${user.role}', not '${role}'.`,
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account deactivated. Contact your administrator.",
      });
    }

    // Reset lockout counters on successful login
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    sendTokenResponse(user, 200, res, "Login successful.");
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, message: "Server error during login." });
  }
};

// @desc    Google OAuth login — verifies the Google ID token server-side
//          instead of trusting a client-supplied email string.
// @route   POST /api/auth/google-login
// @access  Public
exports.googleLogin = async (req, res) => {
  try {
    // ✅ CHANGED: frontend now sends the raw Google ID token (credential),
    // not a decoded email. See LoginPage.tsx update below.
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: "Google ID token is required.",
      });
    }

    // ✅ Verify the token against Google's servers. This confirms the
    // token was really issued by Google for OUR client ID and hasn't
    // been tampered with — closes the "trust whatever email is sent"
    // security gap from the previous implementation.
    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (verifyErr) {
      console.error("Google token verification failed:", verifyErr.message);
      return res.status(401).json({
        success: false,
        message: "Invalid or expired Google token.",
      });
    }

    if (!payload || !payload.email) {
      return res.status(401).json({
        success: false,
        message: "Google token did not contain a valid email.",
      });
    }

    if (!payload.email_verified) {
      return res.status(403).json({
        success: false,
        message: "Google account email is not verified.",
      });
    }

    const email = payload.email.toLowerCase();
    const user  = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found for this Google email. Please contact your admin.",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account deactivated. Contact your administrator.",
      });
    }

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    sendTokenResponse(user, 200, res, "Google login successful.");
  } catch (error) {
    console.error("Google login error:", error);
    res.status(500).json({ success: false, message: "Server error during Google login." });
  }
};

// @desc    Logout
// @route   POST /api/auth/logout
// @access  Private
exports.logout = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { refreshToken: null });
    res.status(200).json({ success: true, message: "Logged out successfully." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error during logout." });
  }
};

// @desc    Refresh access token
// @route   POST /api/auth/refresh-token
// @access  Public
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ success: false, message: "No refresh token provided." });
    }

    const decoded = verifyRefreshToken(refreshToken);
    const user    = await User.findById(decoded.id).select("+refreshToken");

    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({ success: false, message: "Invalid refresh token." });
    }

    sendTokenResponse(user, 200, res, "Token refreshed.");
  } catch (error) {
    res.status(401).json({ success: false, message: "Invalid or expired refresh token." });
  }
};

// @desc    Reset (forgot) password
// @route   POST /api/auth/reset-password
// @access  Public
exports.resetPassword = async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const newPassword = req.body.newPassword?.trim();

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found with this email.",
      });
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({ success: true, message: "Password reset successfully." });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// @desc    Change password (authenticated)
// @route   PUT /api/auth/change-password
// @access  Private
exports.changePassword = async (req, res) => {
  try {
    const oldPassword = req.body.oldPassword?.trim();
    const newPassword = req.body.newPassword?.trim();

    const user = await User.findById(req.user._id).select("+password");

    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect.",
      });
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({ success: true, message: "Password changed successfully." });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// @desc    Get current logged-in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.status(200).json({ success: true, user: user.toSafeObject() });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};
