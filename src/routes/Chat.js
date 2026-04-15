// routes/chat.js
const express = require("express");
const router = express.Router();
const { Chat, User,Message,sequelize } = require("../../db");
const { Op } = require("sequelize");
const authenticate = require("../middleware/auth/Authentication");

module.exports = (io) => {

router.post("/get-or-create", async (req, res) => {
  try {
    const { senderId, receiverId } = req.body;

    if (!senderId || !receiverId) {
      return res.status(400).json({ message: "senderId and receiverId required" });
    }

    // Generate consistent chatId for 1-to-1 chat
    const chatIdentifier = [senderId, receiverId].sort().join("_");

    // Check if chat already exists
    let chat = await Chat.findOne({
      where: { id: chatIdentifier },
      include: [{ model: User, as: "participants" }],
    });

    // If not, create it
    if (!chat) {
      chat = await Chat.create({
        id: chatIdentifier,
        senderId: senderId,               // first sender
        receiverId: receiverId,           // first receiver
        requestSenderId: senderId,        // ✅ first sender
        requestStatus: "pending",         // request initially pending
        isMsgReqAccepted: false,          // request not accepted yet
        lastMessage: "",                  // optional
      });

      // Add participants to the chat
      await chat.addParticipants([senderId, receiverId]);
    }

    res.json({ chatId: chat.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching/creating chat", error: err.message });
  }
});

router.get("/messages/:chatId", authenticate, async (req, res) => {
  const { chatId } = req.params;

  try {
    // Fetch chat info (without requestSenderId)
    const chat = await Chat.findByPk(chatId, {
      attributes: ["requestStatus", "isAccepted"]
    });

    if (!chat) {
      return res.status(404).json({
        message_type: "error",
        status_code: 404,
        message: "Chat not found",
      });
    }

    // Fetch all messages
    const messages = await Message.findAll({
      where: { chatId },
      include: [
        { model: User, as: "sender", attributes: ["id", "fullName"] },
        { model: User, as: "receiver", attributes: ["id", "fullName"] },
      ],
      attributes: ["id", "text", "time", "status"], 
      order: [["time", "ASC"]],
    });

    // Determine who sent the first message
    const firstMessageSenderId = messages.length > 0 ? messages[0].senderId : null;

    res.json({
      message_type: "success",
      status_code: 200,
      message: "Messages fetched successfully",
      chat: {
        requestStatus: chat.requestStatus,
        isAccepted: chat.isAccepted,
        firstMessageSenderId, // 👈 new key
      },
      messages,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message_type: "error",
      status_code: 500,
      message: "Error fetching messages",
      error: err.message,
    });
  }
});

router.post("/accept-request", authenticate, async (req, res) => {
  try {
    const { chatId } = req.body;
    const userId = req.user.id; // logged in user

    const chat = await Chat.findByPk(chatId);

    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    // Only receiver can accept
    if (chat.requestSenderId === userId) {
      return res.status(403).json({
        message: "Sender cannot accept request",
      });
    }

    await chat.update({
      requestStatus: "accepted",
      isMsgReqAccepted: true,
    });

    return res.json({
      message: "Chat request accepted",
      chatId,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error accepting request",
      error: error.message,
    });
  }
});

router.post("/decline-request", authenticate, async (req, res) => {
  try {
    const { chatId } = req.body;
    const userId = req.user.id;

    const chat = await Chat.findByPk(chatId);

    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    if (chat.requestSenderId === userId) {
      return res.status(403).json({
        message: "Sender cannot decline request",
      });
    }

    await chat.update({
      requestStatus: "declined",
      isMsgReqAccepted: false,
    });

    return res.json({
      message: "Chat request declined",
      chatId,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error declining request",
      error: error.message,
    });
  }
});

router.post("/block-user", authenticate, async (req, res) => {
  try {
    const { chatId } = req.body;
    const userId = req.user.id;

    const chat = await Chat.findByPk(chatId);

    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    await chat.update({
      requestStatus: "blocked",
      isMsgReqAccepted: false,
    });

    return res.json({
      message: "User blocked successfully",
      chatId,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error blocking user",
      error: error.message,
    });
  }
});

router.post("/unblock-user", authenticate, async (req, res) => {
  try {
    const { chatId } = req.body;
    const userId = req.user.id;

    const chat = await Chat.findByPk(chatId);

    if (!chat) {
      return res.status(404).json({
        message: "Chat not found",
      });
    }

    // check chat is actually blocked
    if (chat.requestStatus !== "blocked") {
      return res.status(400).json({
        message: "Chat is not blocked",
      });
    }

    // Only receiver (non-request sender) can unblock
    if (chat.requestSenderId === userId) {
      return res.status(403).json({
        message: "Sender cannot unblock",
      });
    }

    await chat.update({
      requestStatus: "accepted",   // or "pending" (your choice)
      isMsgReqAccepted: true,
    });

    return res.json({
      message: "User unblocked successfully",
      chatId,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error unblocking user",
      error: error.message,
    });
  }
});

return router;
};

