// models/chatuser.js
module.exports = (sequelize, DataTypes) => {
  const ChatUser = sequelize.define("ChatUser", {
    role: {
      type: DataTypes.STRING, // "member", "admin", etc.
      defaultValue: "member",
    },
  });

  return ChatUser;
};
