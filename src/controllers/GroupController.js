const { Group, GroupMember, GroupMessage, User, sequelize,FollowRequest } = require("../../db");
const { v4: uuidv4 } = require("uuid");
const { Op, Sequelize } = require("sequelize");

const generateInviteLink = () => `https://yourapp.com/group/invite/${uuidv4()}`;

const parseLimit = (q, fallback = 20, max = 100) => {
  const n = Number(q);
  if (!n || n <= 0) return fallback;
  return Math.min(n, max);
};

// Use cursor as id (DESC by id) for stable pagination
const buildCursorWhere = (cursor) => {
  if (!cursor) return {};
  return { id: { [Op.lt]: Number(cursor) } };
};

exports.createGroup = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: No user id found" });
    }

    let { name, description, type, messagePermission, members } = req.body;

    // Required fields
    if (!name || !type) {
      return res.status(400).json({ message: "Group name and type are required." });
    }

    // Validate type
    if (!["public", "private"].includes(type)) {
      return res.status(400).json({ message: "Invalid group type." });
    }

    // Fix empty or null messagePermission
    if (!messagePermission || messagePermission.trim() === "") {
      messagePermission = "everyone"; // default fallback
    }

    const inviteLink = generateInviteLink();

    // Create group
    const group = await Group.create({
      name,
      description: description || null,
      type,
      createdBy: userId,
      inviteLink,
      messagePermission, // always valid now
    });

    // Add creator as admin
    await GroupMember.create({
      groupId: group.id,
      userId,
      role: "admin",
      isApproved: true,
    });

    // Add members list
    if (Array.isArray(members) && members.length > 0) {
      const finalMembers = members
        .filter((m) => Number(m) !== Number(userId)) // remove creator
        .map((memberId) => ({
          groupId: group.id,
          userId: memberId,
          role: "member",
          isApproved: type === "public" ? true : false,
        }));

      if (finalMembers.length > 0) {
        await GroupMember.bulkCreate(finalMembers);
      }
    }

    return res.status(201).json({
      success: true,
      message: "Group created successfully",
      group,
    });

  } catch (error) {
    console.error("❌ Error creating group:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// 2Get groups (public + groups user created or member of) with cursor pagination
// GET /groups?cursor=123&limit=20
// -----------------------------
exports.getGroups = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const cursor = req.query.cursor || null;
    const limit = parseLimit(req.query.limit, 20, 50);

    // only fetch relevant groups: public OR created by user OR member of user
    // to include membership condition, join via GroupMember in a subquery
    const where = {
      ...buildCursorWhere(cursor),
      [Op.or]: [
        { type: "public" },
        userId ? { createdBy: userId } : null,
        // include groups where user is a member (requires join below)
      ].filter(Boolean),
    };

    // fetch groups with last message (separate include) and count of members
    const groups = await Group.findAll({
      where,
      order: [["id", "DESC"]],
      limit,
      include: [
        {
          model: GroupMessage,
          as: "messages",
          required: false,
          limit: 1,
          separate: true,
          order: [["id", "DESC"]],
        },
        {
          model: GroupMember,
          as: "groupMembers",
          attributes: ["userId"],
          required: false,
        },
      ],
    });

    // format
    const formatted = groups.map(g => {
      const last = (g.messages && g.messages[0]) || null;
      return {
        id: g.id,
        name: g.name,
        description: g.description,
        type: g.type,
        schoolId: g.schoolId || null,
        createdBy: g.createdBy,
        memberCount: g.groupMembers ? g.groupMembers.length : 0,
        lastMessage: last ? { text: last.text, createdAt: last.createdAt, senderId: last.senderId } : null,
        updatedAt: g.updatedAt,
        image:g.groupImage
      };
    });

    const nextCursor = groups.length ? groups[groups.length - 1].id : null;
    return res.json({ success: true, groups: formatted, nextCursor, hasMore: formatted.length === limit });
  } catch (err) {
    console.error("Get Groups Error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// 6-----------------------------
// Get groups created by a user (normal public groups only) - used on user profile
// GET /groups/user/:userId/public
// -----------------------------
exports.getUserPublicGroups = async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (!userId) return res.status(400).json({ success: false, message: "User ID required" });

    const groups = await Group.findAll({
      where: { createdBy: userId, type: "public", schoolId: null },
      order: [["createdAt", "DESC"]],
      attributes: ["id", "name", "description", "createdAt", "schoolId"],
    });

    return res.json({ success: true, count: groups.length, groups });
  } catch (err) {
    console.error("Get User Public Groups Error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// 10 Get groups under a school (cursor pagination)
// GET /groups/school/:schoolId?cursor=...&limit=...
// -----------------------------
exports.getGroupsBySchool = async (req, res) => {
  try {
    const schoolId = Number(req.params.schoolId);
    if (!schoolId) return res.status(400).json({ success: false, message: "School ID required" });

    const cursor = req.query.cursor || null;
    const limit = parseLimit(req.query.limit, 20, 50);

    const where = {
      schoolId,
      ...buildCursorWhere(cursor),
    };

    const groups = await Group.findAll({
      where,
      order: [["id", "DESC"]],
      limit,
      include: [
        { model: User, as: "creator", attributes: ["id", "fullName", "image"] },
        {
          model: GroupMember,
          as: "groupMembers",
          attributes: ["userId"],
          required: false,
        }
      ]
    });

    const formatted = groups.map(g => ({
      id: g.id,
      name: g.name,
      description: g.description,
      createdBy: g.createdBy,
      creator: g.creator ? { id: g.creator.id, name: g.creator.fullName } : null,
      memberCount: g.groupMembers ? g.groupMembers.length : 0,
      createdAt: g.createdAt,
    }));

    const nextCursor = groups.length ? groups[groups.length - 1].id : null;
    return res.json({ success: true, schoolId, groups: formatted, nextCursor, hasMore: formatted.length === limit });
  } catch (err) {
    console.error("Get Groups By School Error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// 4 Get groups the logged-in user is member of (getMyGroups) (cursor based)
// GET /groups/me?cursor=...&limit=...
// -----------------------------
exports.getMyGroups = async (req, res) => {
  try {
    const userId = req.user.id;
    const cursor = req.query.cursor || null;
    const limit = parseLimit(req.query.limit, 20, 50);

    const memberships = await GroupMember.findAll({
      where: { userId, ...buildCursorWhere(cursor) },
      order: [["id", "DESC"]],
      limit,
      include: [
        {
          model: Group,
          as: "group",   // <-- REQUIRED ALIAS
          include: [
            {
              model: GroupMessage,
              as: "messages",
              separate: true,
              limit: 1,
              order: [["id", "DESC"]],
            },
            {
              model: GroupMember,
              as: "groupMembers",
              attributes: ["userId"],
              required: false,
            }
          ],
        }
      ]
    });

    const formatted = memberships.map((m) => {
      const g = m.group; // because alias is "group"
      const last = (g.messages && g.messages[0]) || null;

      return {
        id: g.id,
        name: g.name,
        memberCount: g.groupMembers ? g.groupMembers.length : 0,
        image:g.groupImage,
        lastMessage: last
          ? {
              text: last.text,
              createdAt: last.createdAt,
              senderId: last.senderId,
            }
          : null,
        joinedAt: m.joinedAt,
      };
    });

    const nextCursor = memberships.length
      ? memberships[memberships.length - 1].id
      : null;

    return res.json({
      success: true,
      groups: formatted,
      nextCursor,
      hasMore: formatted.length === limit,
    });
  } catch (err) {
    console.error("Get My Groups Error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

//3 Get group messages (cursor pagination) - DESC by id, returned in ASC for client convenience if requested
// GET /groups/:groupId/messages?cursor=...&limit=30&asc=true
// -----------------------------
exports.getGroupMessages = async (req, res) => {
  try {
    const groupId = Number(req.params.groupId);
    if (!groupId) return res.status(400).json({ success: false, message: "Group ID required" });

    const limit = parseLimit(req.query.limit, 50, 200);
    const cursor = req.query.cursor || null;
    const asc = req.query.asc === "true";

    const where = { groupId, ...(cursor ? { id: { [Op.lt]: Number(cursor) } } : {}) };

    // fetch newest first (DESC) then reverse to ASC if requested
    const messages = await GroupMessage.findAll({
      where,
      limit,
      order: [["id", "DESC"]],
      include: [{ model: User, as: "sender", attributes: ["id", "fullName", "image"] }],
    });

    const nextCursor = messages.length ? messages[messages.length - 1].id : null;
    const payload = asc ? messages.reverse() : messages;

    return res.json({ success: true, messages: payload, nextCursor, hasMore: messages.length === limit });
  } catch (err) {
    console.error("Get Group Messages Error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

//11 Join group (public auto-approve, private -> request (isApproved=false))
// POST /groups/:groupId/join
// -----------------------------
exports.joinGroup = async (req, res) => {
  try {
    const groupId = Number(req.params.groupId);
    const userId = req.user.id;
    if (!groupId) return res.status(400).json({ success: false, message: "Group ID required" });

    const group = await Group.findByPk(groupId);
    if (!group) return res.status(404).json({ success: false, message: "Group not found" });

    const existing = await GroupMember.findOne({ where: { groupId, userId } });
    if (existing) {
      return res.json({ success: true, message: existing.isApproved ? "Already a member" : "Join request pending" });
    }

    const member = await GroupMember.create({
      groupId,
      userId,
      role: "member",
      isApproved: group.type === "public",
      joinedAt: new Date(),
    });

    const message = group.type === "public" ? "Joined group" : "Join request sent";
    return res.json({ success: true, message, member });
  } catch (err) {
    console.error("Join Group Error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

function formatCount(num) {
  if (!num) return "0";
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(1) + "k";
  return String(num);
}

exports.getGoalPublicGroups = async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 10;

    const groups = await Group.findAll({
      where: {
        type: "public",
        schoolId: null,
      },
      attributes: [
        "id",
        "name",
        [
          Sequelize.fn("COUNT", Sequelize.col("groupMembers.id")),
          "memberCount",
        ],
      ],
      include: [
        {
          model: GroupMember,
          as: "groupMembers",
          attributes: [],
          required: false,
        },
      ],
      group: ["Group.id", "Group.name"],
      order: [[Sequelize.literal('"memberCount"'), "DESC"]],
      limit,
      subQuery: false,
    });

    const formatted = groups.map((g, index) => ({
      id: `r${index + 1}`,
      groupId: g.id,
      name: g.name,
      members: formatCount(Number(g.get("memberCount"))),
    }));

    return res.json({ success: true, data: formatted });

  } catch (error) {
    console.error("Goal Groups Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.updateMemberApproval = async (req, res) => {
  try {
    const groupId = Number(req.params.groupId);
    const memberId = Number(req.params.memberId);
    const actorId = req.user.id;
    const { approve } = req.body;

    if (!groupId || !memberId) return res.status(400).json({ success: false, message: "Missing params" });

    const adminCheck = await GroupMember.findOne({ where: { groupId, userId: actorId, role: "admin" } });
    if (!adminCheck) return res.status(403).json({ success: false, message: "Not authorized" });

    const member = await GroupMember.findByPk(memberId);
    if (!member || member.groupId !== groupId) return res.status(404).json({ success: false, message: "Member not found" });

    if (approve) {
      await member.update({ isApproved: true });
      return res.json({ success: true, message: "Member approved" });
    } else {
      await member.destroy();
      return res.json({ success: true, message: "Member rejected/removed" });
    }
  } catch (err) {
    console.error("Update Member Approval Error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.addMemberToGroup = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const groupId = Number(req.params.groupId);
    const addedBy = req.user.id;
    const userIds = Array.isArray(req.body.userIds) ? req.body.userIds : [req.body.userIds];

    if (!groupId || !userIds.length) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Missing groupId or userIds",
        message_type: "error",
      });
    }

    const group = await Group.findByPk(groupId, { transaction: t });
    if (!group) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Group not found",
        message_type: "error",
      });
    }

    // authorization: only creator or admins can add members
    if (addedBy !== group.createdBy) {
      const actorMember = await GroupMember.findOne({
        where: { groupId, userId: addedBy },
        transaction: t
      });

      if (!actorMember || actorMember.role !== "admin") {
        await t.rollback();
        return res.status(403).json({
          success: false,
          message: "You are not authorized to add members",
          message_type: "error",
        });
      }
    }

    // Find existing members
    const existing = await GroupMember.findAll({
      where: { groupId, userId: { [Op.in]: userIds } },
      attributes: ["userId"],
      transaction: t
    });

    const existSet = new Set(existing.map(e => String(e.userId)));

    const toCreate = userIds
      .filter(id => !existSet.has(String(id)))
      .map(id => ({
        groupId,
        userId: id,
        role: "member",
        isApproved: group.type === "public",
        joinedAt: new Date(),
      }));

    // Add new members
    if (toCreate.length) {
      await GroupMember.bulkCreate(toCreate, { transaction: t });
    }

    await t.commit();

    return res.json({
      created: toCreate.length,
      addedUsers: toCreate.map(u => u.userId),
      skippedUsers: [...existSet], // users already in group
      message:
        toCreate.length > 0
          ? "Members added successfully"
          : "All selected users are already part of the group",
      message_type: "success",
addedBy:addedBy
    });

  } catch (err) {
    await t.rollback();
    console.error("Add Members Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Server error",
      message_type: "error",
    });
  }
};

exports.getGroupMembers = async (req, res) => {
  try {
    const groupId = Number(req.params.groupId);
    if (!groupId) return res.status(400).json({ success: false, message: "Group ID required" });

    const limit = parseLimit(req.query.limit, 50, 200);
    const cursor = req.query.cursor || null;

    // cursor on GroupMember.id
    const where = { groupId, ...(cursor ? { id: { [Op.lt]: Number(cursor) } } : {}) };

    const members = await GroupMember.findAll({
      where,
      order: [
        [Sequelize.literal(`CASE WHEN "GroupMember"."role" = 'admin' THEN 0 ELSE 1 END`), "ASC"],
        ["joinedAt", "ASC"],
      ],
      limit,
      include: [{ model: User, as: "user", attributes: ["id", "fullName", "image", "uniqueId", "type"] }],
    });

    const formatted = members.map(m => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      isApproved: m.isApproved,
      canSendMessage: m.canSendMessage,
      joinedAt: m.joinedAt,
      user: m.user ? { id: m.user.id, name: m.user.fullName, image: m.user.image, uniqueId: m.user.uniqueId } : null,
    }));

    const nextCursor = members.length ? members[members.length - 1].id : null;
    return res.json({ success: true, members: formatted, nextCursor, hasMore: formatted.length === limit });
  } catch (err) {
    console.error("Get Group Members Error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
exports.removeMember = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const groupId = Number(req.params.groupId);
    const actorId = req.user?.id;

    if (!actorId) {
      await t.rollback();
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // memberId or multiple memberIds
    const memberIdParam = req.params.memberId ? [Number(req.params.memberId)] : [];
    const memberIdsBody = Array.isArray(req.body.memberIds) ? req.body.memberIds : [];

    const memberIds = [...memberIdParam, ...memberIdsBody].filter(Boolean);

    if (!memberIds.length) {
      await t.rollback();
      return res.status(400).json({ success: false, message: "No members provided" });
    }

    // Fetch group
    const group = await Group.findByPk(groupId);
    if (!group) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    // Actor membership
    const actorMember = await GroupMember.findOne({
      where: { groupId, userId: actorId }
    });

    // Permission
    const isCreator = actorId === group.createdBy;
    const isAdmin = actorMember?.role === "admin";

    // Target members
    const members = await GroupMember.findAll({
      where: { id: memberIds, groupId }
    });

    if (!members.length) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "Members not found" });
    }

    // FINAL list of names for system message
    const actor = await User.findByPk(actorId);

    // Loop delete members
    for (const member of members) {

      const isSelf = member.userId === actorId;

      // Check authorization
      if (!isSelf && !isCreator && !isAdmin) {
        await t.rollback();
        return res.status(403).json({
          success: false,
          message: "You are not authorized to remove members"
        });
      }

      // Prevent last admin leaving
      if (isSelf && member.role === "admin") {
        const otherAdmins = await GroupMember.count({
          where: {
            groupId,
            role: "admin",
            userId: { [Op.ne]: actorId }
          }
        });

        if (otherAdmins === 0) {
          await t.rollback();
          return res.status(400).json({
            success: false,
            message: "Assign another admin before leaving the group"
          });
        }
      }

      // User name
      const removedUser = await User.findByPk(member.userId);
      const removedName = removedUser?.fullName|| "User";
      const actorName = actor?.fullName ||  "Someone";

      // Delete member
      await member.destroy({ transaction: t });

      // System message
      await GroupMessage.create({
        groupId,
        senderId: actorId,
        type: "system",
        text: isSelf
          ? `${actorName} left the group`
          : `${actorName} removed ${removedName} from the group`
      }, { transaction: t });
    }

    // Check remaining members
    const remainingMembers = await GroupMember.count({
      where: { groupId }
    });

    // Auto delete group if members < 2
    if (remainingMembers < 2) {
      await GroupMember.destroy({ where: { groupId }, transaction: t });
      await GroupMessage.destroy({ where: { groupId }, transaction: t });
      await Group.destroy({ where: { id: groupId }, transaction: t });

      await t.commit();
      return res.json({
        success: true,
        message: "Group deleted because members became less than 2"
      });
    }

    await t.commit();

    return res.json({
      success: true,
      message: "Members removed successfully",
      removedMembers: memberIds
    });

  } catch (err) {
    await t.rollback();
    console.error("Remove Members Error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteGroup = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const groupId = Number(req.params.groupId);
    const actorId = req.user.id;

    const group = await Group.findByPk(groupId, { transaction: t });
    if (!group) { await t.rollback(); return res.status(404).json({ success: false, message: "Group not found" }); }

    if (group.createdBy !== actorId) { await t.rollback(); return res.status(403).json({ success: false, message: "Only creator can delete the group" }); }

    // Option A: soft delete flag on Group (recommended) - set isDeleted = true
    // Option B: hard delete - remove group, cascade will remove members/messages if FK CASCADE set
    // Here we hard delete with manual cleanup for safety:
    await GroupMember.destroy({ where: { groupId }, transaction: t });
    await GroupMessage.destroy({ where: { groupId }, transaction: t });
    await Group.destroy({ where: { id: groupId }, transaction: t });

    await t.commit();
    return res.json({ success: true, message: "Group deleted" });
  } catch (err) {
    await t.rollback();
    console.error("Delete Group Error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateGroupPrivacy = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id; // from JWT
    const { type } = req.body; // you used "type" in model, not "privacy"

    // Validate input
    if (!["public", "private"].includes(type)) {
      return res.status(400).json({ message: "Invalid privacy type" });
    }

    // Fetch group with member role verification
    const group = await Group.findOne({
      where: { id: groupId },
      include: [
        {
          model: GroupMember,
          as: "groupMembers",
          where: { userId },
          required: false,
          attributes: ["role"],
        },
      ],
    });

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    const member = group.groupMembers[0];

    // Check if user is admin OR owner
    if (!member || !["admin", "owner"].includes(member.role)) {
      return res.status(403).json({ message: "Not allowed to change privacy" });
    }

    // Update privacy
    await group.update({ type });

    return res.status(200).json({
      message: `Group privacy changed to ${type}`,
      group,
    });

  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.updateGroupDetails = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id; // from auth middleware
    const { name, description } = req.body;

    // 1️⃣ Check if group exists
    const group = await Group.findByPk(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // 2️⃣ Check user permission (admin or owner)
    const member = await GroupMember.findOne({
      where: { groupId, userId },
    });

    if (!member || !["admin", "owner"].includes(member.role)) {
      return res.status(403).json({
        message: "Only group admins can update details",
      });
    }

    // 3️⃣ Handle uploaded images
    let profileImage = group.profileImage;

    if (req.file) {
      profileImage = `uploads/groups/${req.file.filename}`;
    }

    // 4️⃣ Update data
    await group.update({
      name: name || group.name,
      description: description || group.description,
      profileImage: profileImage,
    });

    return res.status(200).json({
      success: true,
      message: "Group updated successfully",
      group,
    });

  } catch (error) {
    console.error("❌ Error updating group:", error);
    return res.status(500).json({
      message: "Server error updating group",
      error: error.message,
    });
  }
};

exports.updateMessagePermission = async (req, res) => {
  try {
    const { groupId, memberId } = req.params;
    const { canMessage } = req.body;
    const adminId = req.user.id;

    // Validate
    if (typeof canMessage !== "boolean") {
      return res.status(400).json({ message: "Invalid permission value" });
    }

    // Check if admin is admin/owner
    const admin = await GroupMember.findOne({
      where: { groupId, userId: adminId }
    });

    if (!admin || !["admin", "owner"].includes(admin.role)) {
      return res.status(403).json({ message: "Not allowed" });
    }

    // Update member permission
    await GroupMember.update(
      { canMessage },
      { where: { id: memberId, groupId } }
    );

    return res.status(200).json({
      message: `Messaging permission updated`,
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getRemainingMembers = async (req, res) => {
  try {
    const { groupId, userId } = req.params;
    let { cursor, limit } = req.query;

    limit = parseInt(limit) || 20;

    if (!groupId || !userId) {
      return res.status(400).json({ message: "Group ID and User ID are required" });
    }

    // 1) Group existing members
    const existing = await GroupMember.findAll({
      where: { groupId },
      attributes: ["userId"]
    });

    const existingIds = existing.map(m => m.userId);

    // 2) Fetch accepted Connections
    const whereCondition = {
      status: "accepted",
      [Op.or]: [
        { requesterId: userId },
        { targetId: userId }
      ]
    };

    // Apply cursor (only return entries with ID > cursor)
    if (cursor) {
      whereCondition.id = { [Op.gt]: cursor };
    }

    const connections = await FollowRequest.findAll({
      where: whereCondition,
      limit, // LIMIT applied here
      order: [["id", "ASC"]],
      include: [
        { model: User, as: "Requester", attributes: ["id", "fullName", "image"] },
        { model: User, as: "Target", attributes: ["id", "fullName", "image"] }
      ]
    });

    // 3) Prepare unique users and remove duplicates
    const uniqueUsers = new Map();

    connections.forEach(conn => {
      const friend =
        conn.requesterId == userId ? conn.Target : conn.Requester;

      if (!existingIds.includes(friend.id)) {
        uniqueUsers.set(friend.id, friend);
      }
    });

    const users = Array.from(uniqueUsers.values());

    // 4) Prepare nextCursor
    const lastConnection = connections[connections.length - 1];
    const nextCursor = lastConnection ? lastConnection.id : null;

    return res.status(200).json({
      success: true,
      users,
      nextCursor,
      count: users.length
    });

  } catch (error) {
    console.error("🚨 Error in paginated remaining members:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};

// GET /groups/:groupId/pending-requests?limit=20&cursor=123
exports.getPendingJoinRequests = async (req, res) => {
  try {
    const groupId = Number(req.params.groupId);
    const actorId = req.user.id;
    if (!groupId) return res.status(400).json({ success: false, message: "Group ID required" });

    // check admin
    const admin = await GroupMember.findOne({ where: { groupId, userId: actorId, role: "admin" } });
    if (!admin) return res.status(403).json({ success: false, message: "Not allowed" });

    const limit = parseLimit(req.query.limit, 20, 100);
    const cursor = req.query.cursor ? Number(req.query.cursor) : null;
    const where = { groupId, isApproved: false, ...(cursor ? { id: { [Op.lt]: cursor } } : {}) };

    const requests = await GroupMember.findAll({
      where,
      order: [["id", "DESC"]],
      limit,
      include: [{ model: User, as: "user", attributes: ["id", "fullName", "image", "uniqueId"] }],
    });

    const formatted = requests.map(r => ({
      id: r.id,
      userId: r.userId,
      user: r.user && { id: r.user.id, name: r.user.fullName, image: r.user.image, uniqueId: r.user.uniqueId },
      joinedAt: r.joinedAt,
    }));

    return res.json({
      success: true,
      requests: formatted,
      nextCursor: formatted.length ? requests[requests.length - 1].id : null,
      hasMore: formatted.length === limit
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// POST /groups/:groupId/transfer-ownership
// body: { newOwnerUserId }
exports.transferOwnership = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const groupId = Number(req.params.groupId);
    const actorId = req.user.id;
    const { newOwnerUserId } = req.body;

    const group = await Group.findByPk(groupId, { transaction: t });
    if (!group) { await t.rollback(); return res.status(404).json({ success: false, message: "Group not found" }); }

    if (group.createdBy !== actorId) { await t.rollback(); return res.status(403).json({ success: false, message: "Only owner can transfer" }); }

    // ensure new owner is a member
    const membership = await GroupMember.findOne({ where: { groupId, userId: newOwnerUserId }, transaction: t });
    if (!membership) { await t.rollback(); return res.status(400).json({ success: false, message: "User must be a member to be owner" }); }

    // update roles: previous owner becomes admin
    await Group.update({ createdBy: newOwnerUserId }, { where: { id: groupId }, transaction: t });

    // ensure new owner role is admin (if not already)
    if (membership.role !== "admin") {
      await membership.update({ role: "admin" }, { transaction: t });
    }

    await t.commit();
    return res.json({ success: true, message: "Ownership transferred" });
  } catch (err) {
    await t.rollback();
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// POST /groups/accept-invite/:inviteToken
// req.user exists
exports.acceptInviteLink = async (req, res) => {
  try {
    const token = req.params.inviteToken;
    const userId = req.user.id;

    const group = await Group.findOne({ where: { inviteLink: { [Op.like]: `%${token}%` } }});
    if (!group) return res.status(404).json({ success: false, message: "Invalid invite" });

    const existing = await GroupMember.findOne({ where: { groupId: group.id, userId } });
    if (existing) return res.json({ success: true, message: existing.isApproved ? "Already member" : "Request pending" });

    const member = await GroupMember.create({
      groupId: group.id,
      userId,
      role: "member",
      isApproved: group.type === "public",
      joinedAt: new Date()
    });

    return res.json({ success: true, message: group.type === "public" ? "Joined group" : "Request sent", member });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// POST /groups/:groupId/members/:memberId/role
// body: { role: "admin"|"member" }
exports.updateMemberRole = async (req, res) => {
  try {
    const { groupId, memberId } = req.params;
    const actorId = req.user.id;
    const { role } = req.body; // "admin" or "member"

    if (!["admin", "member"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const group = await Group.findByPk(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Actor details
    const actorMember = await GroupMember.findOne({
      where: { groupId, userId: actorId }
    });

    if (!actorMember) {
      return res.status(403).json({ message: "Not a group member" });
    }

    // Only creator or admins can change roles
    if (actorId !== group.createdBy && actorMember.role !== "admin") {
      return res.status(403).json({ message: "Not allowed" });
    }

    const target = await GroupMember.findByPk(memberId);
    if (!target || target.groupId !== Number(groupId)) {
      return res.status(404).json({ message: "Member not found" });
    }

    // ❌ Creator cannot be demoted
    if (target.userId === group.createdBy) {
      return res.status(400).json({ message: "Creator cannot be demoted" });
    }

    // Update role
    await target.update({ role });

    return res.json({
      success: true,
      message: `Role updated to ${role}`,
      updatedMember: target
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message });
  }
};

exports.getGroupDetails = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const userId = req.user.id;
    const groupId = Number(req.params.groupId);

    // Basic group info
    const group = await Group.findOne({
      where: { id: groupId },
      attributes: ["id", "name", "description", "groupImage", "type", "createdBy", "createdAt"],
    });

    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    // Count members
    const memberCount = await GroupMember.count({
      where: { groupId }
    });

    // Find user's role
    const myMembership = await GroupMember.findOne({
      where: { groupId, userId },
      attributes: ["role"]
    });

    const myRole = myMembership ? myMembership.role : "none";

    // Response
    return res.json({
      success: true,
      data: {
        id: group.id,
        name: group.name,
        image: group.image,
        description: group.description,
        groupAccountType: group.groupAccountType,
        createdBy: group.createdBy,
        createdAt: group.createdAt,
        memberCount,
        myRole
      }
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
};






