const {  User,sequelize,UserFollowers,FollowRequest,Chat,Message } = require("../../db")
const { Op } = require("sequelize");
const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/auth/Authentication");

router.get("/suggestions", authenticate, async (req, res) => {
  try {
    const currentUserId = req.user.id;

    const users = await User.findAll({
      where: { id: { [Op.ne]: currentUserId } },
      attributes: [
        "id",
        "uniqueId",
        "fullName",
        "image",
        "occupation",
        "goal",
        "type",
        "accountType",
        "isPremium",
        "isVerified"
      ],
      raw: true,
    });

    const relations = await FollowRequest.findAll({
      where: {
        [Op.or]: [
          { requesterId: currentUserId },
          { targetId: currentUserId },
        ],
      },
      raw: true,
    });

    const suggestions = users.map(u => {
      const relation = relations.find(r =>
        (r.requesterId === currentUserId && r.targetId === u.id) ||
        (r.requesterId === u.id && r.targetId === currentUserId)
      );

      let requestStatus = "none";
      let isAccepted = false;
      let isRequest = "";

      if (relation) {
        if (relation.status === "accepted") {
          requestStatus = "accepted";
          isAccepted = true;
          isRequest = "connection";
        } else if (relation.status === "pending") {
          requestStatus = relation.requesterId === currentUserId ? "pending" : "incoming";
          isRequest = u.accountType === "private" ? "requested" : "join";
        } else if (["rejected", "withdrawn"].includes(relation.status)) {
          requestStatus = relation.status;
          isRequest = u.accountType === "private" ? "request" : "join";
        }
      } else {
        requestStatus = "none";
        isRequest = u.accountType === "private" ? "request" : "join";
      }

      // ❌ exclude accepted, pending, and incoming users
      if (["accepted", "pending", "incoming"].includes(requestStatus)) return null;

      return {
        id: u.id,
        uniqueId: u.uniqueId,
        name: u.fullName || "unknown",
        avatar: u.image,
        occupation: u.occupation,
        goal: u.goal || null,
        isAccepted,
        requestStatus,
        type: u.type || "user",
        accountType: u.accountType || "public",
        isPremium: u.isPremium || false,
        isVerify: u.isVerified || false,
        isRequest
      };
    }).filter(Boolean);

    return res.status(200).json({
      message_type: "success",
      status_code: 200,
      message: "Suggestions fetched successfully",
      data: suggestions,
    });

  } catch (error) {
    console.error("❌ Error fetching suggestions:", error);
    return res.status(500).json({
      message_type: "error",
      status_code: 500,
      message: "Server error while fetching suggestions",
      data: [],
    });
  }
});

router.post("/follow/:id", authenticate, async (req, res) => {
  try {
    const requesterId = req.user.id;
    const targetId = parseInt(req.params.id);

    // ✅ Validate IDs
    console.log("requesterId:", requesterId);
console.log("targetId:", targetId);
    if (!requesterId || !targetId) {
      return res.status(400).json({
        message: "Invalid requester or target ID",
      });
    }

    if (requesterId === targetId) {
      return res.status(400).json({
        message: "Cannot connect to yourself",
      });
    }

    // ✅ Fetch users
    const requester = await User.findByPk(requesterId);
    const targetUser = await User.findByPk(targetId);

    if (!requester) {
      return res.status(400).json({
        message: "Requester user not found",
      });
    }

    if (!targetUser) {
      return res.status(404).json({
        message: "Target user not found",
      });
    }

    // ✅ Check existing request
    const existing = await FollowRequest.findOne({
      where: {
        [Op.or]: [
          { requesterId, targetId },
          { requesterId: targetId, targetId: requesterId },
        ],
      },
    });

    if (existing) {
      return res.status(400).json({
        message: "Connection or request already exists",
      });
    }

    // ✅ Decide status
    let status = "pending";
    let isRequest = "requested";

    if (targetUser.accountType === "public") {
      status = "accepted";
      isRequest = "connection";
    }

    // ✅ Create request
    const request = await FollowRequest.create({
      requesterId,
      targetId,
      status,
    });

    // ✅ Auto mutual connection for public accounts
    if (status === "accepted") {
      await FollowRequest.findOrCreate({
        where: {
          requesterId: targetId,
          targetId: requesterId,
        },
        defaults: { status: "accepted" },
      });
    }

    return res.status(200).json({
      message: status === "accepted"
        ? "Connection established successfully"
        : "Connection request sent successfully",
      data: {
        requestId: request.id,
        isRequest,
        status,
      },
    });

  } catch (error) {
    console.error("❌ Error sending connection request:", error);

    return res.status(500).json({
      message: "Server error while sending connection request",
    });
  }
});

router.get("/requests/incoming/:id", authenticate, async (req, res) => {
  try {
    const currentUserId = req.user.id;

    // Fetch all pending requests where current user is the target
    const requests = await FollowRequest.findAll({
      where: { targetId: currentUserId, status: "pending" },
      include: [
        {
          model: User,
          as: "Requester",
          attributes: ["id", "uniqueId", "fullName", "image", "occupation", "goal"],
        },
      ],
      raw: true,
      nest: true,
    });

    // Format response
    const formatted = requests.map(r => ({
      id: r.Requester.id,
      uniqueId: r.Requester.uniqueId,
      name: r.Requester.fullName,
      avatar: r.Requester.image,
      occupation: r.Requester.occupation,
      goal: r.Requester.goal || null,
      isAccepted: false,
      requestStatus: "incoming", // because they sent the request
      requestId: r.id // optional, to identify the request for accept/reject
    }));

    res.status(200).json({
      message_type: "success",
      status_code: 200,
      message: "Incoming requests fetched successfully",
      data: formatted,
    });

  } catch (error) {
    console.error("❌ Error fetching incoming requests:", error);
    res.status(500).json({
      message_type: "error",
      status_code: 500,
      message: "Server error while fetching incoming requests",
      data: [],
    });
  }
});

router.get("/requests/pending", authenticate, async (req, res) => {
  try {
    const currentUserId = req.user.id;

    // Fetch all pending requests where current user is the requester
    const requests = await FollowRequest.findAll({
      where: { requesterId: currentUserId, status: "pending" },
      include: [
        {
          model: User,
          as: "Target",
          attributes: ["id", "uniqueId", "fullName", "image", "occupation", "goal"],
        },
      ],
      raw: true,
      nest: true,
    });

    // Format response
    const formatted = requests.map(r => ({
      id: r.Target.id,
      uniqueId: r.Target.uniqueId,
      name: r.Target.fullName,
      avatar: r.Target.image,
      occupation: r.Target.occupation,
      goal: r.Target.goal || null,
      isAccepted: false,
      requestStatus: "pending", // because you sent the request
      requestId: r.id // optional, to identify the request for withdraw
    }));

    res.status(200).json({
      message_type: "success",
      status_code: 200,
      message: "Pending requests fetched successfully",
      data: formatted,
    });

  } catch (error) {
    console.error("❌ Error fetching pending requests:", error);
    res.status(500).json({
      message_type: "error",
      status_code: 500,
      message: "Server error while fetching pending requests",
      data: [],
    });
  }
});

router.delete("/requests/withdraw/:id", authenticate, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const requestId = req.params.id;

    const request = await FollowRequest.findOne({
      where: {
        id: requestId,
        requesterId: currentUserId,
        status: "pending"
      }
    });

    if (!request) {
      return res.status(404).json({
        message_type: "error",
        message: "No pending request found",
      });
    }

    await request.destroy();

    res.status(200).json({
      message_type: "success",
      message: "Request withdrawn successfully",
    });

  } catch (error) {
    console.error("❌ Withdraw error:", error);
    res.status(500).json({
      message_type: "error",
      message: "Server error while withdrawing",
    });
  }
});


router.post("/requests/accept/:id", authenticate, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const requestId = parseInt(req.params.id);

    const request = await FollowRequest.findByPk(requestId);
    if (!request || request.status !== "pending")
      return res.status(404).json({
        message_type: "error",
        status_code: 404,
        message: "Request not found or already processed",
        data: null,
      });

    if (request.targetId !== currentUserId)
      return res.status(403).json({
        message_type: "error",
        status_code: 403,
        message: "Not authorized to accept this request",
        data: null,
      });

    // Accept the request
    request.status = "accepted";
    await request.save();

    // Create mutual connection
    await FollowRequest.findOrCreate({
      where: { requesterId: request.targetId, targetId: request.requesterId },
      defaults: { status: "accepted" },
    });

    // Get target user info
    const user = await User.findByPk(request.requesterId);

    res.status(200).json({
      message_type: "success",
      status_code: 200,
      message: "Request accepted successfully",
      data: {
        id: user.id,
        uniqueId: user.uniqueId,
        name: user.fullName,
        avatar: user.image,
        occupation: user.occupation,
        goal: user.goal || null,
        isAccepted: true,
        requestStatus: "accepted",
        requestId: request.id,
      },
    });
  } catch (error) {
    console.error("❌ Error accepting request:", error);
    res.status(500).json({
      message_type: "error",
      status_code: 500,
      message: "Server error while accepting request",
      data: null,
    });
  }
});

router.get("/connections/:id", authenticate, async (req, res) => {
  try {
    const currentUserId = req.user.id;

    const connections = await FollowRequest.findAll({
      where: {
        status: "accepted",
        [Op.or]: [{ requesterId: currentUserId }, { targetId: currentUserId }],
      },
      include: [
        { model: User, as: "Requester", attributes: ["id", "uniqueId", "fullName", "image", "occupation", "goal","type","isPremium"] },
        { model: User, as: "Target", attributes: ["id", "uniqueId", "fullName", "image", "occupation", "goal","type","isPremium"] },
      ],
    });

    // ✅ Filter duplicates using a Set
    const seen = new Set();
    const formatted = [];

    for (const c of connections) {
      const connectedUser = c.requesterId === currentUserId ? c.Target : c.Requester;
  const chat = await Message.findOne({
    where: {
      [Op.or]: [
        { senderId: currentUserId, receiverId: connectedUser.id },
        { senderId: connectedUser.id, receiverId: currentUserId }
      ]
    },
    order: [['createdAt', 'DESC']],
  });
      if (!seen.has(connectedUser.id)) {
        seen.add(connectedUser.id);
        formatted.push({
          id: connectedUser.id,
          uniqueId: connectedUser.uniqueId,
          name: connectedUser.fullName,
          avatar: connectedUser.image,
          occupation: connectedUser.occupation,
          goal: connectedUser.goal || null,
          type:connectedUser.type || "user",
          isPremium:connectedUser.isPremium || false,
          isAccepted: chat ? true : false, // ✅ true if chat/request exists
          requestStatus: chat ? chat.status : null, //
        });
      }
    }

    res.status(200).json({
      message_type: "success",
      status_code: 200,
      message: "Connections fetched successfully",
      data: formatted,
    });

  } catch (error) {
    console.error("❌ Error fetching connections:", error);
    res.status(500).json({
      message_type: "error",
      status_code: 500,
      message: "Server error while fetching connections",
      data: [],
    });
  }
});

router.post("/requests/reject/:id", authenticate, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const requestId = parseInt(req.params.id);

    const request = await FollowRequest.findByPk(requestId);
    if (!request)
      return res.status(404).json({
        message_type: "error",
        status_code: 404,
        message: "Request not found",
        data: null,
      });

    if (request.targetId !== currentUserId)
      return res.status(403).json({
        message_type: "error",
        status_code: 403,
        message: "Not authorized to reject this request",
        data: null,
      });

    await request.destroy();

    res.status(200).json({
      message_type: "success",
      status_code: 200,
      message: "Request rejected successfully",
      data: null,
    });
  } catch (error) {
    console.error("❌ Error rejecting request:", error);
    res.status(500).json({
      message_type: "error",
      status_code: 500,
      message: "Server error while rejecting request",
      data: null,
    });
  }
});

router.delete("/connections/remove/:targetId", authenticate, async (req, res) => {
  try {
    const currentUserId = Number(req.user.id);
    const targetId = Number(req.params.targetId);

    if (!targetId || isNaN(targetId)) {
      return res.status(400).json({
        message_type: "error",
        status_code: 400,
        message: "Invalid target user ID",
        data: null,
      });
    }

    const followRequest = await FollowRequest.findOne({
      where: {
        status: "accepted",
        [Op.or]: [
          { requesterId: currentUserId, targetId },
          { requesterId: targetId, targetId: currentUserId },
        ],
      },
    });

    if (!followRequest) {
      return res.status(404).json({
        message_type: "error",
        status_code: 404,
        message: "Connection not found",
        data: null,
      });
    }

    await followRequest.destroy();

    res.status(200).json({
      message_type: "success",
      status_code: 200,
      message: "Connection removed successfully",
    });
  } catch (error) {
    console.error("❌ Error removing connection:", error);
    res.status(500).json({
      message_type: "error",
      status_code: 500,
      message: "Server error while removing connection",
    });
  }
});


router.get("/organizations", async (req, res) => {
  try {
    const { type } = req.query;

    // validate type
    if (!["school", "business"].includes(type)) {
      return res.status(400).json({
        message: "type must be school or business",
      });
    }

    const organizations = await User.findAll({
      where: { type }, // 🔥 use `type` column
      attributes: ["id", "fullName", "image"],
      order: [["createdAt", "DESC"]],
    });

    return res.json({
      status: "success",
      count: organizations.length,
      data: organizations,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
});


//module.exports = router; // 🔥 important




module.exports = router;
