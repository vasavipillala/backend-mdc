module.exports = (sequelize, DataTypes) => {
  const GroupMember = sequelize.define("GroupMember", {
    id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
    groupId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM("admin", "member"),
      defaultValue: "member",
    },
    isApproved: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    canSendMessage: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    joinedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  });

  GroupMember.associate = (models) => {
    // ✅ Each GroupMember belongs to a Group
    GroupMember.belongsTo(models.Group, {
      foreignKey: "groupId",
      as: "group",
    });

    // ✅ Each GroupMember belongs to a User
    GroupMember.belongsTo(models.User, {
      foreignKey: "userId",
      as: "user",
    });
  };

  return GroupMember;
};
