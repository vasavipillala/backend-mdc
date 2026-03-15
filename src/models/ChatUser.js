// models/chatuser.js
module.exports = (sequelize, DataTypes) => {
  const ChatUser = sequelize.define(
    "ChatUser",
    {
      role: {
        type: DataTypes.STRING,
        defaultValue: "member",
      },
    },
    {
      tableName: "ChatUsers",   // important
      timestamps: true
    }
  );

  return ChatUser;
};