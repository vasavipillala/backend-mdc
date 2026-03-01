const { User, FollowRequest } = require("../../db")
const { Op } = require("sequelize");
const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/auth/Authentication");
const multer = require("multer");
const path = require("path");

// ✅ GET user profile by uniqueId

router.get("/:userId", authenticate, async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findOne({
      where: { id: userId },
      attributes: [
        "id",
        "fullName",
        "uniqueId",
        "isPremium",
        "image",
        "description",
        "goal",
        "occupation",
        "accountType",
        "address",
        "email",
      ],
    });

    if (!user) {
      return res.status(404).json({
        message_type: "error",
        status_code: 404,
        message: "User not found",
      });
    }

    // ✅ Get all accepted connections (either direction)
    const acceptedConnections = await FollowRequest.findAll({
      where: {
        status: "accepted",
        [Op.or]: [{ requesterId: user.id }, { targetId: user.id }],
      },
      attributes: ["requesterId", "targetId"],
      raw: true,
    });

    // ✅ Convert to unique pairs (avoid A↔B and B↔A duplicates)
    const uniquePairs = new Set();

    acceptedConnections.forEach((conn) => {
      const a = Math.min(conn.requesterId, conn.targetId);
      const b = Math.max(conn.requesterId, conn.targetId);
      uniquePairs.add(`${a}-${b}`);
    });

    const connectionCount = uniquePairs.size;

    const responseData = {
      fullName: user.fullName,
      uniqueId: user.uniqueId,
      isPremium: user.isPremium,
      image: user.image,
      description: user.description,
      goal: user.goal,
      occupation: user.occupation,
      accountType: user.accountType,
      address: user.address,
      email: user.email,
      connectionCount,
    };

    res.status(200).json({
      message_type: "success",
      status_code: 200,
      message: "Profile fetched successfully",
      data: responseData,
    });
  } catch (error) {
    console.error("❌ Error fetching profile:", error);
    res.status(500).json({
      message_type: "error",
      status_code: 500,
      message: "Server error while fetching profile",
      data: [],
    });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/profile"); // store locally before deployment
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// --- Update Profile API ---
router.put("/:userId", authenticate, upload.single("image"), async (req, res) => {
  try {
    const { userId } = req.params;
    const { fullName, description, goal, occupation, accountType, isPremium,address } = req.body;

    const user = await User.findOne({ where: { id: userId } });

    if (!user) {
      return res.status(404).json({
        message_type: "error",
        status_code: 404,
        message: "User not found",
      });
    }

    // Handle uploaded image
    let imagePath = user.image;
    if (req.file) {
      imagePath = `uploads/profile/${req.file.filename}`;
      // For production: replace with Cloudinary URL or S3 link
    }

    await user.update({
      fullName: fullName || user.fullName,
      image: imagePath,
      description: description || user.description,
      goal: goal || user.goal,
      occupation: occupation || user.occupation,
      accountType: accountType || user.accountType,
      isPremium: isPremium !== undefined ? isPremium : user.isPremium,
      address:address || user.address || "Enter Address"
    });

    const connectionCount = await FollowRequest.count({
      where: {
        status: "accepted",
        [Op.or]: [{ requesterId: user.id }, { targetId: user.id }],
      },
    });

    const responseData = {
      id: user.id,
      fullName: user.fullName,
      uniqueId: user.uniqueId,
      image: imagePath,
      description: user.description,
      goal: user.goal,
      occupation: user.occupation,
      accountType: user.accountType,
      isPremium: user.isPremium,
      connectionCount,
      address:user.address
    };

    res.status(200).json({
      message_type: "success",
      status_code: 200,
      message: "Profile updated successfully",
      data: responseData,
    });
  } catch (error) {
    console.error("❌ Error updating profile:", error);
    res.status(500).json({
      message_type: "error",
      status_code: 500,
      message: "Server error while updating profile",
    });
  }
});


module.exports = router;

