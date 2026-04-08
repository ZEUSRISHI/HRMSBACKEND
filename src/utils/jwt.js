const jwt = require("jsonwebtoken");

// ✅ Debug logs (temporary)
console.log("JWT_SECRET:", process.env.JWT_SECRET);
console.log("JWT_REFRESH_SECRET:", process.env.JWT_REFRESH_SECRET);

// ✅ Helper to ensure env exists
const requireEnv = (key) => {
  if (!process.env[key]) {
    throw new Error(`${key} is missing in environment variables`);
  }
  return process.env[key];
};

// ✅ Generate Access Token
const generateAccessToken = (userId, role) => {
  const secret = requireEnv("JWT_SECRET");

  return jwt.sign(
    { id: userId, role },
    secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
};

// ✅ Generate Refresh Token
const generateRefreshToken = (userId) => {
  const refreshSecret = requireEnv("JWT_REFRESH_SECRET");

  return jwt.sign(
    { id: userId },
    refreshSecret,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d" }
  );
};

// ✅ Verify Access Token
const verifyAccessToken = (token) => {
  const secret = requireEnv("JWT_SECRET");
  return jwt.verify(token, secret);
};

// ✅ Verify Refresh Token
const verifyRefreshToken = (token) => {
  const refreshSecret = requireEnv("JWT_REFRESH_SECRET");
  return jwt.verify(token, refreshSecret);
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
