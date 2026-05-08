// controllers/messageController.js
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const User = require("../models/User");

/* ────────────────────────────────────────────
   GET ALL USERS  (to start a new conversation)
──────────────────────────────────────────── */
const getUsers = async (req, res) => {
  try {
    const users = await User.find(
      { _id: { $ne: req.user._id } },
      "name email role avatar department"
    ).sort({ name: 1 });

    res.status(200).json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ────────────────────────────────────────────
   CREATE OR GET DIRECT CONVERSATION
──────────────────────────────────────────── */
const getOrCreateDirect = async (req, res) => {
  try {
    const { targetUserId } = req.body;

    if (!targetUserId) {
      return res
        .status(400)
        .json({ success: false, message: "targetUserId is required." });
    }

    if (targetUserId === req.user._id.toString()) {
      return res
        .status(400)
        .json({ success: false, message: "Cannot message yourself." });
    }

    // Check if direct conversation already exists between these two
    let conversation = await Conversation.findOne({
      type: "direct",
      participants: { $all: [req.user._id, targetUserId], $size: 2 },
    })
      .populate("participants", "name email role avatar")
      .populate({
        path: "lastMessage",
        populate: { path: "senderId", select: "name" },
      });

    if (!conversation) {
      conversation = await Conversation.create({
        type: "direct",
        participants: [req.user._id, targetUserId],
        createdBy: req.user._id,
      });

      conversation = await Conversation.findById(conversation._id)
        .populate("participants", "name email role avatar")
        .populate({
          path: "lastMessage",
          populate: { path: "senderId", select: "name" },
        });
    }

    res.status(200).json({ success: true, conversation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ────────────────────────────────────────────
   CREATE GROUP CONVERSATION  (admin/manager)
──────────────────────────────────────────── */
const createGroup = async (req, res) => {
  try {
    const { name, participantIds } = req.body;

    if (!name || !name.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Group name is required." });
    }

    if (!participantIds || participantIds.length < 2) {
      return res.status(400).json({
        success: false,
        message: "At least 2 participants required.",
      });
    }

    // Always include the creator
    const allParticipants = [
      ...new Set([req.user._id.toString(), ...participantIds]),
    ];

    const conversation = await Conversation.create({
      type: "group",
      name: name.trim(),
      participants: allParticipants,
      createdBy: req.user._id,
    });

    const populated = await Conversation.findById(conversation._id).populate(
      "participants",
      "name email role avatar"
    );

    res.status(201).json({ success: true, conversation: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ────────────────────────────────────────────
   GET MY CONVERSATIONS
──────────────────────────────────────────── */
const getMyConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id,
    })
      .populate("participants", "name email role avatar")
      .populate({
        path: "lastMessage",
        populate: { path: "senderId", select: "name" },
      })
      .sort({ lastMessageAt: -1 });

    res.status(200).json({ success: true, conversations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ────────────────────────────────────────────
   GET MESSAGES IN A CONVERSATION
──────────────────────────────────────────── */
const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = 40;
    const skip = (page - 1) * limit;

    // Verify user is a participant
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: req.user._id,
    });

    if (!conversation) {
      return res.status(403).json({
        success: false,
        message: "Access denied or conversation not found.",
      });
    }

    const messages = await Message.find({
      conversationId,
      isDeleted: false,
    })
      .populate("senderId", "name avatar role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Mark messages as read
    const unreadIds = messages
      .filter(
        (m) => !m.readBy.some((r) => r.userId.toString() === req.user._id.toString())
      )
      .map((m) => m._id);

    if (unreadIds.length > 0) {
      await Message.updateMany(
        { _id: { $in: unreadIds } },
        { $push: { readBy: { userId: req.user._id, readAt: new Date() } } }
      );
    }

    // Return in ascending order for display
    res.status(200).json({
      success: true,
      messages: messages.reverse(),
      hasMore: messages.length === limit,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ────────────────────────────────────────────
   SEND MESSAGE
──────────────────────────────────────────── */
const sendMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { content, type = "text" } = req.body;

    if (!content || !content.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Message content is required." });
    }

    // Verify user is a participant
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: req.user._id,
    });

    if (!conversation) {
      return res.status(403).json({
        success: false,
        message: "Access denied or conversation not found.",
      });
    }

    const message = await Message.create({
      conversationId,
      senderId: req.user._id,
      content: content.trim(),
      type,
      readBy: [{ userId: req.user._id, readAt: new Date() }],
    });

    // Update conversation's lastMessage
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: message._id,
      lastMessageAt: new Date(),
    });

    const populated = await Message.findById(message._id).populate(
      "senderId",
      "name avatar role"
    );

    res.status(201).json({ success: true, message: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ────────────────────────────────────────────
   DELETE MESSAGE  (soft delete, own message only)
──────────────────────────────────────────── */
const deleteMessage = async (req, res) => {
  try {
    const message = await Message.findOne({
      _id: req.params.messageId,
      senderId: req.user._id,
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found or not yours.",
      });
    }

    message.isDeleted = true;
    await message.save();

    res.status(200).json({ success: true, message: "Message deleted." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ────────────────────────────────────────────
   GET UNREAD COUNT  (badge counter)
──────────────────────────────────────────── */
const getUnreadCount = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id,
    }).select("_id");

    const conversationIds = conversations.map((c) => c._id);

    const unreadCount = await Message.countDocuments({
      conversationId: { $in: conversationIds },
      senderId: { $ne: req.user._id },
      isDeleted: false,
      "readBy.userId": { $ne: req.user._id },
    });

    res.status(200).json({ success: true, unreadCount });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getUsers,
  getOrCreateDirect,
  createGroup,
  getMyConversations,
  getMessages,
  sendMessage,
  deleteMessage,
  getUnreadCount,
};
