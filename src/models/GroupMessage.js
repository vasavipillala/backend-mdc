module.exports = (sequelize, DataTypes) => {
  const GroupMessage = sequelize.define("GroupMessage", {
    groupId: {
      type: DataTypes.INTEGER,
     // allowNull: false,
        allowNull: true,
    },
    senderId: {
      type: DataTypes.INTEGER,
        allowNull: true,
     // allowNull: false,
    },
    text: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("sent", "delivered", "seen"),
      defaultValue: "sent",
    },
    deliveredAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    seenAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    type: {
  type: DataTypes.ENUM("text", "image", "video", "system"),
  defaultValue: "text",
},
  });

  GroupMessage.associate = (models) => {
    GroupMessage.belongsTo(models.Group, {
      foreignKey: "groupId",
      as: "group",
    });

    GroupMessage.belongsTo(models.User, {
      foreignKey: "senderId",
      as: "sender",
    });
  };

  return GroupMessage;
};
