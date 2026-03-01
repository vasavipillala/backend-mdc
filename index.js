const express = require('express')
const bodyParser = require('body-parser')
const crypto = require('crypto')
const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs");
require("dotenv").config();
const jwt = require('jsonwebtoken');
const app = express();
const port = 4000;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const cors = require('cors');
app.use(cors());

app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
const { User,sequelize,UserFollowers,FollowRequest,Chat,Message } = require("./mdc-bk/db");

// ✅ Setup nodemailer transporter
const transporter = nodemailer.createTransport({
  service: "gmail", // or use "smtp" config
  auth: {
    user:process.env.EMAIL_USER,
    pass:process.env.EMAIL_PASS// use App Password if Gmail
  }
});

// Admin login route
app.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    // Check against .env credentials
    if (email !== process.env.ADMIN_EMAIL) {
      return res.status(401).json({ message: "Invalid email" });
    }

    // If using plaintext (only for dev/testing)
    if (password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ message: "Invalid password" });
    }

    // ✅ Generate JWT token
    const token = jwt.sign(
      { email, role: "admin" },
      process.env.JWT_ADMIN_SECRET,
      { expiresIn: "8h" } // token valid for 8 hours
    );

    return res.status(200).json({
      message: "Admin login successful",
      accessToken: token
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


app.post("/register-email", async (req, res) => {
  try {
    const { email, password, confirmPassword } = req.body;

    if (!email || !password || !confirmPassword)
      return res.status(400).json({
        message_type: "error",
        status_code: 400,
        message: "All fields are required"
      });

    if (password !== confirmPassword)
      return res.status(400).json({
        message_type: "error",
        status_code: 400,
        message: "Passwords do not match"
      });

    // ✅ Check if user exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      if (existingUser.isVerified)
        return res.status(400).json({
          message_type: "error",
          status_code: 400,
          message: "Email already registered"
        });

      // Resend OTP if not verified
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      existingUser.otp = otp;
      existingUser.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
      await existingUser.save();

      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Resent OTP",
        text: `Your OTP is ${otp}. It will expire in 10 minutes.`
      });

      return res.status(200).json({
        message_type: "success",
        status_code: 200,
        message: "OTP resent to email"
      });
    }

    // ✅ Create new user
    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await User.create({
      email,
      password: hashedPassword,
      otp,
      otpExpiry,
      isVerified: false
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Email Verification OTP",
      text: `Your OTP is ${otp}. It will expire in 10 minutes.`
    });

    res.status(200).json({
      message_type: "success",
      status_code: 200,
      message: "User registered! OTP sent to email."
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message_type: "error",
      status_code: 500,
      message: "Server error"
    });
  }
});

app.post("/verifyOtp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(404).json({ message_type:"error", message: "User not found" });
    if (user.isVerified) return res.status(400).json({ message_type:"error", message: "User already verified" });

    if (!user.otp || user.otp !== otp || user.otpExpiry < new Date())
      return res.status(400).json({ message_type:"error", message: "Invalid or expired OTP" });

    user.isVerified = true;
    user.otp = null;
    user.otpExpiry = null;
    await user.save();

    const accessToken = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: "1500m" });
    const refreshToken = jwt.sign({ id: user.id }, process.env.JWT_REFRESH_SECRET, { expiresIn: "90d" });

    res.status(200).json({
      message_type:"success",
      message: "Email verified successfully!",
      userId: user.id,
      access_token: accessToken,
      refresh_token: refreshToken
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message_type:"error", message: "Server error during OTP verification" });
  }
});

app.post("/refresh-token", async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(401).json({ message: "Refresh token required" });
    }

    // Verify old refresh token
    jwt.verify(refresh_token, process.env.JWT_REFRESH_SECRET, (err, decoded) => {
      if (err) {
        return res.status(403).json({ message: "Invalid or expired refresh token" });
      }

      // Generate new access token
      const newAccessToken = jwt.sign(
        { id: decoded.id, email: decoded.email },
        process.env.JWT_SECRET,
        { expiresIn: "1500m" } // short-lived
      );

      // Generate new refresh token
      const newRefreshToken = jwt.sign(
        { id: decoded.id, email: decoded.email },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: "90d" } // long-lived (same as your verifyOtp API)
      );

      return res.status(200).json({
        message: "New tokens generated",
        access_token: newAccessToken,
        refresh_token: newRefreshToken
      });
    });

  } catch (error) {
    console.error("❌ Error in refresh-token API:", error);
    return res.status(500).json({ message: "Server error during token refresh" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1️⃣ Validate input
    if (!email || !password) {
      return res.status(400).json({
        message_type: "error",
        status_code: 400,
        message: "Email and password are required",
      });
    }

    // 2️⃣ Find user by email (PostgreSQL)
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({
        message_type: "error",
        status_code: 401,
        message: "Invalid email or password",
      });
    }

    // 3️⃣ Check if email is verified
    if (!user.isVerified) {
      return res.status(403).json({
        message_type: "error",
        status_code: 403,
        message: "Email not verified. Please verify your email first.",
      });
    }

    // 4️⃣ Compare password using bcrypt
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        message_type: "error",
        status_code: 401,
        message: "Invalid email or password",
      });
    }

    // 5️⃣ Generate access & refresh tokens
    const accessToken = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "1500m" } // short-lived
    );

    const refreshToken = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: "90d" } // long-lived
    );

    // Optional: store refresh token in DB
    user.refreshToken = refreshToken;
    await user.save();

    // ✅ Success response
    res.status(200).json({
      message_type: "success",
      status_code: 200,
      message: "Login successful",
      accessToken,
      refreshToken,
     isRegistration: !!user.fullName || false, 
      userId: user.id,
    });

  } catch (error) {
    console.error("❌ Login API Error:", error);
    res.status(500).json({
      message_type: "error",
      status_code: 500,
      message: "Server error during login",
    });
  }
});

app.get("/check-uniqueId/:uniqueId", async (req, res) => {
  try {
    const { uniqueId } = req.params;

    if (!uniqueId) {
      return res.status(400).json({
        message_type: "error",
        status_code: 400,
        message: "Unique ID is required",
        available: false
      });
    }

    // Reserved keys
    const reservedKeys = ["V111111", "J222222", "T333333"];
    if (reservedKeys.includes(uniqueId)) {
      return res.status(200).json({
        message_type: "info",
        status_code: 200,
        message: "This Unique ID is reserved and not available",
        available: false
      });
    }

    // ✅ Sequelize case-insensitive search
    const existingUser = await User.findOne({
      where: sequelize.where(
        sequelize.fn('LOWER', sequelize.col('uniqueId')),
        sequelize.fn('LOWER', uniqueId)
      )
    });

    if (existingUser) {
      return res.status(200).json({
        message_type: "info",
        status_code: 200,
        message: "Unique ID is already taken",
        available: false
      });
    }

    return res.status(200).json({
      message_type: "success",
      status_code: 200,
      message: "Unique ID is available",
      available: true
    });

  } catch (error) {
    console.error("❌ Error checking uniqueId:", error.message);
    return res.status(500).json({
      message_type: "error",
      status_code: 500,
      message: "Server error while checking Unique ID",
      available: false
    });
  }
});
const authenticate = require("./mdc-bk/src/middleware/auth/Authentication");

// Complete profile / registration
app.post("/register/:userId", authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      fullName,
      occupation,
      goal,
      type,
      accountType,
      uniqueId,
      isPremium,
      isVerify
    } = req.body;

    // ❌ Validation
    if (!fullName || !uniqueId) {
      return res.status(400).json({
        message_type: "error",
        status_code: 400,
        message: "Full name and Unique ID are required",
        isRegistration: false,
      });
    }

    // ❌ Reserved keys check
    const reservedKeys = ["V111111", "J222222", "T333333"];
    if (reservedKeys.includes(uniqueId)) {
      return res.status(400).json({
        message_type: "error",
        status_code: 400,
        message: "This Unique ID is reserved and not available",
        isRegistration: false,
      });
    }

    // ❌ Check if uniqueId is already taken by another user
    const existingUserWithUniqueId = await User.findOne({ where: { uniqueId } });
    if (existingUserWithUniqueId && existingUserWithUniqueId.id.toString() !== userId) {
      return res.status(400).json({
        message_type: "error",
        status_code: 400,
        message: "Unique ID is already taken, please choose another",
        isRegistration: false,
      });
    }

    // ✅ Find the verified user by userId
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        message_type: "error",
        status_code: 404,
        message: "User not found",
        isRegistration: false,
      });
    }

    // ✅ Update user profile (DO NOT create a new user)
    user.fullName = fullName;
    user.occupation = occupation;
    user.goal = goal;
    user.type = type?.toLowerCase() || "user";
    user.accountType = accountType?.toLowerCase() || "public";
    user.uniqueId = uniqueId;
    user.isPremium = isPremium || false;
    user.isVerified = isVerify || user.isVerified || false;

    await user.save();

    const responseUser = {
      id: user.id.toString(), // 👈 userId remains the same
      fullName: user.fullName,
      occupation: user.occupation,
      goal: user.goal,
      type: user.type,
      accountType: user.accountType,
      uniqueId: user.uniqueId,
      isPremium: user.isPremium,
      isVerify: user.isVerified,
      avatar: user.image || "https://randomuser.me/api/portraits/lego/1.jpg",
      isRegistration: true,
      email:user.email
    };

    return res.status(201).json({
      message_type: "success",
      status_code: 201,
      message: "Registration completed successfully!",
      user: responseUser,
    });

  } catch (error) {
    console.error("❌ Error during registration:", error.message);
    return res.status(500).json({
      message_type: "error",
      status_code: 500,
      message: "Server error during registration",
      isRegistration: false,
    });
  }
});

// GET all verified users
app.get("/users", authenticate, async (req, res) => {
  try {
    // Fetch all verified users
    const users = await User.findAll({
      where: { isVerified: true },
      attributes: { exclude: ["password", "otp", "otpExpiry"] }, // exclude sensitive data
      raw: true // return plain JS objects
    });

    if (!users.length) {
      return res.status(404).json({
        message_type: "error",
        status_code: 404,
        message: "No verified users found"
      });
    }

    // Transform data to match your previous response structure
    const transformed = users.map(u => ({
      id: u.id.toString(),
      name: u.fullName || "Unknown User",
      occupation: u.occupation || "Not provided",
      goal: u.goal || "Not specified",
      type: u.type || "user",
      avatar: u.image || "https://randomuser.me/api/portraits/lego/1.jpg",
      accountType: u.accountType || "public",
      uniqueId: u.uniqueId || ("U" + u.id.toString().padStart(6, "0")),
      isPremium: u.isPremium || false,
      isVerify: u.isVerified || false,
      email: u.email || "No Email",
      isRegistration: !!u.fullName
    }));

    return res.status(200).json({
      message_type: "success",
      status_code: 200,
      message: "Verified users fetched successfully",
      users: transformed
    });

  } catch (error) {
    console.error("❌ Error fetching users:", error);
    return res.status(500).json({
      message_type: "error",
      status_code: 500,
      message: "Server error while fetching users"
    });
  }
});


app.get("users/:id", authenticate, async (req, res) => {
  try {
    const userId = req.params.id;

    // Fetch user with followers and following
    const user = await User.findOne({
      where: { id: userId, isVerified: true },
      attributes: { exclude: ["password", "otp", "otpExpiry"] },
      include: [
        {
          model: User,
          as: "Followers",
          attributes: ["id", "fullName", "uniqueId", "image"],
          through: { attributes: [] }, // exclude join table data
        },
        {
          model: User,
          as: "Following",
          attributes: ["id", "fullName", "uniqueId", "image"],
          through: { attributes: [] },
        },
      ],
    });

    if (!user) {
      return res.status(404).json({
        message_type: "error",
        status_code: 404,
        message: "Verified user not found",
      });
    }

    // Counts
    const followersCount = user.Followers ? user.Followers.length : 0;
    const followingCount = user.Following ? user.Following.length : 0;
    const totalConnections = followersCount + followingCount;

    return res.status(200).json({
      message_type: "success",
      status_code: 200,
      message: "Verified user fetched successfully",
      user: {
        ...user.toJSON(), // convert Sequelize instance to plain object
        followersCount,
        followingCount,
        totalConnections,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching user:", error);
    return res.status(500).json({
      message_type: "error",
      status_code: 500,
      message: "Server error while fetching user",
    });
  }
});

process.on("SIGTERM", () => {
  server.close(() => {
    console.log("🛑 Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  server.close(() => {
    console.log("🛑 Server closed");
    process.exit(0);
  });
});
const { Op } = require("sequelize");
const http = require("http");
const setupSocket = require("./mdc-bk/src/routes/Socket"); // 👆 from above file
const path = require("path");
const server = http.createServer(app);
const io = setupSocket(server);
const chatRoutes = require("./mdc-bk/src/routes/Chat")(io)
const groupRoute = require("./mdc-bk/src/routes/GroupRoute")
const profileRoute = require("./mdc-bk/src/routes/Profile")
const userRoute = require("./mdc-bk/src/routes/UserRoute")
app.use("/users", userRoute);
app.use("/chats", chatRoutes);
app.use("/groups", groupRoute);
// ✅ Serve uploaded profile images publicly
app.use("/uploads/profile", express.static(path.join(__dirname, "uploads/profile")));
app.use("/uploads/posts", express.static(path.join(__dirname, "uploads/posts")));
//app.use("/uploads/profile", express.static("uploads/profile"));
app.use("/profile",profileRoute)
const postRoutes = require("./mdc-bk/src/routes/PostRoute");
app.use("/posts", postRoutes);

server.listen(4000, () => {
  console.log("🚀 Server running on http://localhost:4000");
});
app.get("/message/:chatId", async (req, res) => {
  try {
    const { chatId } = req.params;

    // 1️⃣ Fetch chat info
    const chat = await Chat.findOne({ where: { id: chatId } });

    if (!chat) {
      return res.status(404).json({
        message: "Chat not found",
        message_type: "error",
      });
    }

    // 2️⃣ Fetch all messages in this chat
    const messages = await Message.findAll({
      where: { chatId },
      order: [["createdAt", "ASC"]],
    });

    // 3️⃣ Logic to check if it's still a message request
    let isMsgRequest = false;
    let requestSenderId = chat.requestSenderId;

    if (!chat.isMsgReqAccepted && chat.requestStatus === "pending") {
      if (messages.length === 0) {
        // no messages yet
        isMsgRequest = false;
      } else {
        // has messages → check if receiver replied
        const hasReceiverReply = messages.some(
          (msg) => msg.senderId !== chat.requestSenderId
        );

        if (hasReceiverReply) {
          // Receiver replied → accept the message request automatically
          chat.isMsgReqAccepted = true;
          chat.requestStatus = "accepted";
          await chat.save();

          isMsgRequest = false;
          requestSenderId = null;
        } else {
          // Only sender messages → still pending
          isMsgRequest = true;
        }
      }
    }

    // 4️⃣ If chat has no request info (first message ever), mark it
    if (!chat.requestSenderId && messages.length > 0) {
      const firstMsg = messages[0];
      chat.requestSenderId = firstMsg.senderId;
      chat.requestStatus = "pending";
      chat.isMsgReqAccepted = false;
      await chat.save();
      isMsgRequest = true;
    }

    // 5️⃣ Response
    const response = {
      message: isMsgRequest
        ? "Message request not accepted yet."
        : "Messages fetched successfully",
      message_type: "success",
      requestSenderId,
      requestStatus: chat.requestStatus,
      isMsgRequest,
      time: chat.updatedAt,
      messages,
    };

    res.json(response);
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({
      message: "Error fetching messages",
      message_type: "error",
    });
  }
});

app.get("/getMessageRequests/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // 1️⃣ Find unique senders who messaged this user
    const senders = await Message.findAll({
      attributes: ["senderId"],
      where: { receiverId: userId },
      group: ["senderId"],
    });

    const senderIds = senders.map((msg) => msg.senderId);
    const messageRequests = [];

    // 2️⃣ Loop through senders and filter message requests (no reply yet)
    for (const senderId of senderIds) {
      // Check if user replied back — if not, it's a message request
      const reply = await Message.findOne({
        where: { senderId: userId, receiverId: senderId },
      });

      if (!reply) {
        const sender = await User.findByPk(senderId, {
          attributes: [
            "id",
            "fullName",
            "uniqueId",
            "image",
            "isOnline",
            "type",
          ],
        });

        const lastMessage = await Message.findOne({
          where: { senderId, receiverId: userId },
          order: [["createdAt", "DESC"]],
          attributes: ["text", "createdAt", "status"],
        });

        // 3️⃣ Count unread messages from this sender to user
        const unreadCount = await Message.count({
          where: {
            senderId,
            receiverId: userId,
            status: { [Op.not]: "seen" },
          },
        });

        if (sender && lastMessage) {
          messageRequests.push({
            id: sender.id,
            name: sender.fullName,
            uniqueId: sender.uniqueId,
            profileImage: sender.image,
            userType: sender.type,
            isOnline: sender.isOnline,
            lastMessage: lastMessage.text,
            lastMessageTime: lastMessage.createdAt,
            status: lastMessage.status,
            unreadCount, // 👈 added here
          });
        }
      }
    }

    // 4️⃣ Standardized response
    res.status(200).json({
      status_code: 200,
      status_type: "success",
      message:
        messageRequests.length > 0
          ? "Message requests fetched successfully"
          : "No message requests found",
      count: messageRequests.length,
      data: messageRequests,
    });
  } catch (error) {
    console.error("❌ Error fetching message requests:", error);
    res.status(500).json({
      status_code: 500,
      status_type: "error",
      message: "Error fetching message requests",
      error: error.message,
    });
  }
});


// ✅ Get all message friends


app.get("/messages/friends/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    // 1️⃣ Find unique chat partners (sent or received)
    const sentMessages = await Message.findAll({
      where: { senderId: userId },
      attributes: ["receiverId"],
    });
    const receivedMessages = await Message.findAll({
      where: { receiverId: userId },
      attributes: ["senderId"],
    });

    // 2️⃣ Combine both sides (unique friend IDs)
    const friendIds = [
      ...new Set([
        ...sentMessages.map((m) => m.receiverId),
        ...receivedMessages.map((m) => m.senderId),
      ]),
    ];

    if (friendIds.length === 0) {
      return res.json([]);
    }

    // 3️⃣ For each friend, get their last message + counts
    const friendsData = await Promise.all(
      friendIds.map(async (friendId) => {
        const lastMessage = await Message.findOne({
          where: {
            [Op.or]: [
              { senderId: userId, receiverId: friendId },
              { senderId: friendId, receiverId: userId },
            ],
          },
          order: [["createdAt", "DESC"]],
        });

        const unreadCount = await Message.count({
          where: {
            senderId: friendId,
            receiverId: userId,
            status: { [Op.not]: "seen" },
          },
        });

        // optional – if you have a `User` model
        const friend = await User.findOne({
          where: { id: friendId },
          attributes: ["id", "fullName", "image", "isOnline","uniqueId","type"],
        });

        return {
          id: friend.id,
          name: friend.fullName,
          uniqueId:friend.uniqueId,
          profileImage: friend.image,
          userType:friend.type,
          isOnline: friend.isOnline,
          lastMessage: lastMessage ? lastMessage.text : "",
          lastMessageTime: lastMessage ? lastMessage.createdAt : null,
          unreadCount,
          status: lastMessage ? lastMessage.status : "sent",
        };
      })
    );

    res.json(friendsData);
  } catch (err) {
    console.error("Error fetching message friends:", err);
    res.status(500).json({ message: "Error fetching message friends" });
  }
});

app.get("/message/friends/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    // 1️⃣ Find unique chat partners (both sent & received)
    const sentMessages = await Message.findAll({
      where: { senderId: userId },
      attributes: ["receiverId"],
    });

    const receivedMessages = await Message.findAll({
      where: { receiverId: userId },
      attributes: ["senderId"],
    });

    const friendIds = [
      ...new Set([
        ...sentMessages.map((m) => m.receiverId),
        ...receivedMessages.map((m) => m.senderId),
      ]),
    ];

    if (friendIds.length === 0) {
      return res.status(200).json({
        status_code: 200,
        status_type: "success",
        message: "No message friends found",
        data: [],
      });
    }

    // 2️⃣ Filter only accepted requests
    const validFriends = [];
    for (const friendId of friendIds) {
   const acceptedRequest = await Chat.findOne({
  where: {
    [Op.or]: [
      {
        senderId: userId,
        receiverId: friendId,
        requestStatus: "accepted",
      },
      {
        senderId: friendId,
        receiverId: userId,
        requestStatus: "accepted",
      },
    ],
  },
});

      const hasMessages = await Message.findOne({
  where: {
    [Op.or]: [
      { senderId: userId, receiverId: friendId },
     // { senderId: friendId, receiverId: userId },
    ],
  },
});

      if (acceptedRequest|| hasMessages) validFriends.push(friendId);
    }

    if (validFriends.length === 0) {
      return res.status(200).json({
        status_code: 200,
        status_type: "success",
        message: "No accepted message friends found",
        data: [],
      });
    }

    // 3️⃣ Prepare each friend’s data
    const friendsData = await Promise.all(
      validFriends.map(async (friendId) => {
        const lastMessage = await Message.findOne({
          where: {
            [Op.or]: [
              { senderId: userId, receiverId: friendId },
              { senderId: friendId, receiverId: userId },
            ],
          },
          order: [["createdAt", "DESC"]],
        });

        const unreadCount = await Message.count({
          where: {
            senderId: friendId,
            receiverId: userId,
            status: { [Op.not]: "seen" },
          },
        });

        const friend = await User.findOne({
          where: { id: friendId },
          attributes: ["id", "fullName", "image", "isOnline", "uniqueId", "type"],
        });

        let lastMessageText = "";
        if (lastMessage) {
          lastMessageText =
            lastMessage.senderId == userId
              ? `You: ${lastMessage.text}`
              : lastMessage.text;
        }

        return {
          id: friend.id,
          name: friend.fullName,
          uniqueId: friend.uniqueId,
          profileImage: friend.image,
          userType: friend.type,
          isOnline: friend.isOnline,
          lastMessage: lastMessageText,
          lastMessageTime: lastMessage ? lastMessage.createdAt : null,
          unreadCount,
          status: lastMessage ? lastMessage.status : "sent",
        };
      })
    );

    res.status(200).json({
      status_code: 200,
      status_type: "success",
      message: "Accepted message friends fetched successfully",
      count: friendsData.length,
      data: friendsData,
    });
  } catch (err) {
    console.error("❌ Error fetching message friends:", err);
    res.status(500).json({
      status_code: 500,
      status_type: "error",
      message: "Error fetching message friends",
      error: err.message,
    });
  }
});

app.post("/messages/send", async (req, res) => {
  try {
    const { chatId, senderId, receiverId, text } = req.body;

    if (!chatId || !senderId || !receiverId || !text) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const chat = await Chat.findByPk(chatId);
    if (!chat) return res.status(404).json({ message: "Chat not found" });

    const message = await Message.create({
      chatId,
      senderId,
      receiverId,
      text,
    });

    // Update chat last message
    await chat.update({ lastMessage: text, lastTime: new Date() });

    res.status(200).json({
      message_type: "success",
      status_code: 200,
      message: "Message sent successfully",
      data: message,
    });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});




















