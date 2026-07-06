// controllers/streamController.js
const { StreamChat } = require("stream-chat");

const serverClient = StreamChat.getInstance(
  process.env.STREAM_API_KEY,
  process.env.STREAM_API_SECRET
);

/* ────────────────────────────────────────
   UPSERT USER ON STREAM + RETURN TOKEN
   Called once when user opens Messaging tab
──────────────────────────────────────────*/
const getStreamToken = async (req, res) => {
  try {
    const { _id, name, email, role, avatar } = req.user;

    // Upsert user on Stream side so their profile stays in sync
    await serverClient.upsertUser({
      id: _id.toString(),
      name,
      email,
      role: "user", // Stream's own role — keep as "user" for everyone
      image: avatar || "",
      custom_role: role, // your app role stored as custom field
    });

    const token = serverClient.createToken(_id.toString());

    res.status(200).json({
      success: true,
      token,
      userId: _id.toString(),
      apiKey: process.env.STREAM_API_KEY,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ────────────────────────────────────────
   CREATE A GROUP CHANNEL  (admin/manager)
   Stream channels can also be created from
   the frontend, but doing it server-side
   lets you enforce role checks properly.
──────────────────────────────────────────*/
const createGroupChannel = async (req, res) => {
  try {
    const { name, memberIds } = req.body;
    const creatorId = req.user._id.toString();

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Group name required." });
    }

    if (!memberIds || memberIds.length < 2) {
      return res.status(400).json({
        success: false,
        message: "At least 2 members required.",
      });
    }

    // Always include creator
    const allMembers = [...new Set([creatorId, ...memberIds])];

    // Stream channel id must be lowercase/alphanumeric+dash
    const channelId = `group-${Date.now()}`;

    const channel = serverClient.channel("messaging", channelId, {
      name: name.trim(),
      members: allMembers,
      created_by_id: creatorId,
    });

    await channel.create();

    res.status(201).json({ success: true, channelId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getStreamToken, createGroupChannel };