module.exports = (sequelize, DataTypes) => {
  const Chat = sequelize.define("Chat", {
    senderId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    receiverId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    chatType: {
      type: DataTypes.ENUM("private", "group", "public"),
      defaultValue: "private",
    },
    lastMessage: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: "",
    },
    lastTime: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    requestSenderId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    requestStatus: {
      type: DataTypes.ENUM("pending", "accepted", "declined", "blocked"),
      allowNull: false,
      defaultValue: "pending",
    },
    isMsgReqAccepted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    isArchived: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    unreadCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    blockedBy: {
  type: DataTypes.INTEGER,
  allowNull: true,
}
  });

  Chat.associate = (models) => {
    Chat.belongsToMany(models.User, {
      through: "ChatUser",
      as: "participants",
      foreignKey: "chatId",
      otherKey: "userId",
    });

    Chat.hasMany(models.Message, {
      as: "messages",
      foreignKey: "chatId",
      onDelete: "CASCADE",
    });
  };

  return Chat;
};
