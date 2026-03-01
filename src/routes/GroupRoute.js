const express = require("express");
const router = express.Router();
const { createGroup,getGroups,getGroupMessages,getMyGroups,
  addMemberToGroup,getUserPublicGroups, 
 getGroupMembers, deleteGroup, getGroupsBySchool, 
  joinGroup,
  updateMemberApproval,
  updateGroupPrivacy,
  updateMessagePermission,
  updateGroupDetails,
  getRemainingMembers,
  removeMember,
  updateMemberRole,
  acceptInviteLink,
  transferOwnership,
  getPendingJoinRequests,
  getGroupDetails,
  getGoalPublicGroups} = require("../controllers/GroupController");
const {  User,Group,GroupMember,GroupMessage } = require("../../db");
// POST /api/groups/create
const authenticate = require("../middleware/auth/Authentication");
router.post("/create",authenticate, createGroup);
router.get("/total/groups", getGroups);
router.get("/messages/:groupId", getGroupMessages)
router.get("/mygroups",authenticate, getMyGroups)
router.post("/add/members/:groupId",authenticate, addMemberToGroup)
router.get("/user/public/:userId", getUserPublicGroups);
//router.get("/userinvolved/public//:userId", getUserInvolvedPublicGroups);
router.get("/members/:groupId", getGroupMembers);
router.delete("/leave/:groupId/:memberId",authenticate, removeMember);
router.delete("/delete/:groupId",authenticate, deleteGroup);
router.get("/school/:schoolId", getGroupsBySchool);
router.post("/join/:groupId",authenticate, joinGroup)
router.post("/members/approve/:groupId/:memberId",authenticate, updateMemberApproval)
// POST /groups/:groupId/members/:memberId/approve  (body: {approve: true/false})
router.get("/remaing/members/:groupId/:userId", getRemainingMembers);
router.put("/privacy/:groupId",authenticate, updateGroupPrivacy)
router.put("/message/permission/:groupId/:memberId",authenticate,updateMessagePermission)
//PATCH /groups/:groupId/member/:memberId/message-permission
router.put("/update/:groupId",authenticate, updateGroupDetails)
router.post("/role/:groupId/:memberId",authenticate, updateMemberRole) 
router.post("/acceptlink/:inviteToken",authenticate, acceptInviteLink)
router.get("/pendingrequests/:groupId", getPendingJoinRequests);
router.get("/get/:groupId/",authenticate, getGroupDetails);
router.get("/public",authenticate, getGoalPublicGroups);
router.get("/get", async (req, res) => {
  try {
    const userId = req.user?.id || req.query.userId;
    // 1️⃣ Get all groups
    let groups;
    if (userId) {
      // Groups the user belongs to
      groups = await Group.findAll({
        include: [
          {
            model: GroupMember,
            as: "members",
            where: { userId },
            required: true,
            include: [
              { model: User, as: "user", attributes: ["id", "fullName", "email","image"] }
            ]
          },
          {
            model: GroupMessage,
            as: "messages",
            limit: 1,
            order: [["createdAt", "DESC"]],
          },
        ],
        order: [["updatedAt", "DESC"]],
      });
    } else {
      // Public groups if no user
      groups = await Group.findAll({
        where: { type: "public" },
        include: [
          {
            model: GroupMember,
            as: "members",
            include: [
              { model: User, as: "user", attributes: ["id", "fullName", "email","image"] }
            ]
          },
          {
            model: GroupMessage,
            as: "messages",
            limit: 1,
            order: [["createdAt", "DESC"]],
          },
        ],
        order: [["updatedAt", "DESC"]],
      });
    }

    // 2️⃣ Format response
    const formatted = groups.map(g => {
      const lastMsg = g.messages[0];

      const lastMessageText = lastMsg
        ? `${lastMsg.senderId === userId ? "You" : g.members.find(m => m.userId === lastMsg.senderId)?.user?.name || "Someone"}: ${lastMsg.text}`
        : "No messages yet";

      return {
        id: g.id,
        name: g.name,
        image: g.image || "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=100",
        lastMessage: lastMessageText,
        time: lastMsg ? new Date(lastMsg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
        unreadCount: 0, // Optional: calculate based on lastSeen or custom logic
        members: g.members.length,
        status: lastMsg?.status || "none",
      };
    });

    res.status(200).json({ success: true, count: formatted.length, groups: formatted });

  } catch (error) {
    console.error("❌ Error fetching groups:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;

