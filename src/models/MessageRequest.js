module.exports = (sequelize, DataTypes) => {
  const MessageRequest = sequelize.define("MessageRequest", {
    senderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "Users", key: "id" },
      onDelete: "CASCADE",
    },
    receiverId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "Users", key: "id" },
      onDelete: "CASCADE",
    },
    msgReqStatus: {
      type: DataTypes.ENUM("pending", "accepted", "rejected"),
      defaultValue: "pending",
    },
  }, {
    indexes: [
      {
        unique: true,
        fields: ["senderId", "receiverId"],
      },
    ],
  });

  MessageRequest.associate = (models) => {
    MessageRequest.belongsTo(models.User, { as: "Sender", foreignKey: "senderId" });
    MessageRequest.belongsTo(models.User, { as: "Receiver", foreignKey: "receiverId" });
  };

  return MessageRequest;
};
