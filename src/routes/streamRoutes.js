// routes/streamRoutes.js
const express = require("express");
const router  = express.Router();
const { getStreamToken, createGroupChannel } = require("../controllers/streamController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

router.get("/token",         getStreamToken);
router.post("/group-channel", authorize("admin", "manager"), createGroupChannel);

module.exports = router;