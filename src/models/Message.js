module.exports = (sequelize, DataTypes) => {
  const Message = sequelize.define(
    "Message",
    {
      chatId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      senderId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      receiverId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      text: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      status: {
        type: DataTypes.STRING,
        defaultValue: "sent", // sent / delivered / seen
      },
      deliveredAt: {
        type: DataTypes.DATE,
        allowNull: true, // will store when message was delivered
      },
      seenAt: {
        type: DataTypes.DATE,
        allowNull: true, // will store when message was seen
      },
    },
    {
      timestamps: true, // automatically adds createdAt and updatedAt
    }
  );

  return Message;
};
