const Conversation = require("../models/Conversation");
const Message      = require("../models/Message");
const User         = require("../models/User");

/* ─── helper: normalize user id safely ─── */
const uid = (req) => req.user._id || req.user.id;

/* ════════════════════════════════════════════
   GET ALL USERS  (for starting a new chat)
   GET /api/messages/users
════════════════════════════════════════════ */
const getUsers = async (req, res) => {
  try {
    const myId = uid(req);

    const users = await User.find(
      {
        _id:      { $ne: myId },
        isActive: { $ne: false },   // exclude deactivated accounts
      },
      "name email role avatar department designation"
    ).sort({ name: 1 });

    console.log(`✅ getUsers: found ${users.length} users for ${myId}`);

    res.status(200).json({ success: true, users });
  } catch (err) {
    console.error("❌ getUsers error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ════════════════════════════════════════════
   CREATE OR GET DIRECT CONVERSATION
   POST /api/messages/conversations/direct
════════════════════════════════════════════ */
const getOrCreateDirect = async (req, res) => {
  try {
    const myId         = uid(req);
    const { targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: "targetUserId is required.",
      });
    }

    if (targetUserId.toString() === myId.toString()) {
      return res.status(400).json({
        success: false,
        message: "Cannot message yourself.",
      });
    }

    // Verify the target user exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "Target user not found.",
      });
    }

    // Look for existing direct conversation between these two users
    let conversation = await Conversation.findOne({
      type:         "direct",
      participants: { $all: [myId, targetUserId], $size: 2 },
    })
      .populate("participants", "name email role avatar department")
      .populate({
        path:     "lastMessage",
        populate: { path: "senderId", select: "name" },
      });

    // Create if not found
    if (!conversation) {
      const created = await Conversation.create({
        type:         "direct",
        participants: [myId, targetUserId],
        createdBy:    myId,
      });

      conversation = await Conversation.findById(created._id)
        .populate("participants", "name email role avatar department")
        .populate({
          path:     "lastMessage",
          populate: { path: "senderId", select: "name" },
        });
    }

    console.log(`✅ getOrCreateDirect: conv ${conversation._id}`);
    res.status(200).json({ success: true, conversation });
  } catch (err) {
    console.error("❌ getOrCreateDirect error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ════════════════════════════════════════════
   CREATE GROUP CONVERSATION
   POST /api/messages/conversations/group
════════════════════════════════════════════ */
const createGroup = async (req, res) => {
  try {
    const myId                = uid(req);
    const { name, participantIds } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Group name is required.",
      });
    }

    if (!participantIds || !Array.isArray(participantIds) || participantIds.length < 2) {
      return res.status(400).json({
        success: false,
        message: "At least 2 participants are required.",
      });
    }

    // Always include the creator in participants
    const allParticipants = [
      ...new Set([myId.toString(), ...participantIds.map(String)]),
    ];

    const created = await Conversation.create({
      type:         "group",
      name:         name.trim(),
      participants: allParticipants,
      createdBy:    myId,
    });

    const conversation = await Conversation.findById(created._id)
      .populate("participants", "name email role avatar department");

    console.log(`✅ createGroup: "${name}" with ${allParticipants.length} members`);
    res.status(201).json({ success: true, conversation });
  } catch (err) {
    console.error("❌ createGroup error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ════════════════════════════════════════════
   GET MY CONVERSATIONS
   GET /api/messages/conversations
════════════════════════════════════════════ */
const getMyConversations = async (req, res) => {
  try {
    const myId = uid(req);

    const conversations = await Conversation.find({
      participants: myId,
    })
      .populate("participants", "name email role avatar department")
      .populate({
        path:     "lastMessage",
        populate: { path: "senderId", select: "name" },
      })
      .sort({ lastMessageAt: -1 });

    console.log(`✅ getMyConversations: ${conversations.length} convs for ${myId}`);
    res.status(200).json({ success: true, conversations });
  } catch (err) {
    console.error("❌ getMyConversations error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ════════════════════════════════════════════
   GET MESSAGES IN A CONVERSATION
   GET /api/messages/conversations/:conversationId/messages
════════════════════════════════════════════ */
const getMessages = async (req, res) => {
  try {
    const myId           = uid(req);
    const { conversationId } = req.params;
    const page           = Math.max(1, parseInt(req.query.page) || 1);
    const limit          = 40;
    const skip           = (page - 1) * limit;

    // Verify user is a participant
    const conversation = await Conversation.findOne({
      _id:          conversationId,
      participants: myId,
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

    // Mark unread messages as read
    const unreadIds = messages
      .filter(
        (m) =>
          m.senderId?._id?.toString() !== myId.toString() &&
          !m.readBy.some((r) => r.userId?.toString() === myId.toString())
      )
      .map((m) => m._id);

    if (unreadIds.length > 0) {
      await Message.updateMany(
        { _id: { $in: unreadIds } },
        {
          $push: {
            readBy: { userId: myId, readAt: new Date() },
          },
        }
      );
    }

    // Return in ascending order (oldest first)
    res.status(200).json({
      success:  true,
      messages: messages.reverse(),
      hasMore:  messages.length === limit,
      page,
    });
  } catch (err) {
    console.error("❌ getMessages error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ════════════════════════════════════════════
   SEND MESSAGE
   POST /api/messages/conversations/:conversationId/messages
════════════════════════════════════════════ */
const sendMessage = async (req, res) => {
  try {
    const myId               = uid(req);
    const { conversationId } = req.params;
    const { content, type = "text" } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: "Message content is required.",
      });
    }

    // Verify user is a participant
    const conversation = await Conversation.findOne({
      _id:          conversationId,
      participants: myId,
    });

    if (!conversation) {
      return res.status(403).json({
        success: false,
        message: "Access denied or conversation not found.",
      });
    }

    const message = await Message.create({
      conversationId,
      senderId: myId,
      content:  content.trim(),
      type,
      readBy:   [{ userId: myId, readAt: new Date() }],
    });

    // Update conversation's lastMessage pointer
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage:   message._id,
      lastMessageAt: new Date(),
    });

    const populated = await Message.findById(message._id)
      .populate("senderId", "name avatar role");

    res.status(201).json({ success: true, message: populated });
  } catch (err) {
    console.error("❌ sendMessage error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ════════════════════════════════════════════
   DELETE MESSAGE  (soft delete, own only)
   DELETE /api/messages/messages/:messageId
════════════════════════════════════════════ */
const deleteMessage = async (req, res) => {
  try {
    const myId = uid(req);

    const message = await Message.findOne({
      _id:      req.params.messageId,
      senderId: myId,
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found or you are not the sender.",
      });
    }

    message.isDeleted = true;
    await message.save();

    res.status(200).json({ success: true, message: "Message deleted." });
  } catch (err) {
    console.error("❌ deleteMessage error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ════════════════════════════════════════════
   GET UNREAD COUNT  (for badge)
   GET /api/messages/unread-count
════════════════════════════════════════════ */
const getUnreadCount = async (req, res) => {
  try {
    const myId = uid(req);

    const conversations = await Conversation.find({
      participants: myId,
    }).select("_id");

    const conversationIds = conversations.map((c) => c._id);

    const unreadCount = await Message.countDocuments({
      conversationId:  { $in: conversationIds },
      senderId:        { $ne: myId },
      isDeleted:       false,
      "readBy.userId": { $ne: myId },
    });

    res.status(200).json({ success: true, unreadCount });
  } catch (err) {
    console.error("❌ getUnreadCount error:", err.message);
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
