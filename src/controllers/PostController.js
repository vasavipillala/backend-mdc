const { Op ,Sequelize} = require("sequelize");
const { User, UploadPosts, FollowRequest,PostLike,PostComment,PostReport,SavedPost  } = require("../../db");
const fs = require("fs");
const path = require("path");

exports.createPost = async (req, res) => {
  try {
    const { type, textContent, description, userId,title } = req.body;

    let media = null;

    if (req.files && req.files.length > 0) {
      media = req.files.map((f) => `uploads/posts/${f.filename}`);
    }

    const post = await UploadPosts.create({
      type,
      textContent: type === "text" ? textContent : null,
      description,
      mediaPaths: media,
      userId,
      title
    });

    return res.status(201).json({
      message: "Post created successfully",
      post,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.getHomeFeedCursor = async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const limit = Number(req.query.limit) || 10;
    const cursor = req.query.cursor;

    // ✅ 1. Get accepted connections
    const acceptedConnections = await FollowRequest.findAll({
      where: {
        status: "accepted",
        [Op.or]: [
          { requesterId: userId },
          { targetId: userId }
        ],
      },
      raw: true,
    });

    const connectionIds = acceptedConnections.map((conn) =>
      conn.requesterId === userId ? conn.targetId : conn.requesterId
    );

    // ✅ 2. Base condition (IMPORTANT: SOFT DELETE FILTER)
 let whereCondition = {
  isDeleted: false,

  [Op.or]: [
    { userId: [userId, ...connectionIds] },

    {
      [Op.and]: [
        Sequelize.where(
          Sequelize.col("user.account_type"),
          "public"
        ),
        {
          userId: { [Op.notIn]: [userId, ...connectionIds] },
        },
      ],
    },
  ],
};

    // ✅ 3. Cursor Pagination
    if (cursor) {
      whereCondition.createdAt = { [Op.lt]: cursor };
    }

    // ✅ 4. Fetch feed posts
    const posts = await UploadPosts.findAll({
      where: whereCondition,
      include: [
        {
          model: User,
          as: "user",
          required: true, 
          attributes: [
            "id", "fullName", "uniqueId", "image",
            "isPremium", "accountType", "isOnline",
            "goal", "type", "userVerifyed", "premiumVerifyed"
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit,
    });

    // ✅ 5. Format each post
    const formattedFeed = await Promise.all(
      posts.map(async (post) => {
        const commentsCount = await PostComment.count({
          where: { postId: post.id, parentId: null },
        });

        const liked = await PostLike.findOne({
          where: { userId, postId: post.id },
          attributes: ["id"],
        });

        return {
          id: post.id,
          type: post.type,
          title: post.title,
          textContent: post.textContent,
          description: post.description,
          mediaPaths: post.mediaPaths || null,
          thumbnail: post.thumbnail || null,
          createdAt: post.createdAt,
          commentsCount: commentsCount || 0,
          likesCount: post.likesCount || 0,
          isLoved: !!liked,
          isConnection: connectionIds.includes(post.userId),

          user: {
            id: post.user.id,
            fullName: post.user.fullName,
            uniqueId: post.user.uniqueId,
            image: post.user.image,
            isPremium: post.user.isPremium,
            accountType: post.user.accountType,
            isOnline: post.user.isOnline,
            goal: post.user.goal,
            type: post.user.type,
            userVerifyed: post.user.userVerifyed,
            premiumVerifyed: post.user.premiumVerifyed,
          },
        };
      })
    );

    // ✅ 6. Pagination cursor
    const nextCursor =
      posts.length > 0 ? posts[posts.length - 1].createdAt : null;

    // ✅ 7. Response
    return res.json({
      status_type: "success",
      feed: formattedFeed,
      nextCursor,
      hasMore: posts.length === limit,
    });

  } catch (err) {
    console.error("Cursor Feed Error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.toggleLike = async (req, res) => {
  try {
    const { userId, postId } = req.body;

    if (!userId || !postId)
      return res.status(400).json({ message: "userId and postId are required" });

    // ✅ Check if user already liked
    const existing = await PostLike.findOne({ where: { userId, postId } });

    let isLoved = false;
    let updatedLikesCount = 0;

    if (existing) {
      // ✅ Unlike the post
      await existing.destroy();

      // Decrease like count
      await UploadPosts.increment({ likesCount: -1 }, { where: { id: postId } });

      // Get updated count
      const post = await UploadPosts.findByPk(postId, {
        attributes: ["likesCount"],
      });

      updatedLikesCount = post.likesCount;
      isLoved = false;

      return res.json({
        liked: false,
        isLoved,
        likesCount: updatedLikesCount,
        message: "Post unliked",
      });
    } else {
      // ✅ Like the post
      await PostLike.create({ userId, postId, isLiked: true });

      await UploadPosts.increment({ likesCount: 1 }, { where: { id: postId } });

      // Get updated count
      const post = await UploadPosts.findByPk(postId, {
        attributes: ["likesCount"],
      });

      updatedLikesCount = post.likesCount;
      isLoved = true;

      return res.json({
        liked: true,
        isLoved,
        likesCount: updatedLikesCount,
        message: "Post liked",
      });
    }
  } catch (error) {
    console.error("Toggle like error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};


exports.addComment = async (req, res) => {
  try {
    const { userId, postId, commentText, parentId } = req.body;

    if (!userId || !postId || !commentText)
      return res.status(400).json({ message: "Missing required fields" });

    const comment = await PostComment.create({ userId, postId, commentText, parentId });

    // Increment post comments count (only for top-level comments)
    if (!parentId) {
      await UploadPosts.increment({ commentsCount: 1 }, { where: { id: postId } });
    }

    res.json({
      message: parentId ? "Reply added successfully" : "Comment added successfully",
      comment,
    });
  } catch (error) {
    console.error("Add comment error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

exports.deleteComment = async (req, res) => {
  try {
    const { commentId, userId } = req.body;

    const comment = await PostComment.findOne({ where: { id: commentId, userId } });
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const postId = comment.postId;
    const parentId = comment.parentId;

    // Delete all replies if it's a parent comment
    if (!parentId) {
      await PostComment.destroy({ where: { parentId: commentId } });
      await UploadPosts.increment({ commentsCount: -1 }, { where: { id: postId } });
    }

    await comment.destroy();

    res.json({ message: "Comment deleted successfully" });
  } catch (error) {
    console.error("Delete comment error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

exports.getCommentsByPost = async (req, res) => {
  try {
    const postId = req.params.postId;

    const comments = await PostComment.findAll({
      where: { postId, parentId: null }, // only main comments
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "fullName", "image", "uniqueId"],
        },
        {
          model: PostComment,
          as: "replies",
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "fullName", "image"],
            },
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.json({
      status_type: "success",
      count: comments.length,
      comments,
    });
  } catch (error) {
    console.error("Get comments error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

exports.reportPost = async (req, res) => {
  try {
    const { postId, reportedBy, reason } = req.body;

    if (!postId || !reportedBy || !reason) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const report = await PostReport.create({ postId, reportedBy, reason });

    res.json({
      status_type: "success",
      message: "Post reported successfully",
      report,
    });
  } catch (error) {
    console.error("Report Post Error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

exports.deletePost = async (req, res) => {
  try {
    const { postId } = req.params;

    // Find post
    const post = await UploadPosts.findByPk(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Soft delete
    post.isDeleted = true;
    await post.save();

    return res.status(200).json({
      message: "Post deleted successfully (soft delete)",
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
};

exports.getMyPosts = async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const limit = Number(req.query.limit) || 10;
    const cursor = req.query.cursor;

    let whereCondition = {
      userId,
      isDeleted: false,
      type: { [Op.in]: ["text", "photo"] }
    };

    // Cursor logic → fetch posts older than cursor
    if (cursor) {
      whereCondition.createdAt = { [Op.lt]: cursor };
    }

    const posts = await UploadPosts.findAll({
      where: whereCondition,
      order: [["createdAt", "DESC"]],
      limit,
      attributes: [
        "id",
        "type",
        "title",
        "textContent",
        "description",
        "mediaPaths",
        "likesCount",
        "commentsCount",
        "createdAt"
      ]
    });

    const nextCursor =
      posts.length > 0 ? posts[posts.length - 1].createdAt : null;

    return res.json({
      status: "success",
      posts,
      nextCursor,
      hasMore: posts.length === limit
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
};
// GET /myvideos/:userId?cursor=XXXX&limit=10
exports.getMyVideos = async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const limit = Number(req.query.limit) || 10;
    const cursor = req.query.cursor;

    let whereCondition = {
      userId,
      isDeleted: false,
      type: "video"
    };

    // Apply cursor for infinite scroll
    if (cursor) {
      whereCondition.createdAt = { [Op.lt]: cursor };
    }

    const videos = await UploadPosts.findAll({
      where: whereCondition,
      order: [["createdAt", "DESC"]],
      limit,
      attributes: [
        "id",
        "type",
        "title",
        "description",
        "mediaPaths",
        "likesCount",
        "commentsCount",
        "createdAt"
      ]
    });

    const nextCursor =
      videos.length > 0 ? videos[videos.length - 1].createdAt : null;

    return res.json({
      status: "success",
      videos,
      nextCursor,
      hasMore: videos.length === limit
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
};

exports.toggleSavePost = async (req, res) => {
  try {
    const userId = req.user.id; // 🔥 from JWT (recommended)
    const { postId } = req.params;

    const existing = await SavedPost.findOne({
      where: { userId, postId },
    });

    if (existing) {
      await existing.destroy();
      return res.json({
        status: "success",
        message: "Post unsaved",
        isSaved: false,
      });
    }

    await SavedPost.create({ userId, postId });

    return res.json({
      status: "success",
      message: "Post saved",
      isSaved: true,
    });
  } catch (error) {
    console.error("Save Post Error:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.getMySavedPosts = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Number(req.query.limit) || 10;
    const cursor = req.query.cursor;

    let whereCondition = {};

    if (cursor) {
      whereCondition.createdAt = { [Op.lt]: cursor };
    }

    const savedPosts = await SavedPost.findAll({
      where: { userId },
      include: [
        {
          model: UploadPosts,
          as: "post",
          where: {
            isDeleted: false,
          },
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "fullName", "image", "accountType"],
            },
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit,
    });

    const posts = savedPosts.map((item) => item.post);

    const nextCursor =
      savedPosts.length > 0
        ? savedPosts[savedPosts.length - 1].createdAt
        : null;

    return res.json({
      status: "success",
      posts,
      nextCursor,
      hasMore: savedPosts.length === limit,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};








