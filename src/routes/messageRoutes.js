const express = require("express");
const router  = express.Router();
const {
  getUsers,
  getOrCreateDirect,
  createGroup,
  getMyConversations,
  getMessages,
  sendMessage,
  deleteMessage,
  getUnreadCount,
} = require("../controllers/messageController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

// ── Users list ──────────────────────────────
router.get("/users", getUsers);

// ── Unread count ────────────────────────────
router.get("/unread-count", getUnreadCount);

// ── Conversations ───────────────────────────
// IMPORTANT: specific routes BEFORE param routes
router.get("/conversations",                        getMyConversations);
router.post("/conversations/direct",                getOrCreateDirect);
router.post("/conversations/group", authorize("admin", "manager"), createGroup);

// ── Messages ────────────────────────────────
router.get("/conversations/:conversationId/messages",  getMessages);
router.post("/conversations/:conversationId/messages", sendMessage);
router.delete("/messages/:messageId",                  deleteMessage);

module.exports = router;