const { Server } = require("socket.io");
const { Chat, Message, Group, GroupMessage } = require("../../db");
const { Op } = require("sequelize");

function setupSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  const onlineUsers = new Map(); // socketId -> userId
  const lastEmittedMessages = new Map();

  io.on("connection", (socket) => {
    console.log("⚡ Socket connected:", socket.id);

    // =============================
    // 1️⃣ Track online users
    // =============================
    socket.on("join", (userId) => {
      onlineUsers.set(socket.id, userId);
      console.log(`✅ User ${userId} joined socket`);
    });

    // =============================
    // 2️⃣ 1-to-1 chat
    // =============================
    socket.on("joinRoom", (chatId) => {
      socket.join(chatId);
      console.log(`📥 Socket ${socket.id} joined chat room ${chatId}`);
    });

    socket.on("typing", ({ chatId, senderId }) => {
      socket.to(chatId).emit("typing", { senderId });
    });

    socket.on("stopTyping", ({ chatId, senderId }) => {
      socket.to(chatId).emit("stopTyping", { senderId });
    });

    socket.on("sendMessage", async (data) => {
      try {
        const { chatId, senderId, receiverId, text } = data;
        if (!text || !chatId || !senderId || !receiverId) return;

        const messageKey = `chat_${chatId}-${senderId}-${text.trim()}`;
        const now = Date.now();
        if (
          lastEmittedMessages.has(messageKey) &&
          now - lastEmittedMessages.get(messageKey) < 1000
        ) return;

        lastEmittedMessages.set(messageKey, now);

        const message = await Message.create({
          chatId,
          senderId,
          receiverId,
          text,
          status: "sent",
        });

        // Update last message
        await Chat.update(
          { lastMessage: text, lastTime: new Date() },
          { where: { id: chatId } }
        );

        // Emit message to chat room with timestamp
        io.to(chatId).emit("receiveMessage", {
          id: message.id,
          chatId,
          senderId,
          receiverId,
          text,
          status: message.status,
          createdAt: message.createdAt,
          deliveredAt: message.deliveredAt,
          seenAt: message.seenAt,
        });

        // Mark delivered if receiver is online
        for (let [socketId, userId] of onlineUsers) {
          if (userId === receiverId) {
            await message.update({ status: "delivered", deliveredAt: new Date() });
            io.to(chatId).emit("messageDelivered", {
              messageId: message.id,
              deliveredAt: message.deliveredAt,
            });
            break;
          }
        }

      } catch (error) {
        console.error("❌ Error sending message:", error);
      }
    });

    socket.on("seenMessage", async ({ messageId, chatId }) => {
      try {
        const message = await Message.findByPk(messageId);
        if (!message) return;

        await message.update({ status: "seen", seenAt: new Date() });
        io.to(chatId).emit("messageSeen", {
          messageId: message.id,
          seenAt: message.seenAt,
        });
      } catch (error) {
        console.error("❌ Error marking message seen:", error);
      }
    });

    // =============================
    // 3️⃣ Group chat
    // =============================
    socket.on("joinGroup", (groupId) => {
      socket.join(`group_${groupId}`);
      console.log(`📥 Socket ${socket.id} joined group room group_${groupId}`);
    });

    socket.on("groupTyping", ({ groupId, senderId }) => {
      socket.to(`group_${groupId}`).emit("groupTyping", { senderId });
    });

    socket.on("groupStopTyping", ({ groupId, senderId }) => {
      socket.to(`group_${groupId}`).emit("groupStopTyping", { senderId });
    });

    socket.on("sendGroupMessage", async (data) => {
      try {
        const { groupId, senderId, text } = data;
        if (!text || !groupId || !senderId) return;

        const messageKey = `group_${groupId}-${senderId}-${text.trim()}`;
        const now = Date.now();
        if (
          lastEmittedMessages.has(messageKey) &&
          now - lastEmittedMessages.get(messageKey) < 1000
        ) return;

        lastEmittedMessages.set(messageKey, now);

        const message = await GroupMessage.create({
          groupId,
          senderId,
          text,
          status: "sent",
        });

        io.to(`group_${groupId}`).emit("receiveGroupMessage", {
          id: message.id,
          groupId,
          senderId,
          text,
          status: message.status,
          createdAt: message.createdAt,
          deliveredAt: message.deliveredAt,
          seenAt: message.seenAt,
        });

      } catch (error) {
        console.error("❌ Error sending group message:", error);
      }
    });

    // =============================
    // 4️⃣ Disconnect
    // =============================
    socket.on("disconnect", () => {
      const userId = onlineUsers.get(socket.id);
      onlineUsers.delete(socket.id);
      console.log(`🚪 User ${userId || "unknown"} disconnected (${socket.id})`);
    });
  });

  return io;
}

module.exports = setupSocket;
