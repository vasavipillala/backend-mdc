// routes/postRoutes.js
const express = require("express");
const { createPost, getHomeFeedCursor,toggleLike, addComment, deleteComment, getCommentsByPost, reportPost, deletePost, getMyPosts, getMyVideos,toggleSavePost,getMySavedPosts } = require("../controllers/PostController");
const upload = require("../middleware/Upload");
const authenticate = require("../middleware/auth/Authentication");
const router = express.Router();


// ✅ Multiple images or single video
router.post("/create",upload.array("media", 10), createPost);
router.get("/home/feed/:userId", getHomeFeedCursor);
router.post("/toggle-like", toggleLike);
router.post("/add/Comment", addComment);
router.delete("/delete/Comment", deleteComment);
router.get("/Comments/:postId", getCommentsByPost);
router.post("/report", reportPost);
router.delete("/delete/:postId", deletePost);
router.get("/myposts/:userId", getMyPosts);
router.get("/myvideos/:userId", getMyVideos);
router.post("/saved/:postId",authenticate, toggleSavePost);
router.get("/saved",authenticate, getMySavedPosts);


module.exports = router;
