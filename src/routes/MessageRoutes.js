// routes/messageRoutes.js
const express = require("express");
const router = express.Router();
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

// Users list (to start a chat)
router.get("/users", getUsers);

// Conversations
router.get("/conversations", getMyConversations);
router.post("/conversations/direct", getOrCreateDirect);
router.post(
  "/conversations/group",
  authorize("admin", "manager"),
  createGroup
);

// Messages inside a conversation
router.get("/conversations/:conversationId/messages", getMessages);
router.post("/conversations/:conversationId/messages", sendMessage);
router.delete("/messages/:messageId", deleteMessage);

// Unread badge count
router.get("/unread-count", getUnreadCount);

module.exports = router;
